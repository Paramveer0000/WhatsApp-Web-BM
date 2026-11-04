export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const syncParam = searchParams.get('sync') === 'true';

    // 1. Single Conversation Detail
    if (phone) {
      // Incoming messages
      const incoming = await db.incomingMessage.findMany({
        where: { phone },
        orderBy: { receivedAt: 'asc' },
      });

      // Campaign outgoing messages
      const recipientHistory = await db.campaignRecipient.findMany({
        where: { phone },
        select: {
          id: true,
          renderedMessage: true,
          sentAt: true,
          status: true,
          instanceUsed: true,
        },
        orderBy: { sentAt: 'asc' },
      });

      // If open instance exists, also fetch messages directly from Evolution API
      let waRemoteMessages: any[] = [];
      try {
        const openInstance = await db.instance.findFirst({
          where: { status: 'OPEN' },
        });

        if (openInstance) {
          const client = await EvolutionClient.fromDatabase();
          const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
          const rawMsgs = await client.findMessages(openInstance.name, remoteJid, 1, 50);

          if (Array.isArray(rawMsgs)) {
            waRemoteMessages = rawMsgs.map((m: any) => {
              const fromMe = m.key?.fromMe ?? false;
              const text =
                m.message?.conversation ||
                m.message?.extendedTextMessage?.text ||
                m.message?.imageMessage?.caption ||
                m.message?.videoMessage?.caption ||
                m.message?.documentMessage?.fileName ||
                '';
              const ts = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000) : new Date();

              return {
                id: m.key?.id || `WA_${Math.random()}`,
                type: fromMe ? 'outgoing' : 'incoming',
                text: text || '[Media / WhatsApp Message]',
                time: ts.toISOString(),
                sender: fromMe ? (openInstance.profileName || 'Me') : (m.pushName || phone),
                instance: openInstance.name,
                status: fromMe ? 'DELIVERED' : 'READ',
              };
            });
          }
        }
      } catch (err: any) {
        logger.warn({ err: err.message, phone }, 'Could not pull remote WA messages');
      }

      // Combine and unify into a clean chronological thread
      const thread: Array<{
        id: string;
        type: 'incoming' | 'outgoing';
        text: string;
        time: string;
        sender?: string;
        instance?: string;
        status?: string;
      }> = [];

      for (const m of incoming) {
        const isMe = m.instanceName?.includes('Me') || m.pushName === 'Me';
        thread.push({
          id: m.id,
          type: isMe ? 'outgoing' : 'incoming',
          text: m.body,
          time: m.receivedAt.toISOString(),
          sender: m.pushName || (isMe ? 'Me' : phone),
          instance: m.instanceName,
          status: isMe ? 'SENT' : m.status,
        });
      }

      for (const r of recipientHistory) {
        if (r.renderedMessage) {
          thread.push({
            id: r.id,
            type: 'outgoing',
            text: r.renderedMessage,
            time: (r.sentAt || new Date()).toISOString(),
            sender: r.instanceUsed || 'Campaign Broadcast',
            instance: r.instanceUsed || undefined,
            status: r.status,
          });
        }
      }

      for (const rm of waRemoteMessages) {
        // Prevent duplicate text/timestamp entries
        const exists = thread.some(
          (t) => t.text === rm.text && Math.abs(new Date(t.time).getTime() - new Date(rm.time).getTime()) < 3000
        );
        if (!exists) {
          thread.push(rm);
        }
      }

      // Sort by time ascending
      thread.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      return NextResponse.json({ success: true, messages: thread });
    }

    // 2. Conversation Inbox List (All chats)
    const openInstances = await db.instance.findMany({
      where: { status: 'OPEN' },
    });

    // Auto-sync or manual sync from Evolution API if requested or empty
    const localCount = await db.incomingMessage.count();
    if ((syncParam || localCount === 0) && openInstances.length > 0) {
      try {
        const client = await EvolutionClient.fromDatabase();
        for (const inst of openInstances) {
          const chats = await client.findChats(inst.name);
          for (const c of chats) {
            const rawId = c.id || c.remoteJid || '';
            if (!rawId || rawId.includes('@g.us')) continue; // skip group chats

            const cleanPhone = rawId.replace(/@s\.whatsapp\.net|@c\.us/g, '').replace(/[^0-9]/g, '');
            if (!cleanPhone) continue;

            const lastText =
              c.lastMessage?.message?.conversation ||
              c.lastMessage?.message?.extendedTextMessage?.text ||
              c.lastMessage?.message?.imageMessage?.caption ||
              c.lastMessage?.text ||
              'WhatsApp Chat';

            const ts = c.lastMessage?.messageTimestamp
              ? new Date(Number(c.lastMessage.messageTimestamp) * 1000)
              : new Date();

            await db.incomingMessage.upsert({
              where: { messageId: `WA_CHAT_${inst.name}_${cleanPhone}` },
              update: {
                body: lastText,
                pushName: c.name || c.pushName || null,
                receivedAt: ts,
              },
              create: {
                messageId: `WA_CHAT_${inst.name}_${cleanPhone}`,
                instanceName: inst.name,
                phone: cleanPhone,
                pushName: c.name || c.pushName || null,
                body: lastText,
                status: 'READ',
                receivedAt: ts,
              },
            });
          }
        }
      } catch (syncErr: any) {
        logger.warn({ err: syncErr.message }, 'Failed to sync chats from Evolution API');
      }
    }

    // Retrieve conversation list from DB
    const recentMessages = await db.incomingMessage.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 300,
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

    // Also include recipients from campaigns if not already in contactMap
    const campaignContacts = await db.campaignRecipient.findMany({
      where: { status: { in: ['SENT', 'DELIVERED', 'READ'] } },
      select: {
        phone: true,
        name: true,
        renderedMessage: true,
        sentAt: true,
        instanceUsed: true,
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    for (const cr of campaignContacts) {
      if (!contactMap.has(cr.phone)) {
        contactMap.set(cr.phone, {
          id: cr.phone,
          phone: cr.phone,
          pushName: cr.name,
          instanceName: cr.instanceUsed || 'Campaign Broadcast',
          lastMessage: cr.renderedMessage || 'Campaign message sent',
          lastReceivedAt: cr.sentAt || new Date(),
          status: 'SENT',
          isOptOut: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      conversations: Array.from(contactMap.values()),
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/replies');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone, text, instanceName } = body;

    if (!phone || !text || !instanceName) {
      return NextResponse.json({ error: 'phone, text, and instanceName are required' }, { status: 400 });
    }

    const client = await EvolutionClient.fromDatabase();
    const result = await client.sendText(instanceName, phone, text);

    // Save sent reply to incomingMessage table as outgoing (Me)
    try {
      const messageId = `REPLY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await db.incomingMessage.create({
        data: {
          messageId,
          instanceName: `${instanceName} (Me)`,
          phone,
          pushName: 'Me',
          body: text,
          status: 'HANDLED',
          receivedAt: new Date(),
        },
      });

      // Mark any prior messages from this contact as HANDLED
      await db.incomingMessage.updateMany({
        where: { phone, status: 'UNREAD' },
        data: { status: 'HANDLED' },
      });
    } catch (saveErr) {
      // non-fatal
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    logger.error({ err }, 'Error sending manual reply');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
