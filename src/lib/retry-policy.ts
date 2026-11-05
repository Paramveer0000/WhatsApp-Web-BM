import {
  EvolutionError,
  InvalidRecipientError,
  AuthError,
  InstanceNotFoundError,
  SessionClosedError,
  PermanentError,
  TransientError,
  RateLimitedError,
} from './evolution';

/**
 * Calculates exponential backoff with jitter for transient retries.
 * Attempt 1: 30s + jitter (30s - 45s)
 * Attempt 2: 120s (2m) + jitter (120s - 150s)
 * Attempt 3+: 480s (8m) + jitter (480s - 540s)
 * Minimum backoff is strictly guaranteed to be >= 5000 ms.
 */
export function calculateRetryBackoff(attempt: number): number {
  if (attempt <= 1) {
    const jitter = Math.floor(Math.random() * 15000);
    return Math.max(5000, 30000 + jitter);
  }
  if (attempt === 2) {
    const jitter = Math.floor(Math.random() * 30000);
    return Math.max(5000, 120000 + jitter);
  }
  // attempt >= 3
  const jitter = Math.floor(Math.random() * 60000);
  return Math.max(5000, 480000 + jitter);
}

/**
 * Determines whether an error class is safe to retry.
 * ONLY TransientError and RateLimitedError are retryable.
 * InvalidRecipientError, AuthError, InstanceNotFoundError, SessionClosedError,
 * and PermanentError are NEVER retried.
 */
export function isErrorRetryable(err: any): boolean {
  if (!err) return false;
  if (err.isPermanent === true) return false;

  if (
    err instanceof InvalidRecipientError ||
    err instanceof AuthError ||
    err instanceof InstanceNotFoundError ||
    err instanceof SessionClosedError ||
    err instanceof PermanentError
  ) {
    return false;
  }

  if (err instanceof TransientError || err instanceof RateLimitedError) {
    return true;
  }

  // If code is explicit
  if (err.code === 'NOT_ON_WHATSAPP' || err.code === 'AUTH_ERROR' || err.code === 'INSTANCE_NOT_FOUND') {
    return false;
  }
  if (err.code === 'TRANSIENT_ERROR' || err.code === 'RATE_LIMITED') {
    return true;
  }

  // String check fallbacks
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('not on whatsapp') ||
    msg.includes('not registered') ||
    msg.includes('exists:false') ||
    msg.includes('exists: false') ||
    msg.includes('invalid recipient')
  ) {
    return false;
  }

  // Default: non-retryable to prevent retry loops
  return false;
}
