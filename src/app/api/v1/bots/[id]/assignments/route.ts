export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';

export const GET = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

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

  const body = await req.json();
  const { instanceIds, enabled = true, priority = 1 } = body;

  if (!Array.isArray(instanceIds)) {
    return NextResponse.json({ success: false, error: 'instanceIds must be an array' }, { status: 400 });
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

