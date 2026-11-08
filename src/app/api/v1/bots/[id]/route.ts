export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { validateFlow } from '@/lib/flow/validate';

// GET /api/v1/bots/[id] - Retrieve bot flow details and draft
export const GET = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const bot = await db.flow.findUnique({
    where: { id: params.id },
    include: {
      assignments: true,
      versions: {
        orderBy: { version: 'desc' },
        take: 5,
      },
    },
  });

  if (!bot) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
  }

  let flowData: any = null;
  try {
    flowData = JSON.parse(bot.currentDraft);
  } catch {
    flowData = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  }

  return NextResponse.json({
    success: true,
    bot: {
      id: bot.id,
      name: bot.name,
      description: bot.description,
      status: bot.status,
      draftRevision: bot.draftRevision,
      liveVersionId: bot.liveVersionId,
      assignments: bot.assignments,
      versions: bot.versions,
      flow: flowData,
      updatedAt: bot.updatedAt.toISOString(),
    },
  });
});

// PUT /api/v1/bots/[id] - Save draft flow & metadata (Autosave endpoint)
export const PUT = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, description, flow, status } = body;

  const updateData: any = {
    updatedAt: new Date(),
  };

  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;

  if (flow) {
    updateData.currentDraft = typeof flow === 'string' ? flow : JSON.stringify(flow);
    updateData.draftRevision = { increment: 1 };
  }

  const updated = await db.flow.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    bot: updated,
  });
});

// DELETE /api/v1/bots/[id] - Delete or archive bot
export const DELETE = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await db.flow.delete({
    where: { id: params.id },
  });

  return NextResponse.json({
    success: true,
    message: 'Bot deleted successfully',
  });
});
