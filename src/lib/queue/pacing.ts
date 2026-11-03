/**
 * Pacing, Anti-Ban & Risk Meter Logic
 */

export interface SendingWindowCheck {
  isInsideWindow: boolean;
  currentHourStr: string;
  windowStart: string;
  windowEnd: string;
}

/**
 * Checks whether current local time in given timezone is within allowed window
 */
export function isWithinSendingWindow(
  windowStart: string = '09:00',
  windowEnd: string = '20:00',
  timezone: string = 'Asia/Kolkata'
): SendingWindowCheck {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = parts.find((p) => p.type === 'hour')?.value || '12';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const currentTimeStr = `${hour}:${minute}`;

    const isInside = currentTimeStr >= windowStart && currentTimeStr <= windowEnd;

    return {
      isInsideWindow: isInside,
      currentHourStr: currentTimeStr,
      windowStart,
      windowEnd,
    };
  } catch {
    return {
      isInsideWindow: true,
      currentHourStr: '12:00',
      windowStart,
      windowEnd,
    };
  }
}

/**
 * Calculates a random delay in seconds between minDelay and maxDelay with jitter
 */
export function calculateJitterDelay(minDelay: number = 12, maxDelay: number = 25): number {
  const min = Math.max(1, minDelay);
  const max = Math.max(min, maxDelay);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Evaluates Anti-Ban Risk Meter:
 * Returns score 0-100, level ('LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'), and warnings
 */
export function computeRiskMeter(params: {
  minDelay: number;
  maxDelay: number;
  dailyVolume: number;
  failureRatePercent?: number;
  warmUpMode?: boolean;
}): { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'; warnings: string[] } {
  let score = 15; // baseline low risk
  const warnings: string[] = [];

  // 1. Delay Assessment
  if (params.minDelay < 5) {
    score += 55;
    warnings.push('Delay under 5 seconds is extremely high risk for algorithmic WhatsApp bans.');
  } else if (params.minDelay < 10) {
    score += 30;
    warnings.push('Delay under 10 seconds is high risk. 12-25s recommended.');
  } else if (params.minDelay < 15) {
    score += 10;
  }

  // 2. Daily Volume
  if (params.dailyVolume > 500) {
    score += 30;
    warnings.push('Target volume exceeds 500/day on single instance.');
  } else if (params.dailyVolume > 250) {
    score += 15;
  }

  // 3. Failure Rate
  if (params.failureRatePercent && params.failureRatePercent > 15) {
    score += 25;
    warnings.push(`Recent delivery failure rate is high (${params.failureRatePercent.toFixed(1)}%).`);
  }

  score = Math.min(100, Math.max(0, score));

  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
  if (score >= 70) level = 'EXTREME';
  else if (score >= 45) level = 'HIGH';
  else if (score >= 25) level = 'MEDIUM';

  return { score, level, warnings };
}

/**
 * Calculates warm-up daily cap ramp over days
 */
export function getWarmUpDailyCap(day: number): number {
  const schedule = [20, 40, 80, 150, 250, 400];
  const idx = Math.min(Math.max(1, day) - 1, schedule.length - 1);
  return schedule[idx];
}

