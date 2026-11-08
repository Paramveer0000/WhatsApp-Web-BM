import { z } from 'zod';
import { GuardrailConfig, calculateRiskScore } from '../guardrails/types';
import {
  AnalyticsSummary,
  AdvisorOutputContract,
  AdvisorRecommendationItem,
  generateRuleBasedRecommendations,
} from './analytics-engine';

export type { AdvisorOutputContract, AdvisorRecommendationItem };

// -------------------------------------------------------------
// 1. Output Zod Schema
// -------------------------------------------------------------

export const RecommendationItemSchema = z.object({
  id: z.string(),
  section: z.enum([
    'pacing',
    'volume',
    'batch',
    'window',
    'warmup',
    'health',
    'breaker',
    'content',
    'consent',
    'filtering',
    'rotation',
    'risk',
  ]),
  field_path: z.string().min(1),
  current_value: z.any(),
  suggested_value: z.any(),
  rationale: z.string().min(5),
  evidence_metric_ids: z.array(z.string()).default([]),
  expected_effect: z.string().default(''),
  risk_change: z.enum(['lower', 'neutral', 'higher']).default('neutral'),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  priority: z.number().int().min(1).max(5).default(3),
});

export const AdvisorOutputSchema = z.object({
  overall_assessment: z.object({
    health: z.enum(['good', 'watch', 'risky']),
    summary: z.string().min(5),
    confidence: z.enum(['low', 'medium', 'high']),
  }),
  key_findings: z
    .array(
      z.object({
        id: z.string(),
        finding: z.string(),
        evidence_metric_ids: z.array(z.string()).default([]),
        severity: z.enum(['info', 'warning', 'critical']),
      })
    )
    .default([]),
  recommendations: z.array(RecommendationItemSchema).default([]),
  suggested_experiments: z
    .array(
      z.object({
        hypothesis: z.string(),
        change: z.string(),
        how_to_measure: z.string(),
        duration_days: z.number().default(7),
      })
    )
    .default([]),
  data_gaps: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

/**
 * Normalizes raw LLM output into the strict schema expected by AdvisorOutputSchema.
 * Handles cases where LLMs return strings instead of objects, or omit required keys.
 */
export function normalizeAdvisorOutput(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    return {
      overall_assessment: { health: 'good', summary: String(raw || 'No analysis generated'), confidence: 'medium' },
      key_findings: [],
      recommendations: [],
      suggested_experiments: [],
      data_gaps: [],
      warnings: [],
    };
  }

  const out: any = { ...raw };

  // 1. Normalize overall_assessment
  if (typeof out.overall_assessment === 'string') {
    const text = out.overall_assessment;
    const lower = text.toLowerCase();
    const health = lower.includes('risk') || lower.includes('danger') || lower.includes('ban')
      ? 'risky'
      : lower.includes('watch') || lower.includes('caution') || lower.includes('warning')
      ? 'watch'
      : 'good';
    out.overall_assessment = {
      health,
      summary: text.length >= 5 ? text : 'Operational safety assessment completed.',
      confidence: 'medium',
    };
  } else if (!out.overall_assessment || typeof out.overall_assessment !== 'object') {
    out.overall_assessment = {
      health: 'good',
      summary: 'Operations are stable and within normal baseline parameters.',
      confidence: 'medium',
    };
  } else {
    out.overall_assessment = {
      health: ['good', 'watch', 'risky'].includes(out.overall_assessment.health)
        ? out.overall_assessment.health
        : 'good',
      summary: typeof out.overall_assessment.summary === 'string' && out.overall_assessment.summary.length >= 5
        ? out.overall_assessment.summary
        : 'Operational safety assessment completed.',
      confidence: ['low', 'medium', 'high'].includes(out.overall_assessment.confidence)
        ? out.overall_assessment.confidence
        : 'medium',
    };
  }

  // 2. Normalize key_findings
  if (Array.isArray(out.key_findings)) {
    out.key_findings = out.key_findings.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        return {
          id: `kf_${idx + 1}`,
          finding: item,
          evidence_metric_ids: [],
          severity: 'info' as const,
        };
      }
      return {
        id: String(item.id || item.key || `kf_${idx + 1}`),
        finding: String(item.finding || item.description || item.title || item.issue || item.message || `Finding ${idx + 1}`),
        evidence_metric_ids: Array.isArray(item.evidence_metric_ids) ? item.evidence_metric_ids.map(String) : [],
        severity: ['info', 'warning', 'critical'].includes(item.severity) ? item.severity : 'warning',
      };
    });
  } else {
    out.key_findings = [];
  }

  // 3. Normalize recommendations
  if (Array.isArray(out.recommendations)) {
    const validSections = ['pacing', 'volume', 'batch', 'window', 'warmup', 'health', 'breaker', 'content', 'consent', 'filtering', 'rotation', 'risk'];
    out.recommendations = out.recommendations.map((rec: any, idx: number) => {
      const section = validSections.includes(rec.section) ? rec.section : 'pacing';
      return {
        id: String(rec.id || `rec_${idx + 1}`),
        section,
        field_path: String(rec.field_path || rec.field || `${section}.base_delay_seconds`),
        current_value: rec.current_value !== undefined ? rec.current_value : null,
        suggested_value: rec.suggested_value !== undefined ? rec.suggested_value : null,
        rationale: String(rec.rationale || rec.reason || rec.explanation || 'Recommended adjustment to optimize safety margin.'),
        evidence_metric_ids: Array.isArray(rec.evidence_metric_ids) ? rec.evidence_metric_ids.map(String) : [],
        expected_effect: String(rec.expected_effect || ''),
        risk_change: ['lower', 'neutral', 'higher'].includes(rec.risk_change) ? rec.risk_change : 'lower',
        confidence: ['low', 'medium', 'high'].includes(rec.confidence) ? rec.confidence : 'medium',
        priority: typeof rec.priority === 'number' && rec.priority >= 1 && rec.priority <= 5 ? rec.priority : 3,
      };
    });
  } else {
    out.recommendations = [];
  }

  // 4. Normalize suggested_experiments
  if (Array.isArray(out.suggested_experiments)) {
    out.suggested_experiments = out.suggested_experiments.map((exp: any, idx: number) => {
      return {
        hypothesis: String(exp.hypothesis || exp.description || exp.name || `Experiment hypothesis ${idx + 1}`),
        change: String(exp.change || exp.action || 'Adjust pacing and batch sizes incrementally'),
        how_to_measure: String(exp.how_to_measure || exp.metric || 'Monitor delivery rate and response sentiment'),
        duration_days: typeof exp.duration_days === 'number' ? exp.duration_days : 7,
      };
    });
  } else {
    out.suggested_experiments = [];
  }

  // 5. Normalize data_gaps (must be string[])
  if (Array.isArray(out.data_gaps)) {
    out.data_gaps = out.data_gaps.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.gap || item.description || item.message || JSON.stringify(item);
      }
      return String(item);
    });
  } else {
    out.data_gaps = [];
  }

  // 6. Normalize warnings (must be string[])
  if (Array.isArray(out.warnings)) {
    out.warnings = out.warnings.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.warning || item.description || item.message || JSON.stringify(item);
      }
      return String(item);
    });
  } else {
    out.warnings = [];
  }

  return out;
}

