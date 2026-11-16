export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { isTenantScoped } from '@/lib/tenant';

export const GET = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (isTenantScoped(user)) {
    const bot = await db.flow.findUnique({
      where: { id: params.id },
      select: { clientId: true },
    });
    if (!bot) return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
    if (bot.clientId && bot.clientId !== user.clientId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  const assignments = await db.flowAssignment.findMany({
    where: { flowId: params.id },
  });

  return NextResponse.json({ success: true, assignments });
});

export const PUT = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const bot = await db.flow.findUnique({
    where: { id: params.id },
    select: { id: true, clientId: true },
  });
  if (!bot) return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
  if (isTenantScoped(user) && bot.clientId && bot.clientId !== user.clientId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { instanceIds, enabled = true, priority = 1 } = body;

  if (!Array.isArray(instanceIds)) {
    return NextResponse.json({ success: false, error: 'instanceIds must be an array' }, { status: 400 });
  }

  // If tenant scoped, ensure all assigned instance IDs belong to this tenant
  if (isTenantScoped(user) && instanceIds.length > 0) {
    const tenantInstances = await db.instance.findMany({
      where: {
        id: { in: instanceIds },
        clientId: user.clientId,
      },
      select: { id: true },
    });
    const allowedIds = new Set(tenantInstances.map((i) => i.id));
    const unauthorized = instanceIds.some((id) => !allowedIds.has(id));
    if (unauthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You cannot assign instances outside your tenant workspace' },
        { status: 403 }
      );
    }
  }

  // Clear existing assignments for this bot
  await db.flowAssignment.deleteMany({
    where: { flowId: params.id },
  });

  // Re-create assignments
  for (const instId of instanceIds) {
    await db.flowAssignment.create({
      data: {
        flowId: params.id,
        instanceId: instId,
        enabled,
        priority,
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: `Updated assignments to ${instanceIds.length} instance(s)`,
  });
});
