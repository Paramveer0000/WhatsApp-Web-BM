export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { warmerRunner } from '@/lib/warmer/warmer-runner';
import { isTenantScoped } from '@/lib/tenant';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const existing = await db.numberWarmerSession.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Warmer session not found' }, { status: 404 });
    }

    if (isTenantScoped(user) && existing.clientId && existing.clientId !== user.clientId) {
      return NextResponse.json({ error: 'Forbidden: Access to this warmer session is denied' }, { status: 403 });
    }

    const session = await db.numberWarmerSession.update({
      where: { id: params.id },
      data: { status: 'RUNNING' },
    });

    // Fire first exchange turn immediately and ensure background runner daemon is running
    warmerRunner.startSession(session.id).catch(() => {});

    return NextResponse.json({ success: true, message: 'Warmer session started', session });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
