export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { executeWarmerTurn } from '@/lib/warmer/warmer-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await executeWarmerTurn(params.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to execute turn' }, { status: 400 });
    }

    return NextResponse.json({ success: true, log: result.log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

