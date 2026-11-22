export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { isTenantScoped } from '@/lib/tenant';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const session = await db.numberWarmerSession.findUnique({
      where: { id: params.id },
    });

    if (!session) {
      return NextResponse.json({ error: 'Warmer session not found' }, { status: 404 });
    }

    if (isTenantScoped(user) && session.clientId && session.clientId !== user.clientId) {
      return NextResponse.json({ error: 'Forbidden: Access to this warmer session is denied' }, { status: 403 });
    }

    await db.numberWarmerSession.delete({
      where: { id: params.id },
    });

    const { warmerRunner } = await import('@/lib/warmer/warmer-runner');
    warmerRunner.pauseSession(params.id);

    return NextResponse.json({ success: true, message: 'Warmer session deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
