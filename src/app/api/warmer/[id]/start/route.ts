export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { warmerRunner } from '@/lib/warmer/warmer-runner';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

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

