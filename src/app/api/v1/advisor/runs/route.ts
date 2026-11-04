export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const limit = Math.min(50, Number(searchParams.get('limit')) || 10);

    const where: any = {};
    if (scope) where.scope = scope;

    const runs = await db.advisorRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        recommendations: true,
      },
    });

    return NextResponse.json({ success: true, runs });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/v1/advisor/runs');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
