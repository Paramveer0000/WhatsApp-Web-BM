export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const run = await db.advisorRun.findUnique({
      where: { id: params.id },
      include: {
        recommendations: true,
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, run });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/v1/advisor/runs/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
