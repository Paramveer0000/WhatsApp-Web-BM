import { describe, it, expect } from 'vitest';
import {
  GuardrailConfigSchema,
  GUARDRAIL_PRESETS,
  calculateRiskScore,
  resolveEffectiveConfig,
  simulatePacing,
  evaluateWindowRule,
  evaluateContentSafetyRule,
  calculatePacingDecision,
} from '../src/lib/guardrails';

describe('Anti-Ban Guardrails Engine & Spec Acceptance', () => {

  describe('1. Zod Schema & Presets Validation', () => {
    it('parses safe preset cleanly with all required fields', () => {
      const safe = GUARDRAIL_PRESETS['safe'].config;
      expect(safe.pacing.minDelay).toBe(15);
      expect(safe.pacing.maxDelay).toBe(35);
      expect(safe.volumeLimits.dailyCapPerNumber).toBe(150);
      expect(safe.contentSafety.requireSpintax).toBe(true);
      expect(safe.contentSafety.mandatoryOptOut).toBe(true);
    });

    it('rejects invalid configurations where maxDelay < minDelay', () => {
      const invalid = {
        ...GUARDRAIL_PRESETS['safe'].config,
        pacing: {
          ...GUARDRAIL_PRESETS['safe'].config.pacing,
          minDelay: 40,
          maxDelay: 20,
        },
      };

      const result = GuardrailConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('all built-in presets conform to schema', () => {
      for (const [key, preset] of Object.entries(GUARDRAIL_PRESETS)) {
        const parsed = GuardrailConfigSchema.parse(preset.config);
        expect(parsed.pacing.maxDelay).toBeGreaterThanOrEqual(parsed.pacing.minDelay);
        expect(parsed.volumeLimits.dailyCapPerNumber).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Precedence Resolution & Strict Mode Clamping', () => {
    it('applies precedence: Campaign > Instance > Global > Safe Preset', () => {
      const global = {
        pacing: { ...GUARDRAIL_PRESETS['safe'].config.pacing, minDelay: 18 },
      };
      const instance = {
        pacing: { ...GUARDRAIL_PRESETS['safe'].config.pacing, minDelay: 22 },
      };
      const campaign = {
        pacing: { ...GUARDRAIL_PRESETS['safe'].config.pacing, minDelay: 28 },
      };

      const { effective, sources } = resolveEffectiveConfig({
        global,
        instance,
        campaign,
      });

      expect(effective.pacing.minDelay).toBe(28);
      expect(sources['pacing.minDelay']).toBe('campaign');
    });

    it('falls back to instance override when campaign has no override', () => {
      const global = {
        pacing: { ...GUARDRAIL_PRESETS['safe'].config.pacing, minDelay: 18 },
      };
      const instance = {
        pacing: { ...GUARDRAIL_PRESETS['safe'].config.pacing, minDelay: 22 },
      };

      const { effective, sources } = resolveEffectiveConfig({
        global,
        instance,
      });

      expect(effective.pacing.minDelay).toBe(22);
      expect(sources['pacing.minDelay']).toBe('instance');
    });

    it('enforces strict mode clamping on dangerous loose parameters', () => {
      // Trying to loosen minDelay to 4s and daily cap to 1000 in campaign
      const campaign = {
        pacing: { ...GUARDRAIL_PRESETS['safe'].config.pacing, minDelay: 4, maxDelay: 8 },
        volumeLimits: { ...GUARDRAIL_PRESETS['safe'].config.volumeLimits, dailyCapPerNumber: 1000 },
        riskPolicy: {
          riskScoreCeiling: 90,
          warningThreshold: 50,
          strictMode: true,
          requireTypedConfirmation: true,
        },
      };

      const { effective } = resolveEffectiveConfig({
        campaign,
        strict: true,
      });

      // Under strict mode, minDelay cannot be loosened below Safe preset (15s)
      expect(effective.pacing.minDelay).toBe(15);
      // Daily cap cannot exceed Safe preset (150)
      expect(effective.volumeLimits.dailyCapPerNumber).toBe(150);
      // Spintax and opt-out are forcibly locked on
      expect(effective.contentSafety.requireSpintax).toBe(true);
      expect(effective.contentSafety.mandatoryOptOut).toBe(true);
    });
  });

  describe('3. Pure Risk Calculation Function', () => {
    it('rates Ultra-Safe preset as SAFE band (<30)', () => {
      const risk = calculateRiskScore(GUARDRAIL_PRESETS['ultra-safe'].config);
      expect(risk.band).toBe('SAFE');
      expect(risk.score).toBeLessThanOrEqual(25);
    });

    it('rates Aggressive preset with higher risk (>50)', () => {
      const risk = calculateRiskScore(GUARDRAIL_PRESETS['aggressive'].config);
      expect(risk.score).toBeGreaterThan(50);
      expect(['HIGH', 'CRITICAL']).toContain(risk.band);
      expect(risk.factors.length).toBeGreaterThan(0);
    });

    it('penalizes dangerous delay < 8s with high risk points and advice tip', () => {
      const dangerousConfig = {
        ...GUARDRAIL_PRESETS['safe'].config,
        pacing: {
          ...GUARDRAIL_PRESETS['safe'].config.pacing,
          minDelay: 5,
        },
      };

      const risk = calculateRiskScore(dangerousConfig);
      const factor = risk.factors.find((f) => f.id === 'pacing-fast');
      expect(factor).toBeDefined();
      expect(factor?.points).toBe(25);
    });
  });

  describe('4. Pacing Simulator ("What would happen?")', () => {
    it('runs deterministic simulation without sending messages', () => {
      const sim = simulatePacing(GUARDRAIL_PRESETS['safe'].config, {
        recipientsCount: 200,
        seed: 42,
      });

      expect(sim.totalDurationMin).toBeGreaterThan(0);
      expect(sim.sampleFirst20.length).toBe(20);
      expect(sim.timeline.length).toBeGreaterThan(0);

      // Verify delays are within pacing bounds (allowing for cooldowns/breaks)
      for (const sample of sim.sampleFirst20) {
        if (!sample.isHumanPause && !sample.isBatchCooldown && !sample.isLongBreak) {
          expect(sample.delaySec).toBeGreaterThanOrEqual(GUARDRAIL_PRESETS['safe'].config.pacing.minDelay);
          expect(sample.delaySec).toBeLessThanOrEqual(GUARDRAIL_PRESETS['safe'].config.pacing.maxDelay);
        }
      }
    });
  });

  describe('5. Guardrail Rule Enforcement Modules', () => {
    it('detects blocked spam keywords in content safety evaluation', () => {
      const ctx: any = {
        config: GUARDRAIL_PRESETS['safe'].config,
      };

      const checkPass = evaluateContentSafetyRule(ctx, 'Hello Rahul, your appointment is confirmed.');
      expect(checkPass.allowed).toBe(true);

      const checkFail = evaluateContentSafetyRule(ctx, 'Congratulations! You won the lottery jackpot.');
      expect(checkFail.allowed).toBe(false);
      expect(checkFail.reason).toContain('lottery');
    });

    it('enforces link policy restrictions', () => {
      const ctx: any = {
        config: {
          ...GUARDRAIL_PRESETS['safe'].config,
          contentSafety: {
            ...GUARDRAIL_PRESETS['safe'].config.contentSafety,
            linkPolicy: 'block',
          },
        },
      };

      const check = evaluateContentSafetyRule(ctx, 'Visit our site at https://example.com/promo');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('External links are blocked');
    });

    it('calculates human pacing decision with typing simulation and jitter', () => {
      const ctx: any = {
        recipient: { id: 'r1', phone: '919876543210', name: 'Rahul' },
        config: GUARDRAIL_PRESETS['safe'].config,
        messagesInBatch: 2,
      };

      const decision = calculatePacingDecision(ctx);
      expect(decision.delayMs).toBeGreaterThan(0);
      expect(decision.typingMs).toBeGreaterThan(0);
    });
  });

});

