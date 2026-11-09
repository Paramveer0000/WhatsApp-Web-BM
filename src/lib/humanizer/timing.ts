import { HumanizerTimingConfig } from './types';

/**
 * Deterministic fast 32-bit integer hash from string seed (Murmur/FNV-style).
 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}

/**
 * Deterministic pseudo-random number generator [0, 1) from integer seed.
 */
export function seededRandom(seedValue: number, stepIndex: number = 0): number {
  let s = (seedValue + stepIndex * 0x6d2b79f5) >>> 0;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
}

/**
 * Samples a triangular distribution between min and max with mode in the lower-middle half.
 */
export function sampleTriangular(min: number, max: number, rand: number, modeRatio: number = 0.35): number {
  if (min >= max) return min;
  const mode = min + (max - min) * modeRatio;
  const split = (mode - min) / (max - min);

  if (rand < split) {
    return min + Math.sqrt(rand * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - rand) * (max - min) * (max - mode));
  }
}

export interface SampleDelaysInput {
  seed: string;
  timing: HumanizerTimingConfig;
  inboundLength?: number;
  isAiAnswer?: boolean;
  urgentNoDelay?: boolean;
}

export interface SampledDelays {
  readDelayMs: number;
  thinkingPauseMs: number;
  interBubbleDelayMs: number;
  isNightMode: boolean;
  budgetClamped: boolean;
}

export function sampleDelays(input: SampleDelaysInput): SampledDelays {
  const { seed, timing, inboundLength = 30, isAiAnswer = false, urgentNoDelay = false } = input;

  if (urgentNoDelay) {
    return {
      readDelayMs: 0,
      thinkingPauseMs: 0,
      interBubbleDelayMs: 200,
      isNightMode: false,
      budgetClamped: false,
    };
  }

  const baseHash = hashSeed(seed);
  const r1 = seededRandom(baseHash, 1);
  const r2 = seededRandom(baseHash, 2);
  const r3 = seededRandom(baseHash, 3);

  // 1. Read Delay (scaled slightly by inbound length: longer messages take longer to read)
  const lengthScale = Math.min(1.8, Math.max(1.0, 1 + inboundLength / 180));
  const rawReadDelay = sampleTriangular(timing.readDelayMinMs, timing.readDelayMaxMs, r1);
  const readDelayMs = timing.autoMarkRead ? Math.round(rawReadDelay * lengthScale) : 0;

  // 2. Thinking Pause (AI responses naturally take longer to formulate)
  const rawThinking = sampleTriangular(timing.thinkingPauseMinMs, timing.thinkingPauseMaxMs, r2);
  const thinkingPauseMs = isAiAnswer ? Math.round(rawThinking * 1.5) : Math.round(rawThinking);

  // 3. Inter-Bubble Delay
  const interBubbleDelayMs = Math.round(
    sampleTriangular(timing.interBubbleDelayMinMs, timing.interBubbleDelayMaxMs, r3)
  );

  // 4. Night Mode / Quiet Hours check
  const now = new Date();
  const currentHour = now.getHours();
  let isNightMode = false;
  if (timing.nightModeEnabled) {
    if (timing.nightStartHour > timing.nightEndHour) {
      // e.g. 22:00 to 08:00
      isNightMode = currentHour >= timing.nightStartHour || currentHour < timing.nightEndHour;
    } else {
      isNightMode = currentHour >= timing.nightStartHour && currentHour < timing.nightEndHour;
    }
  }

  return {
    readDelayMs,
    thinkingPauseMs,
    interBubbleDelayMs,
    isNightMode,
    budgetClamped: false,
  };
}

