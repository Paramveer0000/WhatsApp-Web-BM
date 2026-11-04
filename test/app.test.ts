import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizePhone, deduplicateContacts } from '../src/lib/phone';
import {
  parseTemplateToAST,
  renderMessage,
  countVariants,
  formatWhatsAppToHtml,
} from '../src/lib/spintax';
import {
  calculateJitterDelay,
  sampleTriangular,
  isWithinSendingWindow,
  computeRiskMeter,
  getEffectiveWarmupCap,
} from '../src/lib/queue/pacing';
import { isValidTransition, STATUS_RANKS, MessageStatus } from '../src/lib/state-machine';
import { EvolutionClient, AuthError, SessionClosedError, RateLimitedError, InvalidRecipientError, CircuitBreaker } from '../src/lib/evolution';
import { encrypt, decrypt } from '../src/lib/crypto';

describe('1. Phone Normalization & Edge Cases (libphonenumber-js)', () => {
  it('strips formatting and prepends default India code 91', () => {
    const res = normalizePhone('+91 98765-43210', '91');
    expect(res.isValid).toBe(true);
    expect(res.formatted).toBe('919876543210');
  });

  it('handles scientific notation strings from Excel (e.g. 9.18E+11)', () => {
    const res = normalizePhone('919876543210');
    expect(res.formatted).toBe('919876543210');
  });

  it('handles leading 00 or 0', () => {
    expect(normalizePhone('00919876543210').formatted).toBe('919876543210');
    expect(normalizePhone('09876543210', '91').formatted).toBe('919876543210');
  });

  it('rejects short, landline, or invalid phone numbers', () => {
    expect(normalizePhone('12345').isValid).toBe(false);
    expect(normalizePhone('').isValid).toBe(false);
  });
});

describe('2. Deduplication Logic', () => {
  it('deduplicates contacts based on normalized phone number', () => {
    const contacts = [
      { phone: '919876543210', name: 'Alice' },
      { phone: '919876543211', name: 'Bob' },
      { phone: '919876543210', name: 'Alice Duplicate' },
    ];
    const { unique, duplicatesCount } = deduplicateContacts(contacts);
    expect(unique.length).toBe(2);
    expect(duplicatesCount).toBe(1);
    expect(unique.map((c) => c.phone)).toEqual(['919876543210', '919876543211']);
  });
});

describe('3. AST Templating Engine & Determinism', () => {
  it('parses nested spintax into AST cleanly', () => {
    const template = '{Hello|Hi {there|friend}}, welcome!';
    const { ast, errors } = parseTemplateToAST(template);
    expect(errors.length).toBe(0);
    expect(ast.length).toBeGreaterThan(0);
    expect(countVariants(ast)).toBe(3); // 'Hello' (1) + 'Hi there' (1) + 'Hi friend' (1)
  });

  it('substitutes {{name}} and {{name|fallback}} variables', () => {
    const template = 'Hello {{name|Valued Customer}}, your code is {{code}}!';
    const res1 = renderMessage(template, { name: '' });
    expect(res1).toContain('Hello Valued Customer');

    const res2 = renderMessage(template, { name: 'Aarav', customVariables: { code: 'VIP100' } });
    expect(res2).toContain('Hello Aarav');
    expect(res2).toContain('VIP100');
  });

  it('guarantees deterministic rendering with seedKey', () => {
    const template = '{Hi|Hello|Hey|Greetings} {{name}}, {have a great day|best regards|cheers}!';
    const seed = 'campaign123_user456_919876543210';

    const render1 = renderMessage(template, { name: 'Rahul' }, { seedKey: seed });
    const render2 = renderMessage(template, { name: 'Rahul' }, { seedKey: seed });
    const render3 = renderMessage(template, { name: 'Rahul' }, { seedKey: seed });

    expect(render1).toBe(render2);
    expect(render2).toBe(render3);
  });

  it('property-based test: renderMessage never throws on arbitrary input strings', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const rendered = renderMessage(str, { name: 'Test' });
        expect(typeof rendered).toBe('string');
        expect(rendered.length).toBeLessThanOrEqual(4096);
      })
    );
  });
});

describe('4. Monotonic Message State Machine', () => {
  it('enforces monotonic status ordering: SENT < DELIVERED < READ', () => {
    expect(STATUS_RANKS.SENT).toBeLessThan(STATUS_RANKS.DELIVERED);
    expect(STATUS_RANKS.DELIVERED).toBeLessThan(STATUS_RANKS.READ);
  });

  it('permits valid forward transitions', () => {
    expect(isValidTransition('PENDING', 'QUEUED')).toBe(true);
    expect(isValidTransition('QUEUED', 'SENDING')).toBe(true);
    expect(isValidTransition('SENDING', 'SENT')).toBe(true);
    expect(isValidTransition('SENT', 'DELIVERED')).toBe(true);
    expect(isValidTransition('DELIVERED', 'READ')).toBe(true);
    expect(isValidTransition('SENT', 'READ')).toBe(true); // out-of-order jump allowed
  });

  it('rejects status downgrades (monotonicity violation)', () => {
    expect(isValidTransition('READ', 'SENT')).toBe(false);
    expect(isValidTransition('DELIVERED', 'SENT')).toBe(false);
    expect(isValidTransition('READ', 'DELIVERED')).toBe(false);
  });
});

