import { GuardrailConfig } from '../guardrails/types';

export interface SendingMetricRecord {
  timestamp: number; // epoch ms
  status: 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED' | 'FAILED';
  delaySec?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  instanceId?: string | null;
  campaignId?: string | null;
}

export interface BreakerEventRecord {
  timestamp: number;
  instanceId?: string | null;
  type: string; // 'BREAKER_OPEN' | 'RATE_LIMITED' | 'SESSION_CLOSED'
}

export interface AnalyticsSummary {
  windowDays: number;
  totalSends: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  // Rates
  deliveryRate: number; // 0..100
  readRate: number; // 0..100
  replyRate: number; // 0..100
  failureRate: number; // 0..100
  // Failure taxonomy breakdown
  errorsByClass: {
    rateLimitedCount: number; // 429
    sessionClosedCount: number; // session drop / disconnect
    invalidNumberCount: number; // not on WA / malformed
    transientCount: number; // timeout / network
  };
  // Pacing actuals
  pacing: {
    avgDelaySec: number;
    medianDelaySec: number;
    p10DelaySec: number;
    p90DelaySec: number;
    under8sPercent: number; // percentage of sends under 8s delay
  };
  // Breaker / Incident events
  incidents: {
    breakerOpenCount: number;
    rateLimitIncidents: number;
    sessionDropCount: number;
  };
  // Data Sufficiency Assessment
  dataSufficiency: {
    rating: 'insufficient' | 'low' | 'medium' | 'high';
    sampleSize: number;
    daysObserved: number;
    confidenceNote: string;
  };
  // Headroom estimate
  headroom: {
    estimatedSafeDailyVolume: number;
    confidence: 'low' | 'medium' | 'high';
    bottleneckFactor: string;
  };
}

export interface AdvisorRecommendationItem {
  id: string;
  section: 'pacing' | 'volume' | 'batch' | 'window' | 'warmup' | 'health' | 'breaker' | 'content' | 'consent' | 'filtering' | 'rotation' | 'risk';
  field_path: string;
  current_value: any;
  suggested_value: any;
  rationale: string;
  evidence_metric_ids: string[];
  expected_effect: string;
  risk_change: 'lower' | 'neutral' | 'higher';
  confidence: 'low' | 'medium' | 'high';
  priority: number; // 1-5
}

export interface AdvisorOutputContract {
  overall_assessment: {
    health: 'good' | 'watch' | 'risky';
    summary: string;
    confidence: 'low' | 'medium' | 'high';
  };
  key_findings: Array<{
    id: string;
    finding: string;
    evidence_metric_ids: string[];
    severity: 'info' | 'warning' | 'critical';
  }>;
  recommendations: AdvisorRecommendationItem[];
  suggested_experiments: Array<{
    hypothesis: string;
    change: string;
    how_to_measure: string;
    duration_days: number;
  }>;
  data_gaps: string[];
  warnings: string[];
}

// -------------------------------------------------------------
// 1. Pure Analytics Engine
// -------------------------------------------------------------

