export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone, messages } = body;

    if (!phone || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'phone and messages array are required' }, { status: 400 });
    }

    let savedCount = 0;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const text = (m.text || '').trim();
      if (!text) continue;

      const receivedAt = m.date ? new Date(m.date) : new Date();
      const messageId = `UPLOAD_${phone}_${receivedAt.getTime()}_${i}`;

      try {
        await db.incomingMessage.upsert({
          where: { messageId },
          update: { body: text },
          create: {
            messageId,
            instanceName: m.isMe ? 'Uploaded Chat (Me)' : 'Uploaded Chat',
            phone,
            pushName: m.sender || (m.isMe ? 'Me' : 'Contact'),
            body: text,
            status: m.isMe ? 'HANDLED' : 'READ',
            receivedAt: isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
          },
        });
        savedCount++;
      } catch (err) {
        // Continue on duplicate
      }
    }

    logger.info({ phone, savedCount }, 'Uploaded chat history saved');
    return NextResponse.json({ success: true, count: savedCount });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/replies/upload-chat');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
