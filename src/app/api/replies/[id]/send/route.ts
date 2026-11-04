export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api-wrapper';

export const POST = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const rawPhone = decodeURIComponent(params.id || '');
  const cleanPhone = rawPhone.replace(/[^\d]/g, '');

  if (!cleanPhone) {
    return NextResponse.json({ success: false, error: 'Invalid recipient phone number' }, { status: 400 });
  }

  const body = await req.json();
  const text = (body.text || '').trim();
  let instanceName = (body.instanceName || '').trim();

  if (!text) {
    return NextResponse.json({ success: false, error: 'Reply text cannot be empty' }, { status: 400 });
  }

  // Find active instance if not specified
  if (!instanceName) {
    const activeInst = await db.instance.findFirst({
      where: { status: 'OPEN' },
    });
    if (!activeInst) {
      return NextResponse.json({ success: false, error: 'No active WhatsApp instance available to send reply' }, { status: 400 });
    }
    instanceName = activeInst.name;
  }

  const client = await EvolutionClient.fromDatabase();

  try {
    const sendRes = await client.sendText(instanceName, cleanPhone, text);

    // Save as local message for immediate chat history reflection
    await db.incomingMessage.create({
      data: {
        messageId: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        instanceName,
        remoteJid: `${cleanPhone}@s.whatsapp.net`,
        phone: cleanPhone,
        pushName: 'Me',
        body: text,
        receivedAt: new Date(),
        status: 'READ'
      }
    }).catch((dbErr) => {
      logger.warn({ dbErr }, 'Could not record sent reply in incomingMessage cache');
    });

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
      result: sendRes
    });
  } catch (sendErr: any) {
    logger.error({ sendErr, instanceName, cleanPhone }, 'Failed to send WhatsApp reply');
    return NextResponse.json({
      success: false,
      error: `Failed to send reply via ${instanceName}: ${sendErr.message}`
    }, { status: 502 });
  }
});