export function computeAnalyticsSummary(
  records: SendingMetricRecord[],
  incidents: BreakerEventRecord[],
  windowDays = 14
): AnalyticsSummary {
  const totalSends = records.length;
  let sentCount = 0;
  let deliveredCount = 0;
  let readCount = 0;
  let repliedCount = 0;
  let failedCount = 0;

  let rateLimitedCount = 0;
  let sessionClosedCount = 0;
  let invalidNumberCount = 0;
  let transientCount = 0;

  const delays: number[] = [];
  let under8sCount = 0;

  for (const r of records) {
    if (r.status === 'FAILED') {
      failedCount++;
      const err = `${r.errorCode || ''} ${r.errorMessage || ''}`.toLowerCase();
      if (err.includes('429') || err.includes('rate') || err.includes('limit')) {
        rateLimitedCount++;
      } else if (err.includes('session') || err.includes('closed') || err.includes('disconnect') || err.includes('401')) {
        sessionClosedCount++;
      } else if (err.includes('not on whatsapp') || err.includes('invalid') || err.includes('format')) {
        invalidNumberCount++;
      } else {
        transientCount++;
      }
    } else {
      sentCount++;
      if (r.status === 'DELIVERED') deliveredCount++;
      if (r.status === 'READ') {
        deliveredCount++;
        readCount++;
      }
      if (r.status === 'REPLIED') {
        deliveredCount++;
        readCount++;
        repliedCount++;
      }
    }

    if (typeof r.delaySec === 'number' && r.delaySec > 0) {
      delays.push(r.delaySec);
      if (r.delaySec < 8) under8sCount++;
    }
  }

  // Calculate sorted delay quantiles
  delays.sort((a, b) => a - b);
  const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 15;
  const medianDelay = delays.length > 0 ? delays[Math.floor(delays.length / 2)]! : 15;
  const p10Delay = delays.length > 0 ? delays[Math.floor(delays.length * 0.1)]! : 8;
  const p90Delay = delays.length > 0 ? delays[Math.floor(delays.length * 0.9)]! : 25;
  const under8sPct = delays.length > 0 ? Math.round((under8sCount / delays.length) * 100) : 0;

  const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 1000) / 10 : 0;
  const readRate = sentCount > 0 ? Math.round((readCount / sentCount) * 1000) / 10 : 0;
  const replyRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 1000) / 10 : 0;
  const failureRate = totalSends > 0 ? Math.round((failedCount / totalSends) * 1000) / 10 : 0;

  // Incident aggregations
  const breakerOpenCount = incidents.filter((i) => i.type.includes('BREAKER')).length;
  const rateLimitIncidents = incidents.filter((i) => i.type.includes('RATE') || i.type.includes('429')).length;
  const sessionDropCount = incidents.filter((i) => i.type.includes('SESSION')).length;

  // Sufficiency Assessment (Section 3)
  let sufficiencyRating: 'insufficient' | 'low' | 'medium' | 'high' = 'insufficient';
  let confidenceNote = '';
  if (totalSends < 100) {
    sufficiencyRating = 'insufficient';
    confidenceNote = `Only ${totalSends} sends observed. At least 100 sends required for statistical significance; showing conservative baseline recommendations.`;
  } else if (totalSends < 500) {
    sufficiencyRating = 'low';
    confidenceNote = `${totalSends} sends observed over ${windowDays} days. Trends indicate preliminary behavioral patterns.`;
  } else if (totalSends < 2000) {
    sufficiencyRating = 'medium';
    confidenceNote = `Robust dataset of ${totalSends} sends. Reliable statistical baseline for optimization.`;
  } else {
    sufficiencyRating = 'high';
    confidenceNote = `High confidence based on ${totalSends.toLocaleString()} sends across ${windowDays} days. Clear causal patterns observed.`;
  }

  // Headroom estimate
  let estimatedSafeDailyVolume = 250;
  let bottleneck = 'Pacing intervals';
  if (failureRate < 2.5 && rateLimitedCount === 0 && breakerOpenCount === 0) {
    estimatedSafeDailyVolume = Math.min(800, Math.max(300, Math.round((sentCount / Math.max(1, windowDays)) * 1.35)));
    bottleneck = 'Healthy delivery; modest +25-35% scaling headroom available';
  } else if (failureRate > 8 || rateLimitedCount > 5) {
    estimatedSafeDailyVolume = Math.max(100, Math.round((sentCount / Math.max(1, windowDays)) * 0.75));
    bottleneck = 'Elevated error rates; volume reduction advised to protect phone number';
  }

  return {
    windowDays,
    totalSends,
    sentCount,
    deliveredCount,
    readCount,
    repliedCount,
    failedCount,
    deliveryRate,
    readRate,
    replyRate,
    failureRate,
    errorsByClass: {
      rateLimitedCount,
      sessionClosedCount,
      invalidNumberCount,
      transientCount,
    },
    pacing: {
      avgDelaySec: Math.round(avgDelay * 10) / 10,
      medianDelaySec: Math.round(medianDelay * 10) / 10,
      p10DelaySec: Math.round(p10Delay * 10) / 10,
      p90DelaySec: Math.round(p90Delay * 10) / 10,
      under8sPercent: under8sPct,
    },
    incidents: {
      breakerOpenCount,
      rateLimitIncidents,
      sessionDropCount,
    },
    dataSufficiency: {
      rating: sufficiencyRating,
      sampleSize: totalSends,
      daysObserved: windowDays,
      confidenceNote,
    },
    headroom: {
      estimatedSafeDailyVolume,
      confidence: sufficiencyRating === 'high' ? 'high' : sufficiencyRating === 'medium' ? 'medium' : 'low',
      bottleneckFactor: bottleneck,
    },
  };
}