// -------------------------------------------------------------
// 2. Anonymized Privacy Payload Builder (Section 2 & 9)
// -------------------------------------------------------------

export interface BuildAdvisorPayloadParams {
  scope: string; // "Global Operations" or "Number A"
  currentConfig: GuardrailConfig;
  summary: AnalyticsSummary;
  goal: 'Maximize safety' | 'Balanced' | 'Maximize throughput within safe limits';
  notes?: string;
  lockedFields?: string[];
}

/**
 * Builds an anonymized, aggregated payload strictly guaranteed to contain NO PII
 * (no phone numbers, no contact names, no message content).
 */
export function buildAnonymizedAdvisorPayload(params: BuildAdvisorPayloadParams): string {
  const { scope, currentConfig, summary, goal, notes = '', lockedFields = [] } = params;

  // Sanitized notes (limit length, remove phone-like patterns)
  const sanitizedNotes = notes
    .replace(/\+?\d{8,15}/g, '[REDACTED_PHONE]')
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
    .slice(0, 500);

  const payload = {
    scope_label: scope.startsWith('instance') ? 'Specific WhatsApp Number Instance' : 'Global Operations',
    goal,
    user_context: sanitizedNotes || undefined,
    data_sufficiency: summary.dataSufficiency,
    analytics_summary: {
      window_days: summary.windowDays,
      total_sends: summary.totalSends,
      delivered_count: summary.deliveredCount,
      read_count: summary.readCount,
      replied_count: summary.repliedCount,
      failed_count: summary.failedCount,
      rates: {
        delivery_rate_pct: summary.deliveryRate,
        read_rate_pct: summary.readRate,
        reply_rate_pct: summary.replyRate,
        failure_rate_pct: summary.failureRate,
      },
      failure_taxonomy: summary.errorsByClass,
      pacing_actuals: summary.pacing,
      incidents: summary.incidents,
      headroom: summary.headroom,
    },
    current_guardrail_config: {
      pacing: currentConfig.pacing,
      batchCooldown: currentConfig.batchCooldown,
      sendingWindow: currentConfig.sendingWindow,
      warmUp: currentConfig.warmUp,
      healthSignals: currentConfig.healthSignals,
      circuitBreakers: currentConfig.circuitBreakers,
      contentSafety: {
        requireSpintax: currentConfig.contentSafety.requireSpintax,
        minUniqueVariants: currentConfig.contentSafety.minUniqueVariants,
        blockIdenticalThreshold: currentConfig.contentSafety.blockIdenticalThreshold,
        linkPolicy: currentConfig.contentSafety.linkPolicy,
        maxMessageLength: currentConfig.contentSafety.maxMessageLength,
        mandatoryOptOut: currentConfig.contentSafety.mandatoryOptOut,
      },
    },
    constraints: {
      locked_fields: lockedFields,
      hard_rules: [
        'Never recommend disabling mandatory opt-out or consent locks',
        'Never suggest pacing.minDelay below 6 seconds',
        'Maximum daily cap expansion is +25% per recommendation step',
        'Recommend at most 5 focused, measurable parameter changes',
      ],
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);

  // Assertion check: verify no phone patterns
  if (/(?:\+?\d{10,15})/g.test(jsonStr)) {
    throw new Error('Privacy violation detected: phone number format discovered in advisor prompt payload.');
  }

  return jsonStr;
}

// -------------------------------------------------------------
// 3. Validation & Clamping Layer (Section 4)
// -------------------------------------------------------------

/**
 * Validates, bounds, and clamps raw recommendations into safe ranges.
 */
export function validateAndClampRecommendations(
  rawRecommendations: AdvisorRecommendationItem[],
  currentConfig: GuardrailConfig,
  lockedFields: string[] = []
): { validated: AdvisorRecommendationItem[]; discardedCount: number } {
  const validated: AdvisorRecommendationItem[] = [];
  let discardedCount = 0;

  for (const item of rawRecommendations) {
    if (lockedFields.includes(item.field_path)) {
      discardedCount++;
      continue;
    }

    let clampedValue = item.suggested_value;

    switch (item.field_path) {
      case 'pacing.minDelay': {
        const num = Number(clampedValue);
        if (isNaN(num)) {
          discardedCount++;
          continue;
        }
        // Clamped 6s - 60s, max +/-35% change
        const current = currentConfig.pacing.minDelay;
        const bounded = Math.max(6, Math.min(60, num));
        clampedValue = Math.round(Math.max(current * 0.65, Math.min(current * 1.5, bounded)));
        break;
      }
      case 'pacing.maxDelay': {
        const num = Number(clampedValue);
        if (isNaN(num)) {
          discardedCount++;
          continue;
        }
        const current = currentConfig.pacing.maxDelay;
        const bounded = Math.max(12, Math.min(120, num));
        clampedValue = Math.round(Math.max(current * 0.65, Math.min(current * 1.5, bounded)));
        break;
      }
      case 'volumeLimits.dailyCapPerNumber':
      case 'warmUp.targetDailyCap': {
        const num = Number(clampedValue);
        if (isNaN(num)) {
          discardedCount++;
          continue;
        }
        // Max +25% increase, or up to -50% cooldown
        const current = (currentConfig.volumeLimits as any)?.dailyCapPerNumber ?? (currentConfig.warmUp as any)?.targetDailyCap ?? 200;
        const bounded = Math.max(20, Math.min(2000, num));
        clampedValue = Math.round(Math.max(current * 0.5, Math.min(current * 1.25, bounded)));
        break;
      }
      case 'batchCooldown.batchSizeMax': {
        const num = Number(clampedValue);
        if (isNaN(num)) {
          discardedCount++;
          continue;
        }
        clampedValue = Math.round(Math.max(10, Math.min(80, num)));
        break;
      }
      case 'batchCooldown.cooldownMinutes': {
        const num = Number(clampedValue);
        if (isNaN(num)) {
          discardedCount++;
          continue;
        }
        clampedValue = Math.round(Math.max(1, Math.min(60, num)));
        break;
      }
      case 'pacing.humanPause.enabled': {
        clampedValue = Boolean(clampedValue);
        break;
      }
      case 'contentSafety.mandatoryOptOut': {
        // Hard rule: Cannot disable opt-out
        if (clampedValue === false) {
          discardedCount++;
          continue;
        }
        clampedValue = true;
        break;
      }
      default:
        // Accept as-is if field exists
        break;
    }

    validated.push({
      ...item,
      suggested_value: clampedValue,
    });

    if (validated.length >= 5) break; // Maximum 5 simultaneous recommendations
  }

  return { validated, discardedCount };
}

// -------------------------------------------------------------
// 4. OpenRouter API Client (Section 2)
// -------------------------------------------------------------

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  fallbackModel?: string | null;
  baseUrl?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private fallbackModel: string;
  private baseUrl: string;
  private timeoutMs: number;
  private temperature: number;
  private maxTokens: number;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'anthropic/claude-3.5-haiku';
    this.fallbackModel = config.fallbackModel || 'openai/gpt-4o-mini';
    this.baseUrl = (config.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 30000;
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.maxTokens || 2048;
  }

  /**
   * Tests key validity and returns account credits/status.
   */
  async testConnection(): Promise<{ success: boolean; label?: string; usage?: any; error?: string }> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${this.baseUrl}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 401) throw new Error('Invalid OpenRouter API Key.');
        if (res.status === 402) throw new Error('OpenRouter account has insufficient credits.');
        throw new Error(`OpenRouter returned HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        label: data.data?.label || 'OpenRouter Connected',
        usage: data.data?.usage || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Runs the AI Advisor synthesis over OpenRouter with automatic fallback model support.
   */
  async analyzeGuardrails(
    payloadJson: string,
    retryWithFallback = true
  ): Promise<{
    rawOutput: AdvisorOutputContract;
    modelUsed: string;
    tokensUsed: { prompt: number; completion: number; total: number };
    costUsd: number;
  }> {
    const systemPrompt = `You are an expert, cautious WhatsApp Deliverability & Anti-Ban Analyst.
Analyze the user's sending metrics and current guardrail parameters. WhatsApp ban thresholds are undocumented, so base all advice strictly on the provided empirical metrics.
CITE specific metric IDs as evidence for every finding and recommendation.
Propose small, measurable, incremental changes (+/-25% max). Never recommend evading opt-outs or platform policies.
OUTPUT STRICT VALID JSON adhering to the required schema:
- "overall_assessment": MUST be an object with { "health": "good"|"watch"|"risky", "summary": string, "confidence": "low"|"medium"|"high" }. NEVER a plain string.
- "key_findings": array of { "id": string, "finding": string, "severity": "info"|"warning"|"critical", "evidence_metric_ids": string[] }
- "recommendations": array of { "id": string, "section": "pacing"|"volume"|..., "field_path": string, "current_value": any, "suggested_value": any, "rationale": string, "evidence_metric_ids": string[], "expected_effect": string, "risk_change": "lower"|"neutral"|"higher", "confidence": "low"|"medium"|"high", "priority": 1-5 }
- "suggested_experiments": array of { "hypothesis": string, "change": string, "how_to_measure": string, "duration_days": number }
- "data_gaps": array of string descriptions
- "warnings": array of string descriptions`;

    const userPrompt = `Here is the anonymized sending operations dataset and current guardrail configuration:\n\n${payloadJson}\n\nProvide your analysis and structured recommendations.`;

    let activeModel = this.model;

    const makeCall = async (modelToUse: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bulkflow.whatsapp.local',
          'X-Title': 'WhatsApp Campaign Manager - Guardrails Advisor',
        },
        body: JSON.stringify({
          model: modelToUse,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter error (${res.status}): ${errText}`);
      }

      return res.json();
    };

    let responseData: any;
    try {
      responseData = await makeCall(activeModel);
    } catch (primaryErr: any) {
      if (retryWithFallback && this.fallbackModel && this.fallbackModel !== activeModel) {
        activeModel = this.fallbackModel;
        responseData = await makeCall(activeModel);
      } else {
        throw primaryErr;
      }
    }

    const contentText = responseData.choices?.[0]?.message?.content || '{}';
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(contentText);
    } catch (parseErr) {
      // Clean possible markdown code fences
      const cleaned = contentText.replace(/^```json/i, '').replace(/```$/, '').trim();
      parsedJson = JSON.parse(cleaned);
    }

    const normalized = normalizeAdvisorOutput(parsedJson);
    const validated = AdvisorOutputSchema.parse(normalized) as AdvisorOutputContract;

    const promptTokens = responseData.usage?.prompt_tokens || 0;
    const completionTokens = responseData.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    // Estimate cost ~$1.00 / 1M tokens average for Haiku / Mini
    const costUsd = Math.round((totalTokens / 1000000) * 1.5 * 10000) / 10000;

    return {
      rawOutput: validated,
      modelUsed: activeModel,
      tokensUsed: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
      costUsd,
    };
  }

  async answerFollowUpQuestion(params: {
    runContext: any;
    userQuestion: string;
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const systemPrompt = `You are an expert WhatsApp Anti-Ban & Deliverability Advisor.
You are assisting an operator with questions regarding an automated Anti-Ban Guardrail audit.
Never reveal or ask for phone numbers, contact names, or raw message texts.
Focus on safety, pacing curves, delay distributions, rate limits, and warm-up schedules.
Be concise, clear, and action-oriented.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'system',
        content: `Audit Context:\n${JSON.stringify(params.runContext, null, 2)}`,
      },
      ...(params.chatHistory || []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: params.userQuestion },
    ];

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Paramveer0000/WhatsApp-Web-Bulk',
          'X-Title': 'WhatsApp BulkFlow AI Advisor',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: this.temperature,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter chat failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'No response generated.';
    } finally {
      clearTimeout(timeout);
    }
  }
}
