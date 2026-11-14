import { db, ensureDbSchema } from '@/lib/db';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { getRandomDialogue, resolveSpintax } from './dialogues';
import { generateDynamicWarmerTurn } from './dynamic-generator';

export interface WarmerMessageLogItem {
  sender: 'A' | 'B';
  instance: string;
  phone: string;
  text: string;
  timestamp: string;
}

export interface WarmerExchangeLog {
  id: string;
  timestamp: string;
  topic: string;
  instanceA: string;
  instanceB: string;
  phoneA: string;
  phoneB: string;
  messageA: string;
  messageB: string;
  messages?: WarmerMessageLogItem[];
  delaySeconds: number;
  status: 'DELIVERED' | 'FAILED';
  source?: 'ai_dynamic' | 'time_contextual' | 'smart_spintax';
  error?: string;
}

// Clean phone number to E.164 without @s.whatsapp.net
function cleanPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits : null;
}

// Helper to look up connected phone number for an instance (checks local DB cache first)
async function resolveInstancePhone(instanceName: string): Promise<string | null> {
  try {
    // 1. Check local db.instance record first for instant, reliable resolution
    const local = await db.instance.findFirst({
      where: {
        OR: [
          { name: instanceName },
          { id: instanceName },
        ],
      },
      select: { profileNumber: true },
    });
    if (local?.profileNumber) {
      const cleaned = cleanPhone(local.profileNumber);
      if (cleaned) return cleaned;
    }

    // 2. Query Evolution API if not cached locally
    const evo = await EvolutionClient.fromDatabase();
    const instances = await evo.fetchInstances();
    const target = instances.find(
      (i: any) =>
        i.name?.toLowerCase() === instanceName.toLowerCase() ||
        i.id?.toLowerCase() === instanceName.toLowerCase()
    );

    if (!target) return null;

    // Check common Evolution API phone metadata locations
    const rawNumber =
      target.ownerJid ||
      target.owner ||
      target.number ||
      target.phone ||
      target.connectionStatus?.phoneNumber;

    const cleaned = cleanPhone(rawNumber);
    if (cleaned) {
      // Cache back to db.instance for faster future turns
      await db.instance.updateMany({
        where: { name: instanceName },
        data: { profileNumber: cleaned },
      }).catch(() => {});
    }
    return cleaned;
  } catch (err: any) {
    logger.warn({ err: err.message, instanceName }, 'Failed to resolve instance phone');
    return null;
  }
}

// Helper to detect if an incoming message is between internal instances or an active Number Warmer session
export async function isWarmerOrInternalMessage(params: {
  instanceName: string;
  phone: string;
  remoteJid?: string;
}): Promise<boolean> {
  try {
    const rawDigits = (params.phone || '').replace(/[^0-9]/g, '');
    const last10 = rawDigits.slice(-10);
    if (!last10 || last10.length < 7) return false;

    // 1. Is the sender phone number another internal instance owned in db.instance?
    const internalInstance = await db.instance.findFirst({
      where: {
        profileNumber: { contains: last10 },
      },
      select: { id: true, name: true },
    });
    if (internalInstance) return true;

    // 2. Is the sender phone or instance part of any active/paused Number Warmer session?
    const warmerSession = await db.numberWarmerSession.findFirst({
      where: {
        status: { in: ['RUNNING', 'ACTIVE', 'PAUSED'] },
        OR: [
          { phoneA: { contains: last10 } },
          { phoneB: { contains: last10 } },
          { instanceA: params.instanceName },
          { instanceB: params.instanceName },
        ],
      },
      select: { id: true, instanceA: true, instanceB: true, phoneA: true, phoneB: true },
    });

    if (warmerSession) {
      const matchA = warmerSession.phoneA && warmerSession.phoneA.includes(last10);
      const matchB = warmerSession.phoneB && warmerSession.phoneB.includes(last10);
      if (
        matchA ||
        matchB ||
        warmerSession.instanceA === params.instanceName ||
        warmerSession.instanceB === params.instanceName
      ) {
        return true;
      }
    }

    return false;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Error checking isWarmerOrInternalMessage');
    return false;
  }
}

