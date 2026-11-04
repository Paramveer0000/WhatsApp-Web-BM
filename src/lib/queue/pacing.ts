import { DateTime } from 'luxon';

export interface SendingWindowCheck {
  isInsideWindow: boolean;
  currentHourStr: string;
  windowStart: string;
  windowEnd: string;
  msUntilWindowStart?: number;
}

export const DEFAULT_WARMUP_SCHEDULE = [20, 40, 60, 100, 150, 200, 250];

/**
 * Checks whether current local time in given IANA timezone is within allowed window
 */
export function isWithinSendingWindow(
  windowStart: string = '09:00',
  windowEnd: string = '20:00',
  timezone: string = 'Asia/Kolkata'
): SendingWindowCheck {
  try {
    const now = DateTime.now().setZone(timezone);
    const currentTimeStr = now.toFormat('HH:mm');

    const [startH, startM] = windowStart.split(':').map(Number);
    const [endH, endM] = windowEnd.split(':').map(Number);

    const windowStartTime = now.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
    let targetStart = windowStartTime;

    const isInside = currentTimeStr >= windowStart && currentTimeStr <= windowEnd;

    let msUntilWindowStart = 0;
    if (!isInside) {
      if (currentTimeStr > windowEnd) {
        // Roll over to tomorrow's window start
        targetStart = windowStartTime.plus({ days: 1 });
      }
      msUntilWindowStart = Math.max(1000, targetStart.diff(now).milliseconds);
    }

    return {
      isInsideWindow: isInside,
      currentHourStr: currentTimeStr,
      windowStart,
      windowEnd,
      msUntilWindowStart,
    };
  } catch {
    return {
      isInsideWindow: true,
      currentHourStr: '12:00',
      windowStart,
      windowEnd,
      msUntilWindowStart: 0,
    };
  }
}

/**
 * Triangular distribution generator:
 * Avoids flat mechanical uniform randoms, concentrates density realistically around the lower-middle mode.
 */
export function sampleTriangular(min: number, max: number, mode?: number): number {
  const c = mode !== undefined ? mode : min + (max - min) * 0.35;
  const u = Math.random();
  const f = (c - min) / (max - min);

  if (u <= f) {
    return min + Math.sqrt(u * (max - min) * (c - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - c));
  }
}

/**
 * Calculates a natural human-like jitter delay in seconds.
 * Truncated triangular distribution within [min, max] with a 3-5% chance of a "human pause" (30-90s).
 */
export function calculateJitterDelay(
  minDelay: number = 12,
  maxDelay: number = 25,
  allowHumanPause: boolean = true,
  humanPauseProbability: number = 0.04
): number {
  const min = Math.max(1, minDelay);
  const max = Math.max(min, maxDelay);

  // 3-5% human coffee/distraction pause
  if (allowHumanPause && Math.random() < humanPauseProbability) {
    const humanPause = Math.floor(sampleTriangular(30, 90, 45));
    return humanPause;
  }

  const sampled = sampleTriangular(min, max);
  return Math.round(sampled);
}

/**
 * Calculates the effective daily cap for an instance on warm-up mode
 */
export function getEffectiveWarmupCap(
  warmupDay: number = 1,
  instanceCap: number = 200,
  schedule: number[] = DEFAULT_WARMUP_SCHEDULE
): number {
  if (warmupDay <= 0) return schedule[0] ?? 20;
  const index = Math.min(warmupDay - 1, schedule.length - 1);
  const scheduledCap = schedule[index] ?? 200;
  return Math.min(instanceCap, scheduledCap);
}

/**
 * Evaluates Comprehensive Anti-Ban Risk Score (0-100)
 */
export function computeRiskMeter(params: {
  minDelay: number;
  maxDelay: number;
  dailyVolume: number;
  failureRatePercent?: number;
  optOutRatePercent?: number;
  variantCount?: number;
  hasLinks?: boolean;
  hasSpamKeywords?: boolean;
}): { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'; warnings: string[] } {
  let score = 10; // baseline
  const warnings: string[] = [];

  // 1. Delay Assessment
  if (params.minDelay < 5) {
    score += 55;
    warnings.push('CRITICAL: Delay under 5 seconds triggers automated WhatsApp rate detection.');
  } else if (params.minDelay < 10) {
    score += 30;
    warnings.push('HIGH: Delay under 10 seconds is elevated risk. 12-25s recommended.');
  } else if (params.minDelay < 15) {
    score += 10;
  }

  // 2. Daily Volume
  if (params.dailyVolume > 500) {
    score += 30;
    warnings.push('Target daily volume exceeds 500 messages per number.');
  } else if (params.dailyVolume > 250) {
    score += 15;
  }

  // 3. Failure Rate
  if (params.failureRatePercent && params.failureRatePercent > 15) {
    score += 25;
    warnings.push(`High delivery failure rate (${params.failureRatePercent.toFixed(1)}%). Check number quality.`);
  }

  // 4. Opt-Out Rate
  if (params.optOutRatePercent && params.optOutRatePercent > 5) {
    score += 30;
    warnings.push(`Recent opt-out rate is elevated (${params.optOutRatePercent.toFixed(1)}%). Audience consent issue.`);
  }

  // 5. Variant Diversity
  if (params.variantCount !== undefined && params.variantCount < 5 && params.dailyVolume > 100) {
    score += 15;
    warnings.push('Low message variation count for a large campaign. Add more Spintax options.');
  }

  // 6. Content Heuristics
  if (params.hasLinks) {
    score += 10;
    warnings.push('Contains URLs. Unsaved contacts receiving bare links may report as spam.');
  }
  if (params.hasSpamKeywords) {
    score += 15;
    warnings.push('High concentration of promotional trigger words detected.');
  }

  score = Math.min(100, Math.max(0, score));

  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
  if (score >= 75) level = 'EXTREME';
  else if (score >= 50) level = 'HIGH';
  else if (score >= 25) level = 'MEDIUM';

  return { score, level, warnings };
}
