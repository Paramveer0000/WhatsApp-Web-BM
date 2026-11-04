export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { getEffectiveGuardrails } from '@/lib/guardrails';
import {
  computeAnalyticsSummary,
  generateRuleBasedRecommendations,
  SendingMetricRecord,
  BreakerEventRecord,
} from '@/lib/advisor/analytics-engine';
import {
  OpenRouterClient,
  buildAnonymizedAdvisorPayload,
  validateAndClampRecommendations,
} from '@/lib/advisor/openrouter';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scope: 'global' | 'instance' | 'campaign' = body.scope || 'global';
    const scopeId: string = body.scopeId || '';
    const windowDays: number = Math.min(30, Math.max(1, Number(body.windowDays) || 7));
    const rawGoal = body.goal || 'Balanced';
    const goal: 'Maximize safety' | 'Balanced' | 'Maximize throughput within safe limits' =
      rawGoal.toLowerCase().includes('safe')
        ? 'Maximize safety'
        : rawGoal.toLowerCase().includes('through')
        ? 'Maximize throughput within safe limits'
        : 'Balanced';
    const userNotes: string = body.notes || '';
    const lockedFields: string[] = Array.isArray(body.lockedFields) ? body.lockedFields : [];

    const sinceEpoch = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const sinceDate = new Date(sinceEpoch);

    // 1. Fetch historical sending recipients
    const recipients = await db.campaignRecipient.findMany({
      where: {
        sentAt: { gte: sinceDate },
      },
      select: {
        status: true,
        sentAt: true,
        lastError: true,
        campaignId: true,
      },
      take: 2000,
    });

    const metricRecords: SendingMetricRecord[] = recipients.map((c: any) => ({
      timestamp: (c.sentAt || new Date()).getTime(),
      status: (c.status as any) || 'SENT',
      errorMessage: c.lastError,
      campaignId: c.campaignId,
      delaySec: 18,
    }));

    // 2. Fetch incidents / breaker events from guardrail events
    const rawEvents = await db.guardrailEvent.findMany({
      where: {
        createdAt: { gte: sinceDate },
        type: { in: ['BREAKER_OPEN', 'HEALTH_TRIGGER', 'CAP_REACHED'] },
      },
      select: {
        id: true,
        type: true,
        severity: true,
        createdAt: true,
        campaignId: true,
        instanceId: true,
        detail: true,
      },
      take: 500,
    });

    const breakerEvents: BreakerEventRecord[] = rawEvents.map((e: any) => ({
      timestamp: e.createdAt.getTime(),
      type: e.type,
      instanceId: e.instanceId,
    }));

    // 3. Compute deterministic analytics summary
    const summary = computeAnalyticsSummary(metricRecords, breakerEvents, windowDays);

    // 4. Resolve current config
    const effectiveRes = await getEffectiveGuardrails({
      instanceName: scope === 'instance' ? scopeId : undefined,
      campaignId: scope === 'campaign' ? scopeId : undefined,
    });
    const currentConfig = effectiveRes.effective;

    // 5. OpenRouter Reasoning vs Rule-Based Fallback
    const aiSettings = await db.aiSettings.findFirst();
    let apiKey = '';
    if (aiSettings?.apiKeyEncrypted) {
      try {
        apiKey = decrypt(aiSettings.apiKeyEncrypted);
      } catch {}
    }

    let advisorOutput: any;
    let modelUsed = 'rule-based-engine';
    let tokensUsed = { prompt: 0, completion: 0, total: 0 };
    let costUsd = 0;

    if (apiKey) {
      try {
        const client = new OpenRouterClient({
          apiKey,
          model: aiSettings?.model || 'anthropic/claude-3.5-haiku',
          temperature: aiSettings?.temperature ?? 0.2,
          timeoutMs: aiSettings?.timeoutMs ?? 30000,
        });

        const payloadJson = buildAnonymizedAdvisorPayload({
          scope: scope === 'instance' ? `instance:${scopeId}` : 'global',
          summary,
          currentConfig,
          goal,
          lockedFields,
          notes: userNotes,
        });

        const res = await client.analyzeGuardrails(payloadJson);

        advisorOutput = res.rawOutput;
        modelUsed = res.modelUsed;
        tokensUsed = res.tokensUsed;
        costUsd = res.costUsd;
      } catch (llmErr: any) {
        logger.warn({ err: llmErr.message }, 'OpenRouter LLM failed, falling back to rule-based engine');
        advisorOutput = generateRuleBasedRecommendations(summary, currentConfig, goal);
      }
    } else {
      advisorOutput = generateRuleBasedRecommendations(summary, currentConfig, goal);
    }

    // 6. Enforce strict parameter bounds & clamping
    const { validated, discardedCount } = validateAndClampRecommendations(
      advisorOutput.recommendations,
      currentConfig,
      lockedFields
    );

    // 7. Persist AdvisorRun in database
    const run = await db.advisorRun.create({
      data: {
        scope,
        scopeId,
        windowDays,
        goal,
        notes: userNotes.slice(0, 500),
        model: modelUsed,
        mode: apiKey ? 'ai' : 'rule_based',
        costUsd,
        status: 'completed',
        discardedCount,
        inputSummary: JSON.stringify(summary),
        output: JSON.stringify(advisorOutput),
        validatedOutput: JSON.stringify(validated),
        recommendations: {
          create: validated.map((r, idx) => ({
            fieldPath: r.field_path,
            currentValue: JSON.stringify(r.current_value),
            suggestedValue: JSON.stringify(r.suggested_value),
            rationale: r.rationale,
            expectedEffect: r.expected_effect || '',
            riskChange: r.risk_change || 'neutral',
            confidence: r.confidence || 'medium',
            priority: r.priority || 3,
            status: 'pending',
          })),
        },
      },
      include: {
        recommendations: true,
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      summary,
      overallAssessment: advisorOutput.overall_assessment,
      keyFindings: advisorOutput.key_findings,
      recommendations: run.recommendations,
      suggestedExperiments: advisorOutput.suggested_experiments,
      dataGaps: advisorOutput.data_gaps,
      warnings: advisorOutput.warnings,
      discardedCount,
      modelUsed,
      costUsd,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in /api/v1/advisor/analyze');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