// Execute 1 complete two-way dialogue exchange between Instance A and Instance B
export async function executeWarmerTurn(sessionId: string): Promise<{
  success: boolean;
  log?: WarmerExchangeLog;
  error?: string;
}> {
  await ensureDbSchema();

  const session = await db.numberWarmerSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { success: false, error: 'Warmer session not found' };
  }

  if (session.todayExchanges >= session.dailyCap) {
    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    });
    return { success: false, error: 'Daily exchange target reached for today' };
  }

  // 1. Resolve phone numbers if missing
  let phoneA = session.phoneA || (await resolveInstancePhone(session.instanceA));
  let phoneB = session.phoneB || (await resolveInstancePhone(session.instanceB));

  if (!phoneA || !phoneB) {
    const missing = !phoneA && !phoneB ? 'both instances' : !phoneA ? session.instanceA : session.instanceB;
    const errorMsg = `Unable to detect registered phone number for ${missing}. Please ensure both WhatsApp accounts are paired & online.`;
    
    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: { status: 'PAUSED' },
    });

    return { success: false, error: errorMsg };
  }

  // 2. Parse past dialogue exchanges for conversational context
  let previousLogs: WarmerExchangeLog[] = [];
  try {
    previousLogs = JSON.parse(session.logs || '[]');
  } catch {
    previousLogs = [];
  }

  // 3. Dynamically generate contextual dialogue (AI LLM or Smart Organic Engine)
  const turn = await generateDynamicWarmerTurn({
    topic: session.topic || 'casual',
    useAi: Boolean(session.useAi),
    aiPrompt: session.aiPrompt,
    clientId: session.clientId,
    historyLogs: previousLogs.map((l) => ({
      messageA: l.messageA,
      messageB: l.messageB,
      topic: l.topic,
      timestamp: l.timestamp,
    })),
  });

  const messagesToSend = (turn.messages && turn.messages.length > 0)
    ? turn.messages
    : [
        { sender: 'A' as const, text: turn.messageA },
        { sender: 'B' as const, text: turn.messageB },
      ];

  const randomDelay = Math.floor(
    Math.random() * (session.maxDelaySeconds - session.minDelaySeconds + 1) + session.minDelaySeconds
  );

  const loggedMessages: WarmerMessageLogItem[] = [];

  const logEntry: WarmerExchangeLog = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    topic: turn.topicTitle || session.topic,
    instanceA: session.instanceA,
    instanceB: session.instanceB,
    phoneA,
    phoneB,
    messageA: turn.messageA,
    messageB: turn.messageB,
    messages: loggedMessages,
    delaySeconds: randomDelay,
    status: 'DELIVERED',
    source: turn.source,
  };

  try {
    const evo = await EvolutionClient.fromDatabase();

    // Sequentially send each message in the conversation thread with human typing & reading cadence
    for (let i = 0; i < messagesToSend.length; i++) {
      const item = messagesToSend[i];
      const isSenderA = item.sender === 'A';
      const fromInstance = isSenderA ? session.instanceA : session.instanceB;
      const toPhone = isSenderA ? phoneB : phoneA;
      const fromPhone = isSenderA ? phoneA : phoneB;

      // Typing presence (composing)
      try {
        await evo.sendPresence(fromInstance, toPhone, 'composing', 2000);
      } catch {}

      // Send message
      await evo.sendText(fromInstance, toPhone, item.text, { delay: 1500 });

      loggedMessages.push({
        sender: item.sender,
        instance: fromInstance,
        phone: fromPhone,
        text: item.text,
        timestamp: new Date().toISOString(),
      });

      // Human reading & thinking pause before the other person types back (unless last message)
      if (i < messagesToSend.length - 1) {
        const thinkMs = Math.floor(Math.random() * 2500 + 3500); // 3.5s - 6s
        await new Promise((res) => setTimeout(res, thinkMs));
      }
    }

    // 5. Update session history and scheduling
    let currentLogs: WarmerExchangeLog[] = [];
    try {
      currentLogs = JSON.parse(session.logs || '[]');
    } catch {
      currentLogs = [];
    }

    // Keep last 50 logs for live UI stream
    const updatedLogs = [logEntry, ...currentLogs].slice(0, 50);
    const nextScheduled = new Date(Date.now() + randomDelay * 1000);

    const nextCount = session.todayExchanges + 1;
    const nextStatus = nextCount >= session.dailyCap ? 'COMPLETED' : session.status;

    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: {
        phoneA,
        phoneB,
        todayExchanges: nextCount,
        status: nextStatus,
        lastExchangedAt: new Date(),
        nextScheduledAt: nextScheduled,
        logs: JSON.stringify(updatedLogs),
      },
    });

    logger.info(
      {
        sessionId,
        instanceA: session.instanceA,
        instanceB: session.instanceB,
        count: nextCount,
        delay: randomDelay,
        threadMessagesCount: loggedMessages.length,
      },
      'Warmer continuous conversation exchange turn executed successfully'
    );

    return { success: true, log: logEntry };
  } catch (err: any) {
    logger.error({ err: err.message, sessionId }, 'Warmer turn failed');
    logEntry.status = 'FAILED';
    logEntry.error = err.message || 'WhatsApp message dispatch failed';

    let currentLogs: WarmerExchangeLog[] = [];
    try {
      currentLogs = JSON.parse(session.logs || '[]');
    } catch {}
    const updatedLogs = [logEntry, ...currentLogs].slice(0, 50);

    // Reschedule retry after 60s so session does not permanently stall
    const retryScheduled = new Date(Date.now() + 60 * 1000);

    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: {
        nextScheduledAt: retryScheduled,
        logs: JSON.stringify(updatedLogs),
      },
    });

    return { success: false, log: logEntry, error: err.message };
  }
}
