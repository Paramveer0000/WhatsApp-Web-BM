import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { EvolutionClient } from '@/lib/evolution';

export async function POST(req: NextRequest) {
  try {
    // Optional secret verification
    const secretHeader = req.headers.get('x-webhook-secret') || req.headers.get('apikey');
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (expectedSecret && secretHeader && secretHeader !== expectedSecret) {
      logger.warn('Webhook secret mismatch');
      return NextResponse.json({ error: 'Unauthorized secret' }, { status: 401 });
    }

    const payload = await req.json();
    const event = (payload.event || '').toLowerCase();
    const instanceName = payload.instance || payload.instanceName || 'default';

    logger.debug({ event, instanceName }, 'Received Evolution API Webhook');

    // 1. Connection Update
    if (event === 'connection.update' || event === 'connection_update') {
      const state = (payload.data?.state || payload.state || '').toUpperCase();
      if (state) {
        const normalized = state === 'OPEN' || state === 'CONNECTED' ? 'OPEN' : (state === 'CONNECTING' ? 'CONNECTING' : 'CLOSE');
        await db.instance.updateMany({
          where: { name: instanceName },
          data: { status: normalized },
        });
      }
    }

    // 2. Message Delivery Status Update (Sent -> Delivered -> Read)
    if (event === 'messages.update' || event === 'messages_update') {
      const updates = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
      for (const item of updates) {
        const msgId = item.key?.id || item.id;
        const statusStr = (item.update?.status || item.status || '').toUpperCase();

        if (msgId && statusStr) {
          let newStatus: string | null = null;
          let isDelivered = false;
          let isRead = false;

          if (statusStr.includes('DELIVERY') || statusStr === 'DELIVERED') {
            newStatus = 'DELIVERED';
            isDelivered = true;
          } else if (statusStr.includes('READ') || statusStr === 'PLAYED') {
            newStatus = 'READ';
            isRead = true;
          }

          if (newStatus) {
            await db.campaignRecipient.updateMany({
              where: { messageId: msgId },
              data: {
                status: newStatus,
                deliveredAt: isDelivered ? new Date() : undefined,
                readAt: isRead ? new Date() : undefined,
              },
            });
          }
        }
      }
    }

    // 3. Incoming Replies & Auto Opt-Out (MESSAGES_UPSERT)
    if (event === 'messages.upsert' || event === 'messages_upsert') {
      const msgData = payload.data?.message || payload.data;
      const key = payload.data?.key || {};

      // Only handle incoming messages (fromMe === false)
      if (key && !key.fromMe) {
        const remoteJid = key.remoteJid || '';
        const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/[^\d]/g, '');
        const messageId = key.id || `INC_${Date.now()}`;
        const pushName = payload.data?.pushName || null;

        // Extract text body
        let body = '';
        if (msgData?.conversation) body = msgData.conversation;
        else if (msgData?.extendedTextMessage?.text) body = msgData.extendedTextMessage.text;
        else if (msgData?.imageMessage?.caption) body = msgData.imageMessage.caption;
        else if (msgData?.buttonsResponseMessage?.selectedDisplayText) body = msgData.buttonsResponseMessage.selectedDisplayText;

        const cleanBody = (body || '').trim();
        const upperBody = cleanBody.toUpperCase();

        // Check Opt-Out Keywords
        const optOutKeywordsSetting = await db.setting.findUnique({ where: { key: 'AUTO_OPT_OUT_KEYWORDS' } });
        const keywords = (optOutKeywordsSetting?.value || 'STOP,UNSUBSCRIBE,CANCEL,NO,RUKO,MAT BHEJO')
          .split(',')
          .map((k) => k.trim().toUpperCase())
          .filter(Boolean);

        const isOptOut = keywords.some((kw) => upperBody === kw || upperBody.startsWith(kw + ' '));

        // Save incoming message
        await db.incomingMessage.upsert({
          where: { messageId },
          update: { body: cleanBody, isOptOut },
          create: {
            messageId,
            instanceName,
            phone,
            pushName,
            body: cleanBody,
            isOptOut,
          },
        });

        // Mark recipient as REPLIED
        await db.campaignRecipient.updateMany({
          where: { phone, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
          data: { status: 'REPLIED' },
        });

        // If opt-out detected, blacklist phone and cancel pending campaign messages
        if (isOptOut) {
          logger.info({ phone, instanceName }, 'Auto opt-out triggered for phone');

          await db.blacklist.upsert({
            where: { phone },
            update: { reason: `Opt-out keyword "${cleanBody}" received via ${instanceName}` },
            create: {
              phone,
              reason: `Opt-out keyword "${cleanBody}" received via ${instanceName}`,
              source: 'OPT_OUT',
            },
          });

          await db.contact.updateMany({
            where: { phone },
            data: { isBlacklisted: true, blacklistReason: 'Auto opt-out keyword' },
          });

          // Cancel any pending queued recipient tasks
          await db.campaignRecipient.updateMany({
            where: { phone, status: 'PENDING' },
            data: { status: 'SKIPPED', lastError: 'Contact opted out' },
          });

          // Send confirmation if configured
          try {
            const confirmSetting = await db.setting.findUnique({ where: { key: 'AUTO_OPT_OUT_CONFIRMATION' } });
            if (confirmSetting?.value) {
              const client = await EvolutionClient.fromDatabase();
              await client.sendText(instanceName, phone, confirmSetting.value);
            }
          } catch {}
        }
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (err: any) {
    logger.error({ err }, 'Error handling webhook');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

