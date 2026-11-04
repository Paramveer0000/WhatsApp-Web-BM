export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const experiment = await db.advisorExperiment.findUnique({
      where: { id: params.id },
    });

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    const sinceDate = experiment.startedAt;

    // Fetch metrics since experiment started
    const sends = await db.campaignRecipient.findMany({
      where: { sentAt: { gte: sinceDate } },
      select: { status: true },
    });

    const total = sends.length;
    const failed = sends.filter((s: any) => s.status === 'FAILED').length;
    const delivered = sends.filter((s: any) => s.status === 'DELIVERED' || s.status === 'READ').length;

    const outcomeMetrics = {
      totalSends: total,
      deliveredRate: total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0,
    };

    const baseline = JSON.parse(experiment.baselineMetrics || '{}');
    const baseFailureRate = baseline.failureRate ?? 5.0;

    let verdict: 'improved' | 'no_change' | 'worse' = 'no_change';
    if (outcomeMetrics.failureRate < baseFailureRate * 0.8) {
      verdict = 'improved';
    } else if (outcomeMetrics.failureRate > baseFailureRate * 1.2) {
      verdict = 'worse';
    }

    const updated = await db.advisorExperiment.update({
      where: { id: experiment.id },
      data: {
        status: 'completed',
        result: JSON.stringify(outcomeMetrics),
        verdict,
        evaluatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      experiment: updated,
      verdict,
      outcomeMetrics,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error evaluating experiment');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
