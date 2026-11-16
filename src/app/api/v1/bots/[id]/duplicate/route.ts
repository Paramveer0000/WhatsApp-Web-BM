export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { isTenantScoped } from '@/lib/tenant';

export const POST = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const existing = await db.flow.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
  }

  if (isTenantScoped(user) && existing.clientId && existing.clientId !== user.clientId) {
    return NextResponse.json({ success: false, error: 'Forbidden: Access to this bot is denied' }, { status: 403 });
  }

  const duplicated = await db.flow.create({
    data: {
      name: `${existing.name} (Copy)`,
      description: existing.description,
      status: 'draft',
      currentDraft: existing.currentDraft,
      createdBy: user.email,
      clientId: user.clientId || null,
    },
  });

  return NextResponse.json({
    success: true,
    bot: duplicated,
  });
});
