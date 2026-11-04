export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const rawId = decodeURIComponent(resolvedParams.id || '').trim();
    const cleanPhone = rawId.replace(/[^\d]/g, '');

    const body = await req.json();
    const text = (body.text || '').trim();
    let instanceName = body.instanceName;

    if (!cleanPhone || !text) {
      return NextResponse.json({ error: 'Phone number and reply text are required' }, { status: 400 });
    }

    // If instanceName was not provided, find any connected/open instance
    if (!instanceName) {
      const openInst = await db.instance.findFirst({
        where: { status: 'OPEN' },
      });
      instanceName = openInst?.name;
    }

    if (!instanceName) {
      return NextResponse.json({ error: 'No connected WhatsApp instance found to dispatch reply' }, { status: 400 });
    }

    const client = await EvolutionClient.fromDatabase();

    // Send through Evolution API
    const dispatchResult = await client.sendText(instanceName, cleanPhone, text);

    // Save outgoing message to DB
    const savedMsg = await db.incomingMessage.create({
      data: {
        messageId: `OUT_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        instanceName: 'Me',
        phone: cleanPhone,
        pushName: 'Me',
        body: text,
        status: 'SENT',
        receivedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: savedMsg,
      evolutionResult: dispatchResult,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error sending WhatsApp reply');
    return NextResponse.json({ error: err.message || 'Failed to dispatch reply' }, { status: 500 });
  }
}