// -------------------------------------------------------------
// 2. Rule-Based Fallback Recommender (No AI Needed)
// -------------------------------------------------------------

export function generateRuleBasedRecommendations(
  summary: AnalyticsSummary,
  currentConfig: GuardrailConfig,
  goal: 'Maximize safety' | 'Balanced' | 'Maximize throughput within safe limits' = 'Balanced'
): AdvisorOutputContract {
  const recommendations: AdvisorRecommendationItem[] = [];
  const findings: AdvisorOutputContract['key_findings'] = [];
  const warnings: string[] = [];
  const experiments: AdvisorOutputContract['suggested_experiments'] = [];
  const dataGaps: string[] = [];

  // Health assessment
  let health: 'good' | 'watch' | 'risky' = 'good';
  let healthSummary = 'Sending operations indicate healthy account metrics.';

  if (summary.failureRate > 10 || summary.incidents.breakerOpenCount > 0 || summary.incidents.rateLimitIncidents > 2) {
    health = 'risky';
    healthSummary = `Elevated risk detected: ${summary.failureRate}% failure rate with ${summary.incidents.breakerOpenCount} circuit breaker events. Cautious cooldown recommended.`;
  } else if (summary.failureRate > 5 || summary.pacing.under8sPercent > 15) {
    health = 'watch';
    healthSummary = `Moderate caution: Failure rate at ${summary.failureRate}% with ${summary.pacing.under8sPercent}% sends faster than 8 seconds.`;
  }

  // 1. Pacing Delay Rules
  if (summary.pacing.under8sPercent > 10 || summary.pacing.avgDelaySec < 12) {
    findings.push({
      id: 'fast-pacing',
      finding: `${summary.pacing.under8sPercent}% of messages were sent under 8 seconds. Rapid bursts trigger WhatsApp automated anti-spam flags.`,
      evidence_metric_ids: ['pacing.under8sPercent', 'pacing.avgDelaySec'],
      severity: 'warning',
    });

    const newMin = Math.min(25, Math.max(15, Math.round(currentConfig.pacing.minDelay * 1.3)));
    const newMax = Math.min(45, Math.max(30, Math.round(currentConfig.pacing.maxDelay * 1.25)));
    recommendations.push({
      id: 'rec_pacing_min_delay',
      section: 'pacing',
      field_path: 'pacing.minDelay',
      current_value: currentConfig.pacing.minDelay,
      suggested_value: newMin,
      rationale: `Increasing min delay from ${currentConfig.pacing.minDelay}s to ${newMin}s prevents message bursts.`,
      evidence_metric_ids: ['pacing.under8sPercent'],
      expected_effect: 'Reduces rate-limiting flags and distributes message send intervals evenly.',
      risk_change: 'lower',
      confidence: 'high',
      priority: 1,
    });
    recommendations.push({
      id: 'rec_pacing_max_delay',
      section: 'pacing',
      field_path: 'pacing.maxDelay',
      current_value: currentConfig.pacing.maxDelay,
      suggested_value: newMax,
      rationale: `Expanding upper delay interval from ${currentConfig.pacing.maxDelay}s to ${newMax}s mimics natural human rhythm.`,
      evidence_metric_ids: ['pacing.avgDelaySec'],
      expected_effect: 'Creates realistic jitter envelope indistinguishable from authentic manual usage.',
      risk_change: 'lower',
      confidence: 'high',
      priority: 2,
    });
  }

  // 2. Failure Rate & Daily Cap Rules
  if (summary.failureRate > 7 || summary.errorsByClass.rateLimitedCount > 2) {
    findings.push({
      id: 'high-failure-rate',
      finding: `Failure rate is elevated at ${summary.failureRate}%, including ${summary.errorsByClass.rateLimitedCount} rate-limited dispatches.`,
      evidence_metric_ids: ['failureRate', 'errorsByClass.rateLimitedCount'],
      severity: 'critical',
    });

    const currentCap = currentConfig.volumeLimits.dailyCapPerNumber;
    const reducedCap = Math.max(100, Math.round(currentCap * 0.75));
    if (reducedCap < currentCap) {
      recommendations.push({
        id: 'rec_target_daily_cap',
        section: 'volume',
        field_path: 'volumeLimits.dailyCapPerNumber',
        current_value: currentCap,
        suggested_value: reducedCap,
        rationale: `Cool down daily dispatch ceiling by ~25% to stabilize account health after recent errors.`,
        evidence_metric_ids: ['failureRate', 'errorsByClass.rateLimitedCount'],
        expected_effect: 'Allows number reputation to recover without triggering temporary WhatsApp account freezes.',
        risk_change: 'lower',
        confidence: 'high',
        priority: 1,
      });
    }
  } else if (summary.failureRate < 2.0 && summary.dataSufficiency.rating === 'high' && goal === 'Maximize throughput within safe limits') {
    // Throughput expansion
    const currentCap = currentConfig.volumeLimits.dailyCapPerNumber;
    const safeIncreasedCap = Math.min(800, Math.round(currentCap * 1.25));
    if (safeIncreasedCap > currentCap) {
      recommendations.push({
        id: 'rec_target_daily_cap_growth',
        section: 'volume',
        field_path: 'volumeLimits.dailyCapPerNumber',
        current_value: currentCap,
        suggested_value: safeIncreasedCap,
        rationale: `Excellent delivery health (${summary.deliveryRate}% delivered, <2% failure) supports measured +25% volume expansion.`,
        evidence_metric_ids: ['deliveryRate', 'failureRate'],
        expected_effect: 'Increases outreach volume while preserving safe number operating headroom.',
        risk_change: 'neutral',
        confidence: 'medium',
        priority: 3,
      });
    }
  }

  // 3. Human Pauses & Batch Cooldowns
  if (!currentConfig.pacing.humanPause.enabled) {
    recommendations.push({
      id: 'rec_enable_human_pause',
      section: 'pacing',
      field_path: 'pacing.humanPause.enabled',
      current_value: false,
      suggested_value: true,
      rationale: 'Injecting occasional 30-90s pauses breaks unbroken machine patterns.',
      evidence_metric_ids: ['pacing.under8sPercent'],
      expected_effect: 'Drastically lowers behavioral heuristic flags on carrier networks.',
      risk_change: 'lower',
      confidence: 'high',
      priority: 2,
    });
  }

  // 4. Batch Cooldown Adjustments
  if (currentConfig.batchCooldown.batchSizeMax > 40 && summary.failureRate > 4) {
    recommendations.push({
      id: 'rec_batch_size_max',
      section: 'batch',
      field_path: 'batchCooldown.batchSizeMax',
      current_value: currentConfig.batchCooldown.batchSizeMax,
      suggested_value: 30,
      rationale: 'Smaller batch sizes (max 30 messages) reduce consecutive connection load.',
      evidence_metric_ids: ['failureRate'],
      expected_effect: 'Shortens continuous connection bursts.',
      risk_change: 'lower',
      confidence: 'medium',
      priority: 3,
    });
  }

  // Experiments
  experiments.push({
    hypothesis: 'Testing triangular pacing distribution will maintain throughput while reducing variance.',
    change: 'Switch pacing.distribution to "triangular" with mode at 18s.',
    how_to_measure: 'Compare 7-day failure rate and delivery latency before and after.',
    duration_days: 7,
  });

  if (summary.dataSufficiency.rating === 'insufficient') {
    dataGaps.push('Fewer than 100 historical sends recorded; advice is based on defensive platform baselines.');
  }

  return {
    overall_assessment: {
      health,
      summary: healthSummary,
      confidence: summary.dataSufficiency.rating === 'high' ? 'high' : summary.dataSufficiency.rating === 'medium' ? 'medium' : 'low',
    },
    key_findings: findings,
    recommendations: recommendations.slice(0, 5), // Max 5 simultaneous recommendations
    suggested_experiments: experiments,
    data_gaps: dataGaps,
    warnings,
  };
}
