export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { validateFlow } from '@/lib/flow/validate';
import { FlowDefinition } from '@/lib/flow/schema';

export const POST = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { note } = body;

  const bot = await db.flow.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!bot) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
  }

  let flow: FlowDefinition;
  try {
    flow = JSON.parse(bot.currentDraft);
  } catch {
    return NextResponse.json({ success: false, error: 'Draft flow data is corrupt' }, { status: 400 });
  }

  // 1. Run live validation
  const validation = validateFlow(flow);
  if (!validation.isValid) {
    return NextResponse.json({
      success: false,
      error: 'Cannot publish flow with validation errors. Please resolve all issues first.',
      validationErrors: validation.errors,
    }, { status: 422 });
  }

  const nextVersionNum = (bot.versions[0]?.version || 0) + 1;

  // 2. Create immutable FlowVersion
  const newVersion = await db.flowVersion.create({
    data: {
      flowId: bot.id,
      version: nextVersionNum,
      compiled: JSON.stringify(flow),
      note: note || `Published version ${nextVersionNum}`,
      publishedBy: user.email,
    },
  });

  // 3. Denormalize triggers into FlowTrigger table for fast webhook matching
  await db.flowTrigger.deleteMany({
    where: { flowId: bot.id },
  });

  const triggers = flow.nodes.filter((n) => n.data.nodeType.startsWith('trigger_'));
  for (const t of triggers) {
    await db.flowTrigger.create({
      data: {
        flowId: bot.id,
        type: t.data.nodeType,
        config: JSON.stringify(t.data.config),
        priority: 1,
      },
    });
  }

  // 4. Update Bot status to Live and point liveVersionId
  const updatedBot = await db.flow.update({
    where: { id: bot.id },
    data: {
      status: 'live',
      liveVersionId: newVersion.id,
    },
  });

  return NextResponse.json({
    success: true,
    version: newVersion.version,
    publishedAt: newVersion.publishedAt,
    bot: updatedBot,
  });
});
