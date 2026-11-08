import { describe, it, expect } from 'vitest';
import {
  splitIntoBubbles,
  computeTypingDurationMs,
  sampleDelays,
  classifyAck,
  validateParaphraseTokens,
  buildDeliveryPlan,
  HUMANIZER_PRESETS,
} from '../src/lib/humanizer';

describe('Humanizer Engine: Pure Functions & Plan Generator', () => {
  // -------------------------------------------------------------
  // 1. Bubble Splitter & Token Invariants
  // -------------------------------------------------------------
  describe('splitIntoBubbles()', () => {
    it('never breaks or splits inside URLs', () => {
      const longWithUrl =
        'Hello there! Check out our new pricing structure at https://example.com/products/pro-tier?ref=whatsapp-promo. It has all details and comprehensive breakdown for your business requirements.';
      const bubbles = splitIntoBubbles(longWithUrl, {
        splitIntoBubbles: true,
        maxChars: 100,
        maxBubbles: 3,
      });

      expect(bubbles.length).toBeGreaterThan(1);
      // Entire URL must be in exactly one bubble without fragmentation
      const hasUrl = bubbles.some((b) => b.includes('https://example.com/products/pro-tier?ref=whatsapp-promo'));
      expect(hasUrl).toBe(true);
    });

    it('never breaks inside phone numbers or bold markdown spans', () => {
      const text =
        'Please call our direct support line at +91 98765 43210 immediately. Also remember that *our office closes promptly at 6 PM* on weekdays.';
      const bubbles = splitIntoBubbles(text, {
        splitIntoBubbles: true,
        maxChars: 70,
        maxBubbles: 3,
      });

      expect(bubbles.some((b) => b.includes('+91 98765 43210'))).toBe(true);
      expect(bubbles.some((b) => b.includes('*our office closes promptly at 6 PM*'))).toBe(true);
    });

    it('preserves numbered menu options intact as one cohesive block', () => {
      const menu =
        'Welcome to Acme Services! Please select an option:\n1. Check Account Balance\n2. Talk to Support\n3. View Latest Offers';
      const bubbles = splitIntoBubbles(menu, { splitIntoBubbles: true, maxChars: 60 });

      // Menu must remain as 1 bubble or cleanly split from intro
      const menuBubble = bubbles.find((b) => b.includes('1. Check Account Balance'));
      expect(menuBubble).toBeDefined();
      expect(menuBubble).toContain('2. Talk to Support');
      expect(menuBubble).toContain('3. View Latest Offers');
    });
  });

  // -------------------------------------------------------------
  // 2. Typing Model Cadence
  // -------------------------------------------------------------
  describe('computeTypingDurationMs()', () => {
    it('scales duration with character count and bounds within min and max', () => {
      const shortMsg = computeTypingDurationMs({ chars: 10, minMs: 1000, maxMs: 8000 });
      const longMsg = computeTypingDurationMs({ chars: 180, minMs: 1000, maxMs: 8000 });

      expect(shortMsg.durationMs).toBeGreaterThanOrEqual(1000);
      expect(longMsg.durationMs).toBeGreaterThan(shortMsg.durationMs);
      expect(longMsg.durationMs).toBeLessThanOrEqual(8000);
    });
  });

  // -------------------------------------------------------------
  // 3. Seeded Determinism
  // -------------------------------------------------------------
  describe('sampleDelays()', () => {
    it('yields identical delays for the exact same seed', () => {
      const timing = HUMANIZER_PRESETS.natural.timing;
      const resA = sampleDelays({ seed: 'session_123:step_2', timing });
      const resB = sampleDelays({ seed: 'session_123:step_2', timing });

      expect(resA.readDelayMs).toBe(resB.readDelayMs);
      expect(resA.thinkingPauseMs).toBe(resB.thinkingPauseMs);
      expect(resA.interBubbleDelayMs).toBe(resB.interBubbleDelayMs);
    });

    it('bypasses delays when urgentNoDelay is true', () => {
      const timing = HUMANIZER_PRESETS.natural.timing;
      const res = sampleDelays({ seed: 's1', timing, urgentNoDelay: true });
      expect(res.readDelayMs).toBe(0);
      expect(res.thinkingPauseMs).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 4. Acknowledgement Classifier
  // -------------------------------------------------------------
  describe('classifyAck()', () => {
    it('accurately identifies English, Hindi, and emoji acknowledgements', () => {
      expect(classifyAck('ok').isAck).toBe(true);
      expect(classifyAck('thanks!').isAck).toBe(true);
      expect(classifyAck('thank you so much').isAck).toBe(true);
      expect(classifyAck('theek hai').isAck).toBe(true);
      expect(classifyAck('dhanyawad ji').isAck).toBe(true);
      expect(classifyAck('👍').isAck).toBe(true);

      // Normal questions or substantive text must NOT be classified as acks
      expect(classifyAck('How much does the pro tier plan cost per month?').isAck).toBe(false);
      expect(classifyAck('I want to cancel my reservation').isAck).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 5. Paraphrase Token Protection
  // -------------------------------------------------------------
  describe('validateParaphraseTokens()', () => {
    it('rejects paraphrased text that mutates critical variables, links, or numbers', () => {
      const original = 'Hi {{name}}, your total invoice is ₹4,500 due on 15-Nov at https://pay.co/inv123';
      const validParaphrase = 'Hello {{name}}! Just reminding you of your invoice of ₹4,500 payable via https://pay.co/inv123';
      const invalidParaphrase = 'Hello friend, your invoice is ₹5,000 payable at https://pay.co/inv123'; // altered price and missing {{name}}

      expect(validateParaphraseTokens(original, validParaphrase)).toBe(true);
      expect(validateParaphraseTokens(original, invalidParaphrase)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 6. Delivery Plan Compilation
  // -------------------------------------------------------------
  describe('buildDeliveryPlan()', () => {
    it('constructs an ordered, realistic timeline of markRead, presence, and sendText steps', () => {
      const plan = buildDeliveryPlan(
        {
          type: 'send_text',
          text: 'Hi there! We received your inquiry. A team member will inspect your order shortly.',
        },
        {
          sessionId: 'ses_abc123',
          stepSeq: 1,
          inboundMessageId: 'msg_999',
          inboundText: 'Hello',
        },
        {
          ...HUMANIZER_PRESETS.natural,
          scope: 'bot',
          version: 1,
        }
      );

      expect(plan.steps.length).toBeGreaterThanOrEqual(3);
      expect(plan.steps[0].type).toBe('markRead');
      expect(plan.steps[1].type).toBe('pause');
      expect(plan.steps.some((s) => s.type === 'presence' && s.value === 'composing')).toBe(true);
      expect(plan.steps.some((s) => s.type === 'sendText')).toBe(true);
      expect(plan.totalDurationMs).toBeGreaterThan(0);
    });
  });
});
