export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { executeWarmerTurn } from '@/lib/warmer/warmer-engine';
import { isTenantScoped } from '@/lib/tenant';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isTenantScoped(user)) {
      const existing = await db.numberWarmerSession.findUnique({
        where: { id: params.id },
        select: { clientId: true },
      });
      if (!existing) return NextResponse.json({ error: 'Warmer session not found' }, { status: 404 });
      if (existing.clientId && existing.clientId !== user.clientId) {
        return NextResponse.json({ error: 'Forbidden: Access to this warmer session is denied' }, { status: 403 });
      }
    }

    const result = await executeWarmerTurn(params.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to execute turn' }, { status: 400 });
    }

    return NextResponse.json({ success: true, log: result.log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
