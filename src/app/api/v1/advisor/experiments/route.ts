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
    const runId = searchParams.get('runId');

    const where: any = {};
    if (runId) where.runId = runId;

    const experiments = await db.advisorExperiment.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ success: true, experiments });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/v1/advisor/experiments');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      runId,
      baselineMetrics,
      appliedChanges,
    } = body;

    const experiment = await db.advisorExperiment.create({
      data: {
        runId,
        baselineMetrics: JSON.stringify(baselineMetrics || {}),
        appliedChanges: JSON.stringify(appliedChanges || {}),
        status: 'evaluating',
      },
    });

    return NextResponse.json({ success: true, experiment });
  } catch (err: any) {
    logger.error({ err }, 'Error creating advisor experiment');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
