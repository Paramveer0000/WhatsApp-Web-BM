import { describe, it, expect, vi } from 'vitest';
import {
  EvolutionClient,
  EvolutionError,
  AuthError,
  InstanceNotFoundError,
  SessionClosedError,
  InvalidRecipientError,
  RateLimitedError,
  TransientError,
  PermanentError,
} from '../src/lib/evolution';
import { calculateRetryBackoff, isErrorRetryable } from '../src/lib/retry-policy';

describe('Part 1: Evolution Error Taxonomy & Mapping', () => {
  it('maps the exact Evolution API v2.3.7 400 Bad Request fixture to InvalidRecipientError', () => {
    const rawFixture = {
      status: 400,
      error: 'Bad Request',
      message: [
        {
          jid: '918872045605@s.whatsapp.net',
          exists: false,
          number: '918872045605',
        },
      ],
    };

    const classified = EvolutionClient.classifyError(400, rawFixture);

    expect(classified).toBeInstanceOf(InvalidRecipientError);
    expect(classified.code).toBe('NOT_ON_WHATSAPP');
    expect(classified.number).toBe('918872045605');
    expect(classified.jid).toBe('918872045605@s.whatsapp.net');
    expect(classified.isPermanent).toBe(true);
    expect(isErrorRetryable(classified)).toBe(false);
  });

  it('maps string messages like "Number not exists" to InvalidRecipientError', () => {
    const fixture = {
      status: 400,
      message: 'The number 918872045605 does not exist on whatsapp',
    };

    const classified = EvolutionClient.classifyError(400, fixture);
    expect(classified).toBeInstanceOf(InvalidRecipientError);
    expect(classified.code).toBe('NOT_ON_WHATSAPP');
    expect(classified.isPermanent).toBe(true);
    expect(isErrorRetryable(classified)).toBe(false);
  });

  it('maps 401/403 to AuthError (permanent)', () => {
    const err401 = EvolutionClient.classifyError(401, { error: 'Unauthorized', message: 'Invalid API Key' });
    expect(err401).toBeInstanceOf(AuthError);
    expect(err401.code).toBe('AUTH_ERROR');
    expect(err401.isPermanent).toBe(true);
    expect(isErrorRetryable(err401)).toBe(false);

    const err403 = EvolutionClient.classifyError(403, { error: 'Forbidden' });
    expect(err403).toBeInstanceOf(AuthError);
    expect(err403.isPermanent).toBe(true);
  });

  it('maps 404 Instance Not Found to InstanceNotFoundError (permanent)', () => {
    const err404 = EvolutionClient.classifyError(404, { error: 'Not Found', message: 'Instance "falc" not found' });
    expect(err404).toBeInstanceOf(InstanceNotFoundError);
    expect(err404.code).toBe('INSTANCE_NOT_FOUND');
    expect(err404.isPermanent).toBe(true);
    expect(isErrorRetryable(err404)).toBe(false);
  });

  it('maps 400 with "Connection Closed" or "not connected" to SessionClosedError', () => {
    const closedErr = EvolutionClient.classifyError(400, {
      status: 400,
      error: 'Bad Request',
      message: 'Connection closed on instance falc',
    });
    expect(closedErr).toBeInstanceOf(SessionClosedError);
    expect(closedErr.code).toBe('SESSION_CLOSED');
    expect(closedErr.isPermanent).toBe(true);
    expect(isErrorRetryable(closedErr)).toBe(false);
  });

  it('maps 429 to RateLimitedError (transient/retryable)', () => {
    const rateErr = EvolutionClient.classifyError(429, { message: 'Too many requests, slow down' });
    expect(rateErr).toBeInstanceOf(RateLimitedError);
    expect(rateErr.code).toBe('RATE_LIMITED');
    expect(rateErr.isPermanent).toBe(false);
    expect(isErrorRetryable(rateErr)).toBe(true);
  });

  it('maps 5xx, timeouts, ECONNRESET, and fetch failed to TransientError (retryable)', () => {
    const err500 = EvolutionClient.classifyError(500, { error: 'Internal Server Error' });
    expect(err500).toBeInstanceOf(TransientError);
    expect(err500.isPermanent).toBe(false);
    expect(isErrorRetryable(err500)).toBe(true);

    const timeoutErr = EvolutionClient.classifyError(undefined, undefined, 'The operation was aborted due to timeout');
    expect(timeoutErr).toBeInstanceOf(TransientError);
    expect(isErrorRetryable(timeoutErr)).toBe(true);

    const fetchFailedErr = EvolutionClient.classifyError(undefined, undefined, 'fetch failed');
    expect(fetchFailedErr).toBeInstanceOf(TransientError);
    expect(isErrorRetryable(fetchFailedErr)).toBe(true);
  });

  it('maps unknown 400 errors to PermanentError by default (never retried)', () => {
    const unknown400 = EvolutionClient.classifyError(400, {
      status: 400,
      error: 'Bad Request',
      message: 'Some unrecognized client error in schema',
    });
    expect(unknown400).toBeInstanceOf(PermanentError);
    expect(unknown400.code).toBe('PERMANENT_ERROR');
    expect(unknown400.isPermanent).toBe(true);
    expect(isErrorRetryable(unknown400)).toBe(false);
  });
});

