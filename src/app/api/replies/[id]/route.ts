export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api-wrapper';
import { isTenantScoped, getTenantAllowedInstanceNames } from '@/lib/tenant';

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
  return '';
}

export const GET = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const allowedInstances = await getTenantAllowedInstanceNames(user);
  if (allowedInstances !== null && allowedInstances.length === 0) {
    return NextResponse.json({ success: true, messages: [] });
  }

  const { searchParams } = new URL(req.url);
  const requestedInstance = searchParams.get('instanceName');
  if (requestedInstance && allowedInstances !== null && !allowedInstances.includes(requestedInstance)) {
    return NextResponse.json({ success: false, error: 'Forbidden instance' }, { status: 403 });
  }

  const rawParam = decodeURIComponent(params.id || '');
  const cleanPhone = rawParam.replace(/[^\d]/g, '');

  // 1. Fetch Incoming Messages matching this phone
  const incomingWhere: any = {
    OR: [
      { phone: rawParam },
      { phone: cleanPhone },
      { phone: `+${cleanPhone}` },
      ...(cleanPhone ? [{ remoteJid: { contains: cleanPhone } }] : [])
    ]
  };
  if (allowedInstances !== null) {
    incomingWhere.instanceName = { in: allowedInstances };
  }

  const incoming = await db.incomingMessage.findMany({
    where: incomingWhere,
    orderBy: { receivedAt: 'asc' },
  });

  // 2. Fetch Campaign Outgoing Messages matching this phone
  const recipientWhere: any = {
    OR: [
      { phone: rawParam },
      { phone: cleanPhone },
      { phone: `+${cleanPhone}` }
    ]
  };
  if (allowedInstances !== null) {
    recipientWhere.instanceUsed = { in: allowedInstances };
  }

  const recipientHistory = await db.campaignRecipient.findMany({
    where: recipientWhere,
    select: {
      id: true,
      renderedMessage: true,
      sentAt: true,
      status: true,
      instanceUsed: true,
    },
    orderBy: { sentAt: 'asc' },
  });

  // 3. Attempt to fetch remote WhatsApp messages from Evolution API
  let waRemoteMessages: any[] = [];
  try {
    let targetInstanceName: string | undefined = requestedInstance || undefined;
    if (!targetInstanceName || targetInstanceName === 'ALL') {
      const openInstance = await db.instance.findFirst({
        where: {
          status: 'OPEN',
          ...(allowedInstances !== null ? { name: { in: allowedInstances } } : {})
        },
      });
      targetInstanceName = openInstance?.name;
    }

    if (targetInstanceName && cleanPhone) {
      const client = await EvolutionClient.fromDatabase();
      const remoteJids = [`${cleanPhone}@s.whatsapp.net`, `${cleanPhone}@c.us`];

      for (const rJid of remoteJids) {
        const rawMsgs = await client.findMessages(targetInstanceName, rJid, 1, 50);

        if (Array.isArray(rawMsgs) && rawMsgs.length > 0) {
          for (const m of rawMsgs) {
            const fromMe = m.key?.fromMe ?? false;
            const text = extractMessageText(m);
            const ts = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000) : new Date();

            waRemoteMessages.push({
              id: m.key?.id || `WA_${Math.random()}`,
              direction: fromMe ? 'OUTGOING' : 'INCOMING',
              type: fromMe ? 'outgoing' : 'incoming',
              text: text || '[WhatsApp Message]',
              createdAt: ts.toISOString(),
              time: ts.toISOString(),
              sender: fromMe ? 'Me' : (m.pushName || cleanPhone),
              instance: targetInstanceName,
              status: fromMe ? 'DELIVERED' : 'READ',
            });
          }
          break; // Found messages with this JID, no need to probe next JID
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err.message, phone: cleanPhone }, 'Could not pull remote WA messages');
  }

  // Combine and deduplicate chronological thread
  let thread: Array<{
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

  // If we have real messages in the thread, remove any dummy "WhatsApp Chat" placeholder bubble
  if (thread.length > 1 && thread.some((t) => t.text !== 'WhatsApp Chat')) {
    thread = thread.filter((t) => t.text !== 'WhatsApp Chat');
  }

  thread.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Resolve Contact Name & Metadata
  const candidatePhones = Array.from(new Set([rawParam, cleanPhone, `+${cleanPhone}`].filter(Boolean)));
  const [dbContact, dbRec] = await Promise.all([
    db.contact.findFirst({
      where: { phone: { in: candidatePhones } },
      select: { name: true, customFields: true }
    }),
    db.campaignRecipient.findFirst({
      where: { phone: { in: candidatePhones } },
      select: { name: true }
    })
  ]);

  let company: string | null = null;
  if (dbContact?.customFields) {
    try {
      const cv = typeof dbContact.customFields === 'string' ? JSON.parse(dbContact.customFields) : dbContact.customFields;
      company = cv.company || cv.org || null;
    } catch {}
  }

  const contactName = dbContact?.name || dbRec?.name || null;
  const pushNameMsg = incoming.find(m => m.pushName && m.pushName !== 'Me');
  const pushName = pushNameMsg?.pushName || null;
  const displayName = contactName || pushName || (cleanPhone ? `+${cleanPhone}` : rawParam);

  return NextResponse.json({
    success: true,
    phone: cleanPhone || rawParam,
    contactName,
    pushName,
    displayName,
    company,
    messages: thread
  });
});
