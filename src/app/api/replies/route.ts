export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api-wrapper';

function extractMessageText(msgObj: any): string {
  if (!msgObj) return '';
  if (typeof msgObj === 'string') return msgObj;
  const m = msgObj.message || msgObj;
  if (!m) return '';

  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.documentMessage?.fileName) return `📄 ${m.documentMessage.fileName}`;
  if (m.imageMessage) return '📷 [Image]';
  if (m.videoMessage) return '🎥 [Video]';
  if (m.audioMessage) return '🎵 [Audio]';
  if (m.stickerMessage) return '🏷️ [Sticker]';
  if (m.contactMessage?.displayName) return `👤 ${m.contactMessage.displayName}`;
  if (m.locationMessage) return '📍 [Location]';
  if (msgObj.body) return msgObj.body;
  if (msgObj.text) return msgObj.text;
  return 'WhatsApp Message';
}

export const GET = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone');
  const instanceName = searchParams.get('instanceName');
  const syncParam = searchParams.get('sync') === 'true';

  // 1. Single Conversation Detail (legacy query param support)
  if (phone) {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const incoming = await db.incomingMessage.findMany({
      where: {
        OR: [
          { phone },
          { phone: cleanPhone },
          { phone: `+${cleanPhone}` }
        ]
      },
      orderBy: { receivedAt: 'asc' },
    });

    const thread = incoming.map((m) => {
      const isMe = m.instanceName?.includes('Me') || m.pushName === 'Me';
      return {
        id: m.id,
        direction: isMe ? 'OUTGOING' : 'INCOMING',
        type: isMe ? 'outgoing' : 'incoming',
        text: m.body,
        time: m.receivedAt.toISOString(),
        createdAt: m.receivedAt.toISOString(),
        sender: m.pushName || (isMe ? 'Me' : phone),
        instance: m.instanceName,
        status: isMe ? 'SENT' : m.status,
      };
    });

    return NextResponse.json({ success: true, messages: thread });
  }

  // 2. Fetch conversations list
  // If instanceName is provided, filter by that instance; otherwise fetch all
  const whereClause: any = {};
  if (instanceName && instanceName !== 'ALL') {
    whereClause.OR = [
      { instanceName },
      { instanceName: { startsWith: `${instanceName} (` } }
    ];
  }

  // Check if we need to auto-sync for this instance from Evolution API
  if (instanceName && instanceName !== 'ALL') {
    const existingCount = await db.incomingMessage.count({ where: whereClause });
    if (existingCount === 0 || syncParam) {
      try {
        const client = await EvolutionClient.fromDatabase();
        const chats = await client.findChats(instanceName);
        for (const c of chats) {
          const rawId = c.id || c.remoteJid || '';
          if (!rawId || rawId.includes('@g.us')) continue; // skip group chats

          const cleanP = rawId.replace(/@s\.whatsapp\.net|@c\.us/g, '').replace(/[^0-9]/g, '');
          if (!cleanP) continue;

          const text = extractMessageText(c.lastMessage);
          const ts = c.lastMessage?.messageTimestamp
            ? new Date(Number(c.lastMessage.messageTimestamp) * 1000)
            : new Date();

          await db.incomingMessage.upsert({
            where: { messageId: `WA_CHAT_${instanceName}_${cleanP}` },
            update: {
              body: text || 'WhatsApp Chat',
              pushName: c.name || c.pushName || null,
              receivedAt: ts,
            },
            create: {
              messageId: `WA_CHAT_${instanceName}_${cleanP}`,
              instanceName,
              phone: cleanP,
              remoteJid: rawId,
              pushName: c.name || c.pushName || null,
              body: text || 'WhatsApp Chat',
              status: 'READ',
              receivedAt: ts,
            },
          });
        }
      } catch (err: any) {
        logger.warn({ err: err.message, instanceName }, 'Auto-sync from Evolution API failed');
      }
    }
  }

  // Retrieve conversation list from DB
  const recentMessages = await db.incomingMessage.findMany({
    where: whereClause,
    orderBy: { receivedAt: 'desc' },
    take: 500,
  });

  const contactMap = new Map<string, any>();
  for (const msg of recentMessages) {
    if (!contactMap.has(msg.phone)) {
      contactMap.set(msg.phone, {
        id: msg.phone,
        phone: msg.phone,
        pushName: msg.pushName,
        instanceName: msg.instanceName,
        lastMessage: msg.body,
        lastReceivedAt: msg.receivedAt,
        status: msg.status,
        isOptOut: msg.isOptOut,
      });
    }
  }

  return NextResponse.json({
    success: true,
    conversations: Array.from(contactMap.values()),
    instanceFiltered: instanceName || 'ALL'
  });
});

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { phone, text, instanceName, clearOld, sync } = body;

  // Option A: Clear old/disconnected chats
  if (clearOld) {
    let deletedCount = 0;
    if (instanceName && instanceName !== 'ALL') {
      const res = await db.incomingMessage.deleteMany({
        where: {
          NOT: {
            OR: [
              { instanceName },
              { instanceName: { startsWith: `${instanceName} (` } }
            ]
          }
        }
      });
      deletedCount = res.count;
    } else {
      const res = await db.incomingMessage.deleteMany({});
      deletedCount = res.count;
    }
    return NextResponse.json({ success: true, message: `Cleared ${deletedCount} old messages` });
  }

  // Option B: Sync Chats from Evolution API
  if (instanceName && !text) {
    const client = await EvolutionClient.fromDatabase();
    let syncedChatsCount = 0;
    let syncedMsgsCount = 0;

    try {
      const chats = await client.findChats(instanceName);

      for (const c of chats) {
        const rawId = c.id || c.remoteJid || '';
        if (!rawId || rawId.includes('@g.us')) continue; // skip group chats

        const cleanPhone = rawId.replace(/@s\.whatsapp\.net|@c\.us/g, '').replace(/[^0-9]/g, '');
        if (!cleanPhone) continue;

        const lastText = extractMessageText(c.lastMessage);
        const ts = c.lastMessage?.messageTimestamp
          ? new Date(Number(c.lastMessage.messageTimestamp) * 1000)
          : new Date();

        await db.incomingMessage.upsert({
          where: { messageId: `WA_CHAT_${instanceName}_${cleanPhone}` },
          update: {
            body: lastText || 'WhatsApp Chat',
            pushName: c.name || c.pushName || null,
            receivedAt: ts,
          },
          create: {
            messageId: `WA_CHAT_${instanceName}_${cleanPhone}`,
            instanceName,
            phone: cleanPhone,
            remoteJid: rawId,
            pushName: c.name || c.pushName || null,
            body: lastText || 'WhatsApp Chat',
            status: 'READ',
            receivedAt: ts,
          },
        });
        syncedChatsCount++;

        // Pull up to 15 recent messages for this chat so thread is not empty
        try {
          const rawMsgs = await client.findMessages(instanceName, `${cleanPhone}@s.whatsapp.net`, 1, 15);
          for (const m of rawMsgs) {
            const mId = m.key?.id;
            if (!mId) continue;
            const fromMe = m.key?.fromMe ?? false;
            const mBody = extractMessageText(m);
            const mTs = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000) : new Date();

            await db.incomingMessage.upsert({
              where: { messageId: `WA_MSG_${instanceName}_${mId}` },
              update: {
                body: mBody || 'Message',
                receivedAt: mTs
              },
              create: {
                messageId: `WA_MSG_${instanceName}_${mId}`,
                instanceName: fromMe ? `${instanceName} (Me)` : instanceName,
                phone: cleanPhone,
                remoteJid: `${cleanPhone}@s.whatsapp.net`,
                pushName: fromMe ? 'Me' : (c.name || c.pushName || cleanPhone),
                body: mBody || 'Message',
                status: 'READ',
                receivedAt: mTs
              }
            }).catch(() => {});
            syncedMsgsCount++;
          }
        } catch {
          // non-fatal per-chat message history fetch
        }
      }

      return NextResponse.json({
        success: true,
        syncedChats: syncedChatsCount,
        syncedMessages: syncedMsgsCount,
        message: `Synced ${syncedChatsCount} chats from WhatsApp instance ${instanceName}`
      });
    } catch (syncErr: any) {
      logger.error({ syncErr, instanceName }, 'Failed to sync chats in POST /api/replies');
      return NextResponse.json({
        success: false,
        error: `Could not sync chats from Evolution API for ${instanceName}: ${syncErr.message}`
      }, { status: 502 });
    }
  }

  // Option C: Send Manual Reply
  if (phone && text && instanceName) {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const client = await EvolutionClient.fromDatabase();
    const result = await client.sendText(instanceName, cleanPhone, text);

    // Save sent reply to incomingMessage table as outgoing (Me)
    const messageId = `REPLY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db.incomingMessage.create({
      data: {
        messageId,
        instanceName: `${instanceName} (Me)`,
        phone: cleanPhone,
        remoteJid: `${cleanPhone}@s.whatsapp.net`,
        pushName: 'Me',
        body: text,
        status: 'HANDLED',
        receivedAt: new Date(),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, result });
  }

  return NextResponse.json({ success: false, error: 'Invalid request payload' }, { status: 400 });
});

export const DELETE = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const instanceName = searchParams.get('instanceName');

  let where: any = {};
  if (instanceName && instanceName !== 'ALL') {
    where = {
      NOT: {
        OR: [
          { instanceName },
          { instanceName: { startsWith: `${instanceName} (` } }
        ]
      }
    };
  }

  const deleted = await db.incomingMessage.deleteMany({ where });
  return NextResponse.json({ success: true, deleted: deleted.count });
});
