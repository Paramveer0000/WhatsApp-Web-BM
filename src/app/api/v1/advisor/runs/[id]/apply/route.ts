export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { GuardrailConfig } from '@/lib/guardrails/types';
import { getEffectiveGuardrails } from '@/lib/guardrails';
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

    const body = await req.json().catch(() => ({}));
    const recommendationIds: string[] = body.recommendationIds || [];

    const run = await db.advisorRun.findUnique({
      where: { id: params.id },
      include: { recommendations: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const effectiveRes = await getEffectiveGuardrails({
      instanceName: run.scope === 'instance' && run.scopeId ? run.scopeId : undefined,
      campaignId: run.scope === 'campaign' && run.scopeId ? run.scopeId : undefined,
    });
    const baseConfig: GuardrailConfig = effectiveRes.effective;
    const draftConfig: GuardrailConfig = JSON.parse(JSON.stringify(baseConfig));

    const selectedRecs = run.recommendations.filter((r) =>
      recommendationIds.length === 0 || recommendationIds.includes(r.id)
    );

    const diff: Array<{ fieldPath: string; from: any; to: any; reason: string }> = [];

    for (const rec of selectedRecs) {
      const parts = rec.fieldPath.split('.');
      let target: any = draftConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }

      const key = parts[parts.length - 1];
      const prevVal = target[key];
      const newVal = JSON.parse(rec.suggestedValue);

      target[key] = newVal;

      diff.push({
        fieldPath: rec.fieldPath,
        from: prevVal,
        to: newVal,
        reason: rec.rationale,
      });

      // Mark recommendation as accepted
      await db.advisorRecommendation.update({
        where: { id: rec.id },
        data: { status: 'applied' },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      draftConfig,
      diff,
      runId: run.id,
      appliedCount: selectedRecs.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in apply recommendations endpoint');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
