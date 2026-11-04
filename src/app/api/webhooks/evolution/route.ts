export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { transitionMessage } from '@/lib/state-machine';
import { EvolutionClient, CircuitBreaker } from '@/lib/evolution';

function verifySecretConstantTime(given: string, expected: string): boolean {
  try {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params?: { instanceId?: string } } = {}) {
  try {
    // 1. Constant-time Secret Verification
    const secretHeader = req.headers.get('x-webhook-secret') || req.headers.get('apikey') || '';
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (expectedSecret && (!secretHeader || !verifySecretConstantTime(secretHeader, expectedSecret))) {
      logger.warn('Webhook secret verification failed');
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 });
    }

    const payload = await req.json();
    const event = (payload.event || '').toLowerCase();
    const instanceName =
      params?.instanceId || payload.instance || payload.instanceName || 'default';

    // 2. Compute Deduplication Key
    const msgId = payload.data?.key?.id || payload.data?.id || payload.messageId || '';
    const statusStr = (payload.data?.update?.status || payload.data?.status || '').toUpperCase();
    const ts = payload.date_time || payload.data?.messageTimestamp || Date.now();
    const dedupeKey = `${instanceName}_${event}_${msgId}_${statusStr}_${ts}`;

    // Fast deduplication check
    const existing = await db.webhookEvent.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });

    if (existing) {
      // Already processed, return 200 immediately
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Persist raw event to WebhookEvent table for audit & replay
    await db.webhookEvent.create({
      data: {
        instanceId: instanceName,
        dedupeKey,
        type: event,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      },
    });

    // 3. Connection Update Event
    if (event.includes('connection')) {
      const state = (payload.data?.state || payload.state || '').toUpperCase();
      if (state) {
        const normalized =
          state === 'OPEN' || state === 'CONNECTED'
            ? 'OPEN'
            : state === 'CONNECTING'
            ? 'CONNECTING'
            : 'CLOSE';

        await db.instance.updateMany({
          where: { name: instanceName },
          data: { status: normalized, circuitState: normalized === 'OPEN' ? 'closed' : 'open' },
        });

        if (normalized === 'OPEN') {
          CircuitBreaker.recordSuccess(instanceName);
        } else if (normalized === 'CLOSE') {
          CircuitBreaker.recordFailure(instanceName, true);
        }
      }
    }

    // 4. Message Delivery Status Update (Monotonic progression: SENT -> DELIVERED -> READ)
    if (event.includes('messages.update') || event.includes('messages_update')) {
      const updates = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
      for (const item of updates) {
        const id = item.key?.id || item.id;
        const st = (item.update?.status || item.status || '').toUpperCase();

        if (id && st) {
          const recipient = await db.campaignRecipient.findFirst({
            where: {
              OR: [{ evolutionMessageId: id }, { messageId: id }],
            },
            select: { id: true, status: true },
          });

          if (recipient) {
            if (st.includes('DELIVERY') || st === 'DELIVERED' || st === 'DELIVERY_ACK') {
              await transitionMessage(recipient.id, ['QUEUED', 'SENDING', 'SENT'], 'DELIVERED', {
                deliveredAt: new Date(),
              });
            } else if (st.includes('READ') || st === 'PLAYED') {
              await transitionMessage(
                recipient.id,
                ['QUEUED', 'SENDING', 'SENT', 'DELIVERED'],
                'READ',
                {
                  readAt: new Date(),
                }
              );
            }
          }
        }
      }
    }

    // 5. Inbound Messages & Auto Opt-Out (MESSAGES_UPSERT)
    if (event.includes('messages.upsert') || event.includes('messages_upsert')) {
      const msgData = payload.data?.message || payload.data;
      const key = payload.data?.key || {};

      // Only handle inbound messages from contacts (fromMe === false)
      if (key && !key.fromMe) {
        const remoteJid = key.remoteJid || '';
        // Skip group messages & broadcast statuses
        if (!remoteJid.includes('@g.us') && !remoteJid.includes('status@broadcast')) {
          const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/[^\d]/g, '');
          const messageId = key.id || `INC_${Date.now()}`;
          const pushName = payload.data?.pushName || null;

          let body = '';
          if (msgData?.conversation) body = msgData.conversation;
          else if (msgData?.extendedTextMessage?.text) body = msgData.extendedTextMessage.text;
          else if (msgData?.imageMessage?.caption) body = msgData.imageMessage.caption;
          else if (msgData?.buttonsResponseMessage?.selectedDisplayText)
            body = msgData.buttonsResponseMessage.selectedDisplayText;

          const cleanBody = (body || '').trim();
          const upperBody = cleanBody.toUpperCase();

          // Check Opt-Out Keywords
          const optOutKeywordsSetting = await db.setting.findUnique({
            where: { key: 'AUTO_OPT_OUT_KEYWORDS' },
          });
          const keywords = (
            optOutKeywordsSetting?.value || 'STOP,UNSUBSCRIBE,CANCEL,NO,RUKO,MAT BHEJO'
          )
            .split(',')
            .map((k) => k.trim().toUpperCase())
            .filter(Boolean);

          const isOptOut = keywords.some(
            (kw) => upperBody === kw || upperBody.startsWith(kw + ' ') || upperBody.endsWith(' ' + kw)
          );

          if (isOptOut && phone) {
            await db.blacklist.upsert({
              where: { phone },
              update: { reason: `Opt-out reply: "${cleanBody}"`, source: 'OPT_OUT' },
              create: { phone, reason: `Opt-out reply: "${cleanBody}"`, source: 'OPT_OUT' },
            });

            await db.contact.updateMany({
              where: { phone },
              data: { optInStatus: false, isBlacklisted: true, blacklistReason: 'Opt-out keyword' },
            });

            // Send polite automated confirmation if configured
            const confirmationSetting = await db.setting.findUnique({
              where: { key: 'AUTO_OPT_OUT_CONFIRMATION' },
            });
            const confirmationText =
              confirmationSetting?.value ||
              'You have been unsubscribed and will not receive further messages.';

            try {
              const evolution = await EvolutionClient.fromDatabase();
              await evolution.sendText(instanceName, phone, confirmationText, { delay: 1000 });
            } catch (replyErr: any) {
              logger.warn({ err: replyErr.message }, 'Failed to send opt-out confirmation message');
            }
          }

          // Save to IncomingMessage
          await db.incomingMessage.upsert({
            where: { messageId },
            update: { body: cleanBody, isOptOut },
            create: {
              messageId,
              instanceName,
              phone,
              pushName,
              body: cleanBody,
              status: isOptOut ? 'HANDLED' : 'UNREAD',
              isOptOut,
              remoteJid,
              receivedAt: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Error handling webhook');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
