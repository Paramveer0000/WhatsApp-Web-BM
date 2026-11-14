import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { EvolutionClient } from '@/lib/evolution';
import { step } from '@/lib/flow/engine';
import { FlowDefinition, EngineSession, InboundEvent, EngineAction } from '@/lib/flow/schema';
import { isSafeUrl } from '@/lib/security';
import { isWarmerOrInternalMessage } from '@/lib/warmer/warmer-engine';

// In-memory rate limiting to prevent bot ping-pong loops
const contactReplyTracker = new Map<string, number[]>();
const MAX_BOT_MESSAGES_PER_CONTACT_HOUR = 15;

/**
 * Handles incoming WhatsApp message and routes it through active or triggered Chatbot flows.
 */
export async function processInboundBotMessage(params: {
  instanceName: string;
  phone: string;
  text: string;
  messageId: string;
  pushName?: string | null;
  remoteJid?: string;
}): Promise<boolean> {
  const { instanceName, phone, text, messageId, pushName, remoteJid } = params;
  const cleanPhone = phone.replace(/[^\d]/g, '');
  if (!cleanPhone) return false;

  // 0. Suppress bot execution on internal instance or Number Warmer peer exchanges
  const isInternalOrWarmer = await isWarmerOrInternalMessage({
    instanceName,
    phone: cleanPhone,
    remoteJid,
  });
  if (isInternalOrWarmer) {
    logger.info({ phone: cleanPhone, instanceName }, 'processInboundBotMessage: Bypassing chatbot execution for internal/warmer peer');
    return false;
  }

  const now = Date.now();

  // 1. Check Contact Loop Cap (Max 15 bot messages / hour / contact)
  const contactKey = `${instanceName}:${cleanPhone}`;
  const timestamps = contactReplyTracker.get(contactKey) || [];
  const oneHourAgo = now - 3600 * 1000;
  const recentTimestamps = timestamps.filter((t) => t > oneHourAgo);
  if (recentTimestamps.length >= MAX_BOT_MESSAGES_PER_CONTACT_HOUR) {
    logger.warn({ phone: cleanPhone, instanceName }, 'Bot contact velocity limit hit; possible loop detected, pausing bot replies');
    return false;
  }

  // 2. Check Blacklist / Opt-out
  const isBlacklisted = await db.blacklist.findFirst({
    where: {
      OR: [{ phone: cleanPhone }, { phone: `+${cleanPhone}` }],
    },
  });
  if (isBlacklisted) return false;

  // 3. Find Active Bot Session for this contact & instance
  let activeSession = await db.botSession.findFirst({
    where: {
      instanceId: instanceName,
      phone: cleanPhone,
      status: { in: ['active', 'waiting', 'handoff'] },
    },
    include: {
      flow: true,
      version: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  // If session is handed off to a human agent, do not trigger bot!
  if (activeSession && activeSession.status === 'handoff') {
    logger.info({ phone: cleanPhone }, 'Session is in human handoff state; skipping bot auto-reply');
    return false;
  }

  // Check if session expired (default 24h)
  if (activeSession && activeSession.expiresAt && new Date(activeSession.expiresAt).getTime() < now) {
    await db.botSession.update({
      where: { id: activeSession.id },
      data: { status: 'expired', endReason: 'timeout' },
    });
    activeSession = null;
  }

  let flowDefinition: FlowDefinition | null = null;
  let targetFlowId: string | null = null;
  let targetVersionId: string | null = null;

  // 4. If No Active Session, Evaluate Triggers for Live Bots assigned to this instance
  if (!activeSession) {
    // Check if user texted restart keywords ("0", "menu", "start", "hi")
    const assignedBots = await db.flow.findMany({
      where: {
        status: 'live',
        assignments: {
          some: { instanceId: instanceName, enabled: true },
        },
      },
      include: {
        triggers: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (assignedBots.length === 0) return false;

    // Evaluate matching bot triggers
    const normalizedInbound = (text || '').trim().toLowerCase();
    let matchedBot = assignedBots.find((b) => {
      return b.triggers.some((t) => {
        if (t.type !== 'trigger_keyword') return false;
        try {
          const cfg = JSON.parse(t.config);
          const kws = cfg.keywords || [];
          const mode = cfg.matchMode || 'contains';
          return kws.some((kw: string) => {
            const target = kw.trim().toLowerCase();
            if (mode === 'exact') return normalizedInbound === target;
            if (mode === 'starts_with') return normalizedInbound.startsWith(target);
            return normalizedInbound.includes(target);
          });
        } catch {
          return false;
        }
      });
    });

    // Fallback bot if no keyword matched
    if (!matchedBot) {
      matchedBot = assignedBots.find((b) => b.triggers.some((t) => t.type === 'trigger_fallback'));
    }

    if (!matchedBot || !matchedBot.versions[0]) return false;

    targetFlowId = matchedBot.id;
    targetVersionId = matchedBot.versions[0].id;

    try {
      flowDefinition = JSON.parse(matchedBot.versions[0].compiled);
    } catch {
      return false;
    }

    // Create new BotSession
    const createdSession = await db.botSession.create({
      data: {
        flowId: matchedBot.id,
        versionId: matchedBot.versions[0].id,
        instanceId: instanceName,
        phone: cleanPhone,
        status: 'active',
        vars: JSON.stringify({ pushName: pushName || cleanPhone }),
        expiresAt: new Date(now + 24 * 3600 * 1000), // 24h session
      },
      include: {
        flow: true,
        version: true,
      },
    });

    activeSession = createdSession;
  } else {
    targetFlowId = activeSession.flowId;
    targetVersionId = activeSession.versionId;

    try {
      if (activeSession.version) {
        flowDefinition = JSON.parse(activeSession.version.compiled);
      } else {
        flowDefinition = JSON.parse(activeSession.flow.currentDraft);
      }
    } catch {
      return false;
    }
  }

  if (!flowDefinition || !activeSession) return false;

  // 5. Convert DB session to EngineSession
  let sessionVars: Record<string, any> = {};
  try {
    sessionVars = JSON.parse(activeSession.vars || '{}');
  } catch {}

  const engineSession: EngineSession = {
    id: activeSession.id,
    flowId: activeSession.flowId,
    versionId: activeSession.versionId,
    instanceId: activeSession.instanceId,
    phone: activeSession.phone,
    status: activeSession.status as any,
    currentNodeId: activeSession.currentNodeId,
    vars: sessionVars,
    stepSeq: activeSession.stepSeq,
    retryCount: 0,
    startedAt: activeSession.startedAt,
    lastInboundAt: activeSession.lastInboundAt,
  };

  const inboundEvent: InboundEvent = {
    messageId,
    instanceId: instanceName,
    phone: cleanPhone,
    pushName,
    text: text || '',
    timestamp: now,
  };

  // 6. Execute Flow Step
  const stepResult = step(engineSession, flowDefinition, inboundEvent);

  // 7. Update Session State in DB
  await db.botSession.update({
    where: { id: activeSession.id },
    data: {
      status: stepResult.session.status,
      currentNodeId: stepResult.session.currentNodeId,
      vars: JSON.stringify(stepResult.session.vars),
      stepSeq: stepResult.session.stepSeq,
      lastInboundAt: new Date(),
      lastOutboundAt: stepResult.actions.length > 0 ? new Date() : undefined,
      endReason: stepResult.session.endReason || stepResult.haltReason,
    },
  });

  // Record Audit Event
  for (const log of stepResult.logs) {
    await db.botEvent.create({
      data: {
        sessionId: activeSession.id,
        stepSeq: stepResult.session.stepSeq,
        nodeId: log.nodeId,
        type: 'node_executed',
        output: JSON.stringify({ summary: log.summary, vars: log.vars }),
      },
    }).catch(() => {});
  }

  // 8. Execute Outbound Actions
  if (stepResult.actions.length > 0) {
    try {
      const client = await EvolutionClient.fromDatabase();

      for (const action of stepResult.actions) {
        if (action.type === 'send_text' && action.text) {
          // Humanized typing simulation delay
          if (action.typingDelayMs && action.typingDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(3000, action.typingDelayMs)));
          }

          await client.sendText(instanceName, cleanPhone, action.text);

          // Track in velocity limiter
          recentTimestamps.push(Date.now());
          contactReplyTracker.set(contactKey, recentTimestamps);

          // Save sent bot reply to incomingMessage table so it immediately reflects in the Replies Inbox!
          await db.incomingMessage.create({
            data: {
              messageId: `BOT_REPLY_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              instanceName: `${instanceName} (Bot)`,
              phone: cleanPhone,
              remoteJid: remoteJid || `${cleanPhone}@s.whatsapp.net`,
              pushName: 'Chatbot',
              body: action.text,
              status: 'READ',
              source: 'bot',
              botSessionId: activeSession.id,
              botNodeId: stepResult.session.currentNodeId,
              receivedAt: new Date(),
            },
          }).catch(() => {});
        } else if (action.type === 'send_media') {
          // Optional media send
          const mime = action.mediaType === 'image' ? 'image/jpeg' : action.mediaType === 'video' ? 'video/mp4' : action.mediaType === 'audio' ? 'audio/mp4' : 'application/pdf';
          await client.sendMedia(instanceName, cleanPhone, {
            mediaType: action.mediaType,
            mimetype: mime,
            media: action.mediaUrl,
            caption: action.caption,
            fileName: action.fileName,
          }).catch((err) => console.error('[BotRunner] Media send error:', err));
        } else if (action.type === 'handoff') {
          if (action.message) {
            await client.sendText(instanceName, cleanPhone, action.message);
          }
          // Mark in incomingMessage so agent sees the handoff banner
          await db.incomingMessage.create({
            data: {
              messageId: `BOT_HANDOFF_${Date.now()}`,
              instanceName,
              phone: cleanPhone,
              pushName: 'System',
              body: '🚨 Bot handed off conversation to Human Agent.',
              status: 'UNREAD',
              source: 'bot',
              receivedAt: new Date(),
            },
          }).catch(() => {});
        } else if (action.type === 'call_http') {
          const urlCheck = isSafeUrl(action.url);
          if (!urlCheck.safe) {
            logger.warn({ url: action.url, reason: urlCheck.reason }, '[BotRunner] Blocked unsafe outbound HTTP request (SSRF protection)');
          } else {
            try {
              const res = await fetch(action.url, {
                method: action.method || 'POST',
                headers: { 'Content-Type': 'application/json', ...(action.headers || {}) },
                body: action.body,
              });
              logger.info({ url: action.url, status: res.status }, '[BotRunner] Dispatched webhook HTTP action successfully');
            } catch (httpErr: any) {
              logger.error({ url: action.url, err: httpErr.message }, '[BotRunner] Outbound HTTP action failed');
            }
          }
        } else if (action.type === 'opt_out') {
          if (action.confirmationText) {
            await client.sendText(instanceName, cleanPhone, action.confirmationText);
          }
          await db.blacklist.upsert({
            where: { phone: cleanPhone },
            update: { reason: 'Opted out via chatbot flow', source: 'BOT_FLOW' },
            create: { phone: cleanPhone, reason: 'Opted out via chatbot flow', source: 'BOT_FLOW' },
          });
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message, instanceName, phone: cleanPhone }, 'Failed to dispatch bot reply via Evolution API');
    }
  }

  return true;
}
