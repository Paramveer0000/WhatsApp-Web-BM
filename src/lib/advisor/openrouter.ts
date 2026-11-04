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
OUTPUT STRICT VALID JSON adhering to the required schema with keys:
overall_assessment, key_findings, recommendations, suggested_experiments, data_gaps, warnings.`;

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

    const validated = AdvisorOutputSchema.parse(parsedJson) as AdvisorOutputContract;

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
