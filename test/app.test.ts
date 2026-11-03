import { describe, it, expect } from 'vitest';
import { normalizePhone, deduplicateContacts } from '../src/lib/phone';
import { parseSpintax, substituteVariables, renderMessage, countSpintaxVariations } from '../src/lib/spintax';
import { calculateJitterDelay, isWithinSendingWindow, computeRiskMeter } from '../src/lib/queue/pacing';
import { encrypt, decrypt } from '../src/lib/crypto';

describe('1. Phone Normalization & Cleaning', () => {
  it('strips non-digits, applies default country code (91) for 10-digit numbers', () => {
    const res = normalizePhone('98765 43210', '91');
    expect(res.isValid).toBe(true);
    expect(res.formatted).toBe('919876543210');
  });

  it('handles numbers with leading 00 or 0', () => {
    const res1 = normalizePhone('00919876543210');
    expect(res1.formatted).toBe('919876543210');

    const res2 = normalizePhone('09876543210', '91');
    expect(res2.formatted).toBe('919876543210');
  });

  it('rejects short or invalid phone numbers', () => {
    const res = normalizePhone('12345');
    expect(res.isValid).toBe(false);
  });
});

describe('2. Deduplication Logic', () => {
  it('removes duplicate contacts based on phone number', () => {
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

describe('3. Spintax & Variable Rendering', () => {
  it('resolves spintax variations randomly', () => {
    const template = '{Hi|Hello|Dear} {name}!';
    const rendered = renderMessage(template, { name: 'Aarav' });
    expect(rendered.includes('Aarav')).toBe(true);
    expect(rendered.startsWith('Hi') || rendered.startsWith('Hello') || rendered.startsWith('Dear')).toBe(true);
  });

  it('supports variable fallback syntax {name|fallback}', () => {
    const template = 'Hello {name|Valued Customer}, welcome to {company|our portal}!';
    
    // When name is missing
    const res1 = renderMessage(template, { name: '' });
    expect(res1).toContain('Hello Valued Customer');
    expect(res1).toContain('welcome to our portal');

    // When name is present
    const res2 = renderMessage(template, { name: 'John', custom_variables: { company: 'TechCorp' } });
    expect(res2).toContain('Hello John');
    expect(res2).toContain('welcome to TechCorp');
  });

  it('calculates spintax permutation counts accurately', () => {
    const template = '{Hi|Hello|Dear} {friend|customer}, {hope you are doing well|have a wonderful day}!';
    const count = countSpintaxVariations(template);
    expect(count).toBe(3 * 2 * 2); // 12 unique variations
  });
});

describe('4. Pacing, Jitter & Anti-Ban Risk Meter', () => {
  it('generates random jitter within configured min and max range', () => {
    for (let i = 0; i < 20; i++) {
      const delay = calculateJitterDelay(12, 25);
      expect(delay).toBeGreaterThanOrEqual(12);
      expect(delay).toBeLessThanOrEqual(25);
    }
  });

  it('checks sending window status correctly', () => {
    const check = isWithinSendingWindow('00:00', '23:59', 'Asia/Kolkata');
    expect(check.isInsideWindow).toBe(true);
  });

  it('computes anti-ban risk score and warns on unsafe pacing (<5s)', () => {
    const highRisk = computeRiskMeter({ minDelay: 4, maxDelay: 8, dailyVolume: 600 });
    expect(highRisk.score).toBeGreaterThan(60);
    expect(highRisk.warnings.length).toBeGreaterThan(0);
    expect(highRisk.warnings.some((w) => w.includes('under 5 seconds'))).toBe(true);

    const safe = computeRiskMeter({ minDelay: 15, maxDelay: 30, dailyVolume: 100 });
    expect(safe.level).toBe('LOW');
  });
});

describe('5. AES-256-GCM Encryption At Rest', () => {
  it('encrypts and decrypts sensitive API keys cleanly', () => {
    const originalApiKey = '429683C4C97741_SUPER_SECRET';
    const encrypted = encrypt(originalApiKey);
    expect(encrypted).not.toBe(originalApiKey);
    expect(encrypted.split(':').length).toBe(3); // iv:tag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalApiKey);
  });
});

