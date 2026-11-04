import { describe, it, expect } from 'vitest';
import {
  computeAnalyticsSummary,
  generateRuleBasedRecommendations,
  SendingMetricRecord,
  BreakerEventRecord,
} from '../src/lib/advisor/analytics-engine';
import {
  buildAnonymizedAdvisorPayload,
  validateAndClampRecommendations,
  AdvisorRecommendationItem,
} from '../src/lib/advisor/openrouter';
import { DEFAULT_GUARDRAIL_CONFIG } from '../src/lib/guardrails/types';

describe('AI Guardrail Advisor: Analytics & Privacy Engine', () => {
  const baseConfig = DEFAULT_GUARDRAIL_CONFIG;

  // -------------------------------------------------------------
  // 1. Analytics Engine & Sufficiency Test
  // -------------------------------------------------------------
  describe('Analytics Engine Aggregation', () => {
    it('accurately computes send rates, delay quantiles and flags fast sends', () => {
      const records: SendingMetricRecord[] = [
        { timestamp: Date.now() - 10000, status: 'SENT', delaySec: 5 }, // under 8s
        { timestamp: Date.now() - 20000, status: 'DELIVERED', delaySec: 15 },
        { timestamp: Date.now() - 30000, status: 'READ', delaySec: 18 },
        { timestamp: Date.now() - 40000, status: 'REPLIED', delaySec: 25 },
        {
          timestamp: Date.now() - 50000,
          status: 'FAILED',
          delaySec: 6, // under 8s
          errorCode: '429',
          errorMessage: 'Rate limit exceeded by carrier',
        },
      ];

      const incidents: BreakerEventRecord[] = [
        { timestamp: Date.now() - 50000, type: 'RATE_LIMITED' },
      ];

      const summary = computeAnalyticsSummary(records, incidents, 7);

      expect(summary.totalSends).toBe(5);
      expect(summary.failedCount).toBe(1);
      expect(summary.failureRate).toBe(20.0);
      expect(summary.errorsByClass.rateLimitedCount).toBe(1);
      expect(summary.pacing.under8sPercent).toBe(40); // 2 out of 5 under 8s
      expect(summary.dataSufficiency.rating).toBe('insufficient'); // < 100 sends
    });

    it('assigns correct sufficiency ratings based on sample size thresholds', () => {
      const makeRecords = (count: number): SendingMetricRecord[] =>
        Array.from({ length: count }, () => ({
          timestamp: Date.now(),
          status: 'SENT',
          delaySec: 15,
        }));

      expect(computeAnalyticsSummary(makeRecords(50), []).dataSufficiency.rating).toBe('insufficient');
      expect(computeAnalyticsSummary(makeRecords(250), []).dataSufficiency.rating).toBe('low');
      expect(computeAnalyticsSummary(makeRecords(800), []).dataSufficiency.rating).toBe('medium');
      expect(computeAnalyticsSummary(makeRecords(2500), []).dataSufficiency.rating).toBe('high');
    });
  });

  // -------------------------------------------------------------
  // 2. Rule-Based Fallback Recommender (No AI Needed)
  // -------------------------------------------------------------
  describe('Rule-Based Fallback Recommender', () => {
    it('recommends increasing pacing delays when fast bursts are detected', () => {
      const fastBurstRecords: SendingMetricRecord[] = Array.from({ length: 150 }, (_, i) => ({
        timestamp: Date.now() - i * 1000,
        status: i % 10 === 0 ? 'FAILED' : 'SENT',
        delaySec: 5, // rapid burst under 8s
      }));

      const summary = computeAnalyticsSummary(fastBurstRecords, [], 14);
      const output = generateRuleBasedRecommendations(summary, baseConfig, 'Balanced');

      expect(output.recommendations.length).toBeGreaterThan(0);
      const minDelayRec = output.recommendations.find((r) => r.field_path === 'pacing.minDelay');
      expect(minDelayRec).toBeDefined();
      expect(minDelayRec?.suggested_value).toBeGreaterThan(baseConfig.pacing.minDelay);
      expect(minDelayRec?.risk_change).toBe('lower');
    });
  });

  // -------------------------------------------------------------
  // 3. Privacy Payload Builder (No PII Guarantee)
  // -------------------------------------------------------------
  describe('Privacy Payload Anonymization', () => {
    it('guarantees that no raw phone numbers or PII are passed into advisor prompt', () => {
      const records: SendingMetricRecord[] = [
        { timestamp: Date.now(), status: 'SENT', delaySec: 15 },
      ];
      const summary = computeAnalyticsSummary(records, [], 7);

      const payloadString = buildAnonymizedAdvisorPayload({
        scope: 'instance:inst_123',
        currentConfig: baseConfig,
        summary,
        goal: 'Balanced',
        notes: 'Testing delivery to customer +919876543210 regarding invoice at test@example.com',
      });

      // Must be valid JSON
      const parsed = JSON.parse(payloadString);
      expect(parsed.scope_label).toBe('Specific WhatsApp Number Instance');

      // Notes must have redacted phone and email
      expect(payloadString).not.toContain('+919876543210');
      expect(payloadString).not.toContain('test@example.com');
      expect(payloadString).toContain('[REDACTED_PHONE]');
      expect(payloadString).toContain('[REDACTED_EMAIL]');
    });
  });

  // -------------------------------------------------------------
  // 4. Output Clamping & Constraint Enforcement
  // -------------------------------------------------------------
  describe('Output Clamping & Safety Bounds', () => {
    it('clamps suggested values into safe parameter envelopes and discards locked fields', () => {
      const rawRecommendations: AdvisorRecommendationItem[] = [
        {
          id: '1',
          section: 'pacing',
          field_path: 'pacing.minDelay',
          current_value: 12,
          suggested_value: 2, // Dangerously low value (under 6s)
          rationale: 'Speed up delivery',
          evidence_metric_ids: [],
          expected_effect: '',
          risk_change: 'higher',
          confidence: 'low',
          priority: 1,
        },
        {
          id: '2',
          section: 'volume',
          field_path: 'warmUp.targetDailyCap',
          current_value: 200,
          suggested_value: 10000, // Dangerously high value
          rationale: 'Massive scale',
          evidence_metric_ids: [],
          expected_effect: '',
          risk_change: 'higher',
          confidence: 'low',
          priority: 1,
        },
        {
          id: '3',
          section: 'consent',
          field_path: 'contentSafety.mandatoryOptOut',
          current_value: true,
          suggested_value: false, // Disallowed: cannot disable opt-out
          rationale: 'Reduce message length',
          evidence_metric_ids: [],
          expected_effect: '',
          risk_change: 'higher',
          confidence: 'low',
          priority: 1,
        },
        {
          id: '4',
          section: 'batch',
          field_path: 'batchCooldown.batchSizeMax',
          current_value: 30,
          suggested_value: 40, // Locked field in our test
          rationale: 'Slightly larger batches',
          evidence_metric_ids: [],
          expected_effect: '',
          risk_change: 'neutral',
          confidence: 'medium',
          priority: 2,
        },
      ];

      const { validated, discardedCount } = validateAndClampRecommendations(
        rawRecommendations,
        baseConfig,
        ['batchCooldown.batchSizeMax'] // locked
      );

      // minDelay clamped to at least 8 (safe bound)
      const minDelayRec = validated.find((r) => r.field_path === 'pacing.minDelay');
      expect(minDelayRec?.suggested_value).toBeGreaterThanOrEqual(6);

      // targetDailyCap clamped to at most +25% (200 * 1.25 = 250)
      const capRec = validated.find((r) => r.field_path === 'warmUp.targetDailyCap');
      expect(capRec?.suggested_value).toBeLessThanOrEqual(250);

      // optOut disabled was discarded (security invariant)
      const optOutRec = validated.find((r) => r.field_path === 'contentSafety.mandatoryOptOut');
      expect(optOutRec).toBeUndefined();

      // locked batchSizeMax was discarded
      const lockedRec = validated.find((r) => r.field_path === 'batchCooldown.batchSizeMax');
      expect(lockedRec).toBeUndefined();

      expect(discardedCount).toBe(2);
    });
  });
});
