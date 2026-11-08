export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { step } from '@/lib/flow/engine';
import { EngineSession, InboundEvent, FlowDefinition } from '@/lib/flow/schema';
import { db } from '@/lib/db';

export const POST = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { session, inbound, customFlow } = body;

  let flow: FlowDefinition;

  if (customFlow) {
    flow = customFlow;
  } else {
    const bot = await db.flow.findUnique({
      where: { id: params.id },
      select: { currentDraft: true },
    });
    if (!bot) return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
    flow = JSON.parse(bot.currentDraft);
  }

  // Construct initial dry-run session if not provided
  const currentSession: EngineSession = session || {
    id: `sim_${Date.now()}`,
    flowId: params.id,
    instanceId: 'simulator',
    phone: '919876543210',
    status: 'active',
    currentNodeId: null,
    vars: {},
    stepSeq: 0,
    retryCount: 0,
    startedAt: new Date().toISOString(),
    lastInboundAt: new Date().toISOString(),
  };

  const currentInbound: InboundEvent | undefined = inbound ? {
    messageId: `sim_msg_${Date.now()}`,
    instanceId: 'simulator',
    phone: currentSession.phone,
    text: inbound.text || '',
    mediaType: inbound.mediaType,
    timestamp: Date.now(),
  } : undefined;

  // Run dry-run step
  const result = step(currentSession, flow, currentInbound);

  return NextResponse.json({
    success: true,
    result,
  });
});

