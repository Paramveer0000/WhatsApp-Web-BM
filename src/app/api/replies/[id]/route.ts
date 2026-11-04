export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const rawId = decodeURIComponent(resolvedParams.id || '').trim();
    if (!rawId) {
      return NextResponse.json({ error: 'Conversation ID/phone is required' }, { status: 400 });
    }

    // Strip leading '+' or spaces
    const cleanPhone = rawId.replace(/[^\d]/g, '');

    // 1. Fetch incoming messages from DB
    const incoming = await db.incomingMessage.findMany({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: rawId },
        ],
      },
      orderBy: { receivedAt: 'asc' },
    });

    // 2. Fetch outgoing campaign recipient messages from DB
    const campaignSends = await db.campaignRecipient.findMany({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: rawId },
        ],
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
      },
      select: {
        id: true,
        renderedMessage: true,
        sentAt: true,
        status: true,
        instanceUsed: true,
      },
      orderBy: { sentAt: 'asc' },
    });

    // 3. If an open instance exists, optionally query Evolution API live messages
    let remoteMessages: any[] = [];
    try {
      const openInstance = await db.instance.findFirst({
        where: { status: 'OPEN' },
      });

      if (openInstance) {
        const client = await EvolutionClient.fromDatabase();
        const remoteJid = `${cleanPhone}@s.whatsapp.net`;
        const rawMsgs = await client.findMessages(openInstance.name, remoteJid, 1, 50).catch(() => []);

        if (Array.isArray(rawMsgs)) {
          remoteMessages = rawMsgs.map((m: any) => {
            const fromMe = Boolean(m.key?.fromMe);
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
              direction: fromMe ? 'OUTGOING' : 'INCOMING',
              text: text || '[WhatsApp Message]',
              createdAt: ts.toISOString(),
              sender: fromMe ? (openInstance.profileName || 'Me') : cleanPhone,
              status: fromMe ? 'DELIVERED' : 'READ',
            };
          }).filter((m: any) => Boolean(m.text));
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message, cleanPhone }, 'Failed to fetch live WA messages');
    }

    // 4. Combine into unified thread
    const threadMap = new Map<string, any>();

    // Add DB incoming
    for (const m of incoming) {
      const isMe = m.instanceName === 'Me' || m.pushName === 'Me';
      const key = `${m.body}_${new Date(m.receivedAt).getTime()}`;
      threadMap.set(key, {
        id: m.id,
        direction: isMe ? 'OUTGOING' : 'INCOMING',
        text: m.body,
        createdAt: m.receivedAt.toISOString(),
        sender: m.pushName || (isMe ? 'Me' : cleanPhone),
        status: isMe ? 'SENT' : m.status,
      });
    }

    // Add DB outgoing campaign sends
    for (const s of campaignSends) {
      if (s.renderedMessage) {
        const time = s.sentAt ? s.sentAt.toISOString() : new Date().toISOString();
        const key = `${s.renderedMessage}_${s.sentAt ? s.sentAt.getTime() : 0}`;
        if (!threadMap.has(key)) {
          threadMap.set(key, {
            id: s.id,
            direction: 'OUTGOING',
            text: s.renderedMessage,
            createdAt: time,
            sender: 'Campaign Broadcast',
            status: s.status,
          });
        }
      }
    }

    // Merge remote Evolution messages if not already present
    for (const rm of remoteMessages) {
      const key = `${rm.text}_${new Date(rm.createdAt).getTime()}`;
      if (!threadMap.has(key)) {
        threadMap.set(key, rm);
      }
    }

    // Sort chronologically (oldest to newest)
    const sortedThread = Array.from(threadMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      messages: sortedThread,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/replies/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