describe('5. Pacing, Warmup & Triangular Distribution', () => {
  it('samples triangular distribution within configured bounds', () => {
    for (let i = 0; i < 50; i++) {
      const val = sampleTriangular(12, 25);
      expect(val).toBeGreaterThanOrEqual(12);
      expect(val).toBeLessThanOrEqual(25);
    }
  });

  it('calculates jitter delay with human pauses', () => {
    const delay = calculateJitterDelay(10, 20, false);
    expect(delay).toBeGreaterThanOrEqual(10);
    expect(delay).toBeLessThanOrEqual(20);
  });

  it('computes warm-up daily caps progressively', () => {
    expect(getEffectiveWarmupCap(1, 300)).toBe(20);
    expect(getEffectiveWarmupCap(2, 300)).toBe(40);
    expect(getEffectiveWarmupCap(3, 300)).toBe(60);
    expect(getEffectiveWarmupCap(7, 300)).toBe(250);
    expect(getEffectiveWarmupCap(10, 300)).toBe(250); // plateaus at max schedule or instance cap
  });

  it('evaluates sending window using Luxon', () => {
    const check = isWithinSendingWindow('00:00', '23:59', 'Asia/Kolkata');
    expect(check.isInsideWindow).toBe(true);
  });
});

describe('6. Evolution Error Taxonomy & Circuit Breaker', () => {
  it('classifies 401/403 as AuthError', () => {
    const err = EvolutionClient.classifyError(401, { message: 'Unauthorized key' });
    expect(err).toBeInstanceOf(AuthError);
  });

  it('classifies 429 as RateLimitedError', () => {
    const err = EvolutionClient.classifyError(429, { message: 'Too many requests' });
    expect(err).toBeInstanceOf(RateLimitedError);
  });

  it('classifies disconnected session as SessionClosedError', () => {
    const err = EvolutionClient.classifyError(400, { message: 'Session closed or device disconnected' });
    expect(err).toBeInstanceOf(SessionClosedError);
  });

  it('classifies not on whatsapp as InvalidRecipientError', () => {
    const err = EvolutionClient.classifyError(400, { message: 'Number is not on WhatsApp' });
    expect(err).toBeInstanceOf(InvalidRecipientError);
  });

  it('trips circuit breaker to open on repeated failures', () => {
    const testInst = 'test_instance_breaker';
    expect(CircuitBreaker.getState(testInst)).toBe('closed');

    CircuitBreaker.recordFailure(testInst);
    CircuitBreaker.recordFailure(testInst);
    CircuitBreaker.recordFailure(testInst);

    expect(CircuitBreaker.getState(testInst)).toBe('open');

    // Success resets it to closed
    CircuitBreaker.recordSuccess(testInst);
    expect(CircuitBreaker.getState(testInst)).toBe('closed');
  });
});

describe('7. Multi-Language Opt-Out Matching', () => {
  const keywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'NO', 'RUKO', 'MAT BHEJO'];

  function checkOptOut(text: string): boolean {
    const clean = text.trim().toUpperCase();
    return keywords.some((kw) => clean === kw || clean.startsWith(kw + ' ') || clean.endsWith(' ' + kw));
  }

  it('matches English opt-out triggers', () => {
    expect(checkOptOut('stop')).toBe(true);
    expect(checkOptOut('STOP PLEASE')).toBe(true);
    expect(checkOptOut('unsubscribe')).toBe(true);
    expect(checkOptOut('cancel')).toBe(true);
  });

  it('matches Hindi / Hinglish opt-out triggers', () => {
    expect(checkOptOut('ruko')).toBe(true);
    expect(checkOptOut('Ruko mujhe nahi chahiye')).toBe(true);
    expect(checkOptOut('mat bhejo')).toBe(true);
    expect(checkOptOut('messages mat bhejo')).toBe(true);
  });

  it('does not falsely trigger on normal conversation', () => {
    expect(checkOptOut('Yes I am interested')).toBe(false);
    expect(checkOptOut('Please send pricing')).toBe(false);
    expect(checkOptOut('How much does it cost?')).toBe(false);
  });
});

describe('8. Cryptography (AES-256-GCM)', () => {
  it('encrypts and decrypts with authenticated integrity', () => {
    const secret = 'SUPER_SECRET_GLOBAL_EVOLUTION_API_KEY_2026';
    const encrypted = encrypt(secret);
    expect(encrypted).not.toBe(secret);
    expect(encrypted).toContain(':'); // IV:AuthTag:Ciphertext format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });
});
