/**
 * Pure typing duration calculation based on characters and human cadence models.
 */

export interface TypingModelOptions {
  chars: number;
  cpsMin?: number; // Characters per second min (default: 6)
  cpsMax?: number; // Characters per second max (default: 9)
  minMs?: number; // Floor (default: 1200ms)
  maxMs?: number; // Ceiling (default: 7000ms)
  seedRatio?: number; // Deterministic random factor 0..1 (default: Math.random())
  includeHesitation?: boolean;
}

export function computeTypingDurationMs(options: TypingModelOptions): {
  durationMs: number;
  cpsUsed: number;
  hesitationMs: number;
} {
  const {
    chars,
    cpsMin = 6,
    cpsMax = 9,
    minMs = 1200,
    maxMs = 7000,
    seedRatio = 0.5,
    includeHesitation = true,
  } = options;

  if (chars <= 0) {
    return { durationMs: minMs, cpsUsed: cpsMin, hesitationMs: 0 };
  }

  // Linear interpolation of typing speed based on seedRatio
  const effectiveCps = cpsMin + (cpsMax - cpsMin) * Math.max(0, Math.min(1, seedRatio));

  // Base typing duration in milliseconds: (chars / cps) * 1000
  let rawDuration = (chars / effectiveCps) * 1000;

  // Add micro-hesitation pause for long messages (>100 characters) to simulate thinking while typing
  let hesitationMs = 0;
  if (includeHesitation && chars > 100) {
    // 300ms to 900ms pause
    hesitationMs = Math.round(300 + 600 * seedRatio);
    rawDuration += hesitationMs;
  }

  // Clamp within bounds
  const clampedDuration = Math.round(Math.max(minMs, Math.min(maxMs, rawDuration)));

  return {
    durationMs: clampedDuration,
    cpsUsed: Math.round(effectiveCps * 10) / 10,
    hesitationMs,
  };
}
