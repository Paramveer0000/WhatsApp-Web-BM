export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api-wrapper';

export const GET = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const rawParam = decodeURIComponent(params.id || '');
  const cleanPhone = rawParam.replace(/[^\d]/g, '');

  // 1. Fetch Incoming Messages matching this phone
  const incoming = await db.incomingMessage.findMany({
    where: {
      OR: [
        { phone: rawParam },
        { phone: cleanPhone },
        { phone: `+${cleanPhone}` },
        ...(cleanPhone ? [{ remoteJid: { contains: cleanPhone } }] : [])
      ]
    },
    orderBy: { receivedAt: 'asc' },
  });

  // 2. Fetch Campaign Outgoing Messages matching this phone
  const recipientHistory = await db.campaignRecipient.findMany({
    where: {
      OR: [
        { phone: rawParam },
        { phone: cleanPhone },
        { phone: `+${cleanPhone}` }
      ]
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

  // 3. Attempt to fetch remote WhatsApp messages from open instance
  let waRemoteMessages: any[] = [];
  try {
    const openInstance = await db.instance.findFirst({
      where: { status: 'OPEN' },
    });

    if (openInstance && cleanPhone) {
      const client = await EvolutionClient.fromDatabase();
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;
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
            direction: fromMe ? 'OUTGOING' : 'INCOMING',
            type: fromMe ? 'outgoing' : 'incoming',
            text: text || '[Media / WhatsApp Message]',
            createdAt: ts.toISOString(),
            time: ts.toISOString(),
            sender: fromMe ? (openInstance.profileName || 'Me') : (m.pushName || cleanPhone),
            instance: openInstance.name,
            status: fromMe ? 'DELIVERED' : 'READ',
          };
        });
      }
    }
  } catch (err: any) {
    logger.warn({ err: err.message, phone: cleanPhone }, 'Could not pull remote WA messages');
  }

  // Combine and deduplicate chronological thread
  const thread: Array<{
    id: string;
    direction: 'INCOMING' | 'OUTGOING';
    type: 'incoming' | 'outgoing';
    text: string;
    createdAt: string;
    time: string;
    sender?: string;
    instance?: string;
    status?: string;
  }> = [];

  for (const m of incoming) {
    const isMe = m.instanceName?.includes('Me') || m.pushName === 'Me';
    thread.push({
      id: m.id,
      direction: isMe ? 'OUTGOING' : 'INCOMING',
      type: isMe ? 'outgoing' : 'incoming',
      text: m.body,
      createdAt: m.receivedAt.toISOString(),
      time: m.receivedAt.toISOString(),
      sender: m.pushName || (isMe ? 'Me' : cleanPhone),
      instance: m.instanceName,
      status: isMe ? 'SENT' : m.status,
    });
  }

  for (const r of recipientHistory) {
    if (r.renderedMessage) {
      thread.push({
        id: r.id,
        direction: 'OUTGOING',
        type: 'outgoing',
        text: r.renderedMessage,
        createdAt: r.sentAt ? r.sentAt.toISOString() : new Date().toISOString(),
        time: r.sentAt ? r.sentAt.toISOString() : new Date().toISOString(),
        sender: 'Campaign Broadcast',
        instance: r.instanceUsed || 'Evolution',
        status: r.status,
      });
    }
  }

  for (const w of waRemoteMessages) {
    if (!thread.some((t) => t.text === w.text && Math.abs(new Date(t.time).getTime() - new Date(w.time).getTime()) < 5000)) {
      thread.push(w);
    }
  }

  thread.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return NextResponse.json({
    success: true,
    phone: cleanPhone || rawParam,
    messages: thread
  });
});