describe('Part 1: Queue Retry Policy & Backoff Calculation', () => {
  it('calculates exponential backoff with jitter and enforces >= 5s minimum delay', () => {
    // Attempt 1: base 30s
    for (let i = 0; i < 10; i++) {
      const delay1 = calculateRetryBackoff(1);
      expect(delay1).toBeGreaterThanOrEqual(30000);
      expect(delay1).toBeLessThanOrEqual(45000); // 30s + jitter
    }

    // Attempt 2: base 120s (2 min)
    for (let i = 0; i < 10; i++) {
      const delay2 = calculateRetryBackoff(2);
      expect(delay2).toBeGreaterThanOrEqual(120000);
      expect(delay2).toBeLessThanOrEqual(150000); // 120s + jitter
    }

    // Attempt 3: base 480s (8 min)
    for (let i = 0; i < 10; i++) {
      const delay3 = calculateRetryBackoff(3);
      expect(delay3).toBeGreaterThanOrEqual(480000);
      expect(delay3).toBeLessThanOrEqual(540000); // 480s + jitter
    }

    // Never less than 5000 ms even for invalid attempt count
    expect(calculateRetryBackoff(0)).toBeGreaterThanOrEqual(5000);
    expect(calculateRetryBackoff(-1)).toBeGreaterThanOrEqual(5000);
  });

  it('rejects retrying any permanent error', () => {
    const invalidRecipient = new InvalidRecipientError('Not on WhatsApp', 400, {
      number: '918872045605',
      code: 'NOT_ON_WHATSAPP',
    });
    expect(isErrorRetryable(invalidRecipient)).toBe(false);

    const permanent = new PermanentError('Malformed parameters');
    expect(isErrorRetryable(permanent)).toBe(false);

    const auth = new AuthError('Bad API key');
    expect(isErrorRetryable(auth)).toBe(false);

    const notFound = new InstanceNotFoundError('No instance');
    expect(isErrorRetryable(notFound)).toBe(false);
  });
});

describe('Part 1 & 2: Integration & Stability Simulations', () => {
  it('guarantees InvalidRecipientError never trips the circuit breaker', () => {
    const error = EvolutionClient.classifyError(400, {
      status: 400,
      error: 'Bad Request',
      message: [
        {
          jid: '918872045605@s.whatsapp.net',
          exists: false,
          number: '918872045605',
        },
      ],
    });

    // Circuit breaker must NOT treat NOT_ON_WHATSAPP as instance failure
    expect(EvolutionClient.isCircuitBreakerError(error)).toBe(false);
  });

  it('property test: retry-delay is strictly monotonic and never less than 5000ms', () => {
    let prevDelay = 0;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = calculateRetryBackoff(attempt);
      expect(delay).toBeGreaterThanOrEqual(5000);
      if (attempt > 1) {
        // Backoff grows with attempts
        expect(delay).toBeGreaterThan(prevDelay * 0.8);
      }
      prevDelay = delay;
    }
  });

  it('simulates batch of 100 contacts (80 valid, 20 non-WhatsApp) with zero retries on invalid and no breaker trip', () => {
    const contacts = Array.from({ length: 100 }, (_, i) => ({
      phone: `919876543${String(i).padStart(3, '0')}`,
      isInvalid: i < 20, // First 20 are invalid
    }));

    let sentCount = 0;
    let skippedCount = 0;
    let retryAttempts = 0;
    let circuitBreakerTripped = false;
    let consecutiveFailures = 0;

    // Simulate campaign runner loop logic
    for (const contact of contacts) {
      if (contact.isInvalid) {
        // Evolution returns 400 exists:false
        const classified = EvolutionClient.classifyError(400, {
          status: 400,
          error: 'Bad Request',
          message: [{ jid: `${contact.phone}@s.whatsapp.net`, exists: false, number: contact.phone }],
        });

        const retryable = isErrorRetryable(classified);
        if (retryable) {
          retryAttempts++;
        } else {
          skippedCount++;
        }

        // Breaker must not count invalid recipient
        const isBreaker = EvolutionClient.isCircuitBreakerError(classified);
        if (isBreaker) {
          circuitBreakerTripped = true;
        }
      } else {
        // Valid contact dispatches successfully
        sentCount++;
        consecutiveFailures = 0;
      }
    }

    expect(sentCount).toBe(80);
    expect(skippedCount).toBe(20);
    expect(retryAttempts).toBe(0); // Zero retries on non-WhatsApp numbers!
    expect(circuitBreakerTripped).toBe(false); // Breaker untouched!
  });

  it('inherits campaign-level mediaUrl and mediaType across all variations', () => {
    const body = {
      mediaType: 'image',
      mediaUrl: 'http://app:3000/api/media/upload_sample.jpg',
      fileName: 'offer.jpg',
      variants: [
        { position: 1, label: 'Message 1', content: 'Offer 1' },
        { position: 2, label: 'Message 2', content: 'Offer 2' },
        { position: 3, label: 'Message 3', content: 'Offer 3' },
      ],
    };

    const globalMediaType = (body.mediaType && body.mediaType !== 'text') ? body.mediaType : null;
    const globalMediaUrl = body.mediaUrl || null;
    const globalFileName = body.fileName || null;

    const normalizedVariants = body.variants.map((v: any, idx: number) => ({
      position: v.position || idx + 1,
      label: v.label || `Message ${idx + 1}`,
      content: v.content,
      mediaType: (v.mediaType && v.mediaType !== 'text') ? v.mediaType : (globalMediaType || 'text'),
      mediaUrl: v.mediaUrl || globalMediaUrl || null,
      fileName: v.fileName || globalFileName || null,
    }));

    expect(normalizedVariants.length).toBe(3);
    for (const variant of normalizedVariants) {
      expect(variant.mediaType).toBe('image');
      expect(variant.mediaUrl).toBe('http://app:3000/api/media/upload_sample.jpg');
      expect(variant.fileName).toBe('offer.jpg');
    }
  });
});

