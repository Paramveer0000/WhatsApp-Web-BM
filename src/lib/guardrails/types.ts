import { z } from 'zod';

export const GuardrailConfigSchema = z.object({
  // 2.1 Message Pacing
  pacing: z.object({
    minDelay: z.number().min(3).max(300).default(12),
    maxDelay: z.number().min(3).max(300).default(25),
    distribution: z.enum(['uniform', 'triangular', 'log-normal']).default('log-normal'),
    humanPause: z.object({
      enabled: z.boolean().default(true),
      probabilityPercent: z.number().min(1).max(50).default(4),
      minPauseSec: z.number().min(10).max(600).default(30),
      maxPauseSec: z.number().min(10).max(600).default(90),
    }).default({
      enabled: true,
      probabilityPercent: 4,
      minPauseSec: 30,
      maxPauseSec: 90,
    }),
    typingSimulation: z.object({
      enabled: z.boolean().default(true),
      baseMsPerChar: z.number().min(10).max(200).default(40),
      minTypingSec: z.number().min(0.5).max(10).default(1.2),
      maxTypingSec: z.number().min(0.5).max(20).default(5.0),
      setOnlinePresence: z.boolean().default(true),
    }).default({
      enabled: true,
      baseMsPerChar: 40,
      minTypingSec: 1.2,
      maxTypingSec: 5.0,
      setOnlinePresence: true,
    }),
  }).refine((data) => data.maxDelay >= data.minDelay, {
    message: 'Max delay must be greater than or equal to min delay',
    path: ['maxDelay'],
  }),

  // 2.2 Volume Limits
  volumeLimits: z.object({
    dailyCapPerNumber: z.number().min(1).max(2000).default(200),
    hourlyCap: z.number().min(1).max(500).default(40),
    perMinuteCap: z.number().min(1).max(50).default(3),
    perCampaignCap: z.number().min(1).max(100000).default(5000),
    perContactFrequencyDays: z.number().min(1).max(90).default(3),
    capResetTime: z.string().default('00:00'),
    timezone: z.string().default('Asia/Kolkata'),
    onCapReached: z.enum(['pause', 'stop', 'rotate']).default('pause'),
  }),

  // 2.3 Batch & Cooldown
  batchCooldown: z.object({
    batchSizeMin: z.number().min(5).max(200).default(20),
    batchSizeMax: z.number().min(5).max(200).default(40),
    cooldownMinSec: z.number().min(30).max(3600).default(180),
    cooldownMaxSec: z.number().min(30).max(3600).default(480),
    longBreakEvery: z.number().min(20).max(1000).default(150),
    longBreakMinSec: z.number().min(60).max(7200).default(1200),
    longBreakMaxSec: z.number().min(60).max(7200).default(2400),
    overnightQuiet: z.boolean().default(true),
  }).refine((data) => data.batchSizeMax >= data.batchSizeMin, {
    message: 'Batch size max must be >= batch size min',
    path: ['batchSizeMax'],
  }),

  // 2.4 Sending Window
  sendingWindow: z.object({
    daysOfWeek: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5, 6]), // 0=Sun, 1=Mon...
    startTime: z.string().default('09:00'),
    endTime: z.string().default('20:00'),
    timezone: z.string().default('Asia/Kolkata'),
    recipientTimezoneAware: z.boolean().default(false),
    fallbackTimezone: z.string().default('Asia/Kolkata'),
    blackoutDates: z.array(z.string()).default([]), // YYYY-MM-DD
  }),

  // 2.5 Warm-Up Program
  warmUp: z.object({
    enabled: z.boolean().default(true),
    numberAgeDays: z.number().min(0).max(3650).default(0),
    schedule: z.array(z.object({
      day: z.number(),
      cap: z.number(),
    })).default([
      { day: 1, cap: 20 },
      { day: 2, cap: 40 },
      { day: 3, cap: 60 },
      { day: 4, cap: 100 },
      { day: 5, cap: 150 },
      { day: 6, cap: 200 },
      { day: 7, cap: 250 },
    ]),
    autoExtendOnHighFailure: z.boolean().default(true),
    failureThresholdPercent: z.number().min(1).max(50).default(15),
    trustedListOnly: z.boolean().default(false),
    trustedListId: z.string().optional(),
  }),

  // 2.5b Number Health & Reputation Signals
  healthSignals: z.object({
    failureRateThresholdPercent: z.number().min(1).max(50).default(20),
    failureRateWindow: z.number().min(10).max(200).default(50),
    notOnWhatsAppThresholdPercent: z.number().min(1).max(50).default(15),
    optOutRateThresholdPercent: z.number().min(1).max(30).default(5),
    complaintKeywords: z.array(z.string()).default(['spam', 'report', 'block', 'fraud', 'stop calling']),
    zeroReceiptsThreshold: z.number().min(3).max(50).default(10),
    actionOnTrigger: z.enum(['widen_delays', 'pause_campaign', 'alert_only']).default('pause_campaign'),
    autoRecoveryMinutes: z.number().min(0).max(1440).default(30),
    recoverySpeedFactor: z.number().min(0.1).max(1.0).default(0.5),
  }),

  // 2.6 Circuit Breakers
  circuitBreakers: z.object({
    pauseOnSessionClosed: z.boolean().default(true),
    authErrorLockedOn: z.boolean().default(true),
    consecutiveTransientFailures: z.number().min(1).max(20).default(5),
    halfOpenProbeIntervalSec: z.number().min(5).max(300).default(30),
    maxAutoRetries: z.number().min(0).max(5).default(2),
    rateLimitMultiplier: z.number().min(1.2).max(5.0).default(2.0),
    rateLimitDurationSec: z.number().min(30).max(3600).default(300),
  }),

  // 2.7 Content Safety
  contentSafety: z.object({
    requireSpintax: z.boolean().default(true),
    minUniqueVariants: z.number().min(1).max(100).default(6),
    blockIdenticalThreshold: z.number().min(5).max(200).default(30),
    linkPolicy: z.enum(['allow', 'max_one', 'block']).default('max_one'),
    allowedDomains: z.array(z.string()).default([]),
    blockedDomains: z.array(z.string()).default(['bit.ly', 'tinyurl.com', 't.co']),
    maxMessageLength: z.number().min(100).max(4096).default(1000),
    blockedWords: z.array(z.string()).default([
      'lottery', 'winner', 'crypto investment', '100% free cash', 'loan approved',
      'gambling', 'casino', 'jackpot'
    ]),
    requirePersonalization: z.boolean().default(true),
    mandatoryOptOut: z.boolean().default(true),
    optOutText: z.string().default('Reply STOP to unsubscribe'),
    optOutPosition: z.enum(['footer', 'header']).default('footer'),
    maxMediaPerHour: z.number().min(1).max(500).default(60),
    maxFileSizeMb: z.number().min(1).max(100).default(16),
    blockingMode: z.enum(['block_launch', 'warn_only']).default('block_launch'),
  }),

  // 2.8 Consent & Opt-Out
  consentOptOut: z.object({
    requireConsentLockedOn: z.boolean().default(true),
    optOutKeywords: z.array(z.string()).default(['STOP', 'UNSUBSCRIBE', 'REMOVE', 'CANCEL', 'ROKO', 'BAND KARO']),
    matchMode: z.enum(['exact', 'contains', 'starts_with']).default('contains'),
    caseInsensitive: z.boolean().default(true),
    sendOptOutAck: z.boolean().default(true),
    optOutAckText: z.string().default('You have been unsubscribed and will not receive further messages.'),
    reOptInKeywords: z.array(z.string()).default(['START', 'RESUME', 'CHALU KARO']),
    stalenessMonths: z.number().min(1).max(24).default(6),
  }),

  // 2.9 Recipient Filtering
  recipientFiltering: z.object({
    skipNotOnWhatsApp: z.boolean().default(true),
    skipInvalidFormat: z.boolean().default(true),
    skipLandlines: z.boolean().default(true),
    skipDuplicates: z.boolean().default(true),
    skipBlacklisted: z.boolean().default(true),
    skipFrequencyLimited: z.boolean().default(true),
    allowedCountryCodes: z.array(z.string()).default(['91']),
    blockedCountryCodes: z.array(z.string()).default([]),
    coldContactThrottlePercent: z.number().min(10).max(100).default(50),
    prioritizeEngaged: z.boolean().default(true),
  }),

  // 2.10 Multi-Number Rotation
  rotation: z.object({
    strategy: z.enum(['round_robin', 'least_used', 'weighted', 'sticky']).default('least_used'),
    failoverOnBreaker: z.boolean().default(true),
    minGapBetweenSendsSec: z.number().min(1).max(60).default(8),
    perNumberOverrides: z.record(z.object({
      dailyCap: z.number().optional(),
      weight: z.number().optional(),
    })).default({}),
  }),

  // 2.11 Risk Policy & Overrides
  riskPolicy: z.object({
    riskScoreCeiling: z.number().min(10).max(100).default(70),
    warningThreshold: z.number().min(10).max(100).default(40),
    strictMode: z.boolean().default(false),
    requireTypedConfirmation: z.boolean().default(true),
  }),

  // 2.12 Notifications for Guardrail Events
  notifications: z.object({
    channels: z.object({
      inApp: z.boolean().default(true),
      telegram: z.boolean().default(false),
      telegramBotToken: z.string().optional(),
      telegramChatId: z.string().optional(),
      webhook: z.boolean().default(false),
      webhookUrl: z.string().optional(),
      webhookSecret: z.string().optional(),
      email: z.boolean().default(false),
    }).default({ inApp: true, telegram: false, webhook: false, email: false }),
    events: z.object({
      breaker: z.boolean().default(true),
      cap: z.boolean().default(true),
      health: z.boolean().default(true),
      warmup: z.boolean().default(true),
      override: z.boolean().default(true),
      blocked: z.boolean().default(true),
    }).default({ breaker: true, cap: true, health: true, warmup: true, override: true, blocked: true }),
    quietHoursStart: z.string().default('22:00'),
    quietHoursEnd: z.string().default('08:00'),
  }),
});

export type GuardrailConfig = z.infer<typeof GuardrailConfigSchema>;

export const BASE_GUARDRAIL_RAW = {
  pacing: {
    minDelay: 12,
    maxDelay: 25,
    distribution: 'log-normal' as const,
    humanPause: { enabled: true, probabilityPercent: 4, minPauseSec: 30, maxPauseSec: 90 },
    typingSimulation: { enabled: true, baseMsPerChar: 40, minTypingSec: 1.2, maxTypingSec: 5.0, setOnlinePresence: true },
  },
  volumeLimits: {
    dailyCapPerNumber: 200,
    hourlyCap: 40,
    perMinuteCap: 3,
    perCampaignCap: 5000,
    perContactFrequencyDays: 3,
    capResetTime: '00:00',
    timezone: 'Asia/Kolkata',
    onCapReached: 'pause' as const,
  },
  batchCooldown: {
    batchSizeMin: 20,
    batchSizeMax: 40,
    cooldownMinSec: 180,
    cooldownMaxSec: 480,
    longBreakEvery: 150,
    longBreakMinSec: 1200,
    longBreakMaxSec: 2400,
    overnightQuiet: true,
  },
  sendingWindow: {
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '20:00',
    timezone: 'Asia/Kolkata',
    recipientTimezoneAware: false,
    fallbackTimezone: 'Asia/Kolkata',
    blackoutDates: [],
  },
  warmUp: {
    enabled: true,
    numberAgeDays: 0,
    schedule: [
      { day: 1, cap: 20 },
      { day: 2, cap: 40 },
      { day: 3, cap: 60 },
      { day: 4, cap: 100 },
      { day: 5, cap: 150 },
      { day: 6, cap: 200 },
      { day: 7, cap: 250 },
    ],
    autoExtendOnHighFailure: true,
    failureThresholdPercent: 15,
    trustedListOnly: false,
  },
  healthSignals: {
    failureRateThresholdPercent: 20,
    failureRateWindow: 50,
    notOnWhatsAppThresholdPercent: 15,
    optOutRateThresholdPercent: 5,
    complaintKeywords: ['spam', 'report', 'block', 'fraud', 'stop calling'],
    zeroReceiptsThreshold: 10,
    actionOnTrigger: 'pause_campaign' as const,
    autoRecoveryMinutes: 30,
    recoverySpeedFactor: 0.5,
  },
  circuitBreakers: {
    pauseOnSessionClosed: true,
    authErrorLockedOn: true,
    consecutiveTransientFailures: 5,
    halfOpenProbeIntervalSec: 30,
    maxAutoRetries: 2,
    rateLimitMultiplier: 2.0,
    rateLimitDurationSec: 300,
  },
  contentSafety: {
    requireSpintax: true,
    minUniqueVariants: 6,
    blockIdenticalThreshold: 30,
    linkPolicy: 'max_one' as const,
    allowedDomains: [],
    blockedDomains: ['bit.ly', 'tinyurl.com', 't.co'],
    maxMessageLength: 1000,
    blockedWords: [
      'lottery', 'winner', 'crypto investment', '100% free cash', 'loan approved',
      'gambling', 'casino', 'jackpot'
    ],
    requirePersonalization: true,
    mandatoryOptOut: true,
    optOutText: 'Reply STOP to unsubscribe',
    optOutPosition: 'footer' as const,
    maxMediaPerHour: 60,
    maxFileSizeMb: 16,
    blockingMode: 'block_launch' as const,
  },
  consentOptOut: {
    requireConsentLockedOn: true,
    optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'REMOVE', 'CANCEL', 'ROKO', 'BAND KARO'],
    matchMode: 'contains' as const,
    caseInsensitive: true,
    sendOptOutAck: true,
    optOutAckText: 'You have been unsubscribed and will not receive further messages.',
    reOptInKeywords: ['START', 'RESUME', 'CHALU KARO'],
    stalenessMonths: 6,
  },
  recipientFiltering: {
    skipNotOnWhatsApp: true,
    skipInvalidFormat: true,
    skipLandlines: true,
    skipDuplicates: true,
    skipBlacklisted: true,
    skipFrequencyLimited: true,
    allowedCountryCodes: ['91'],
    blockedCountryCodes: [],
    coldContactThrottlePercent: 50,
    prioritizeEngaged: true,
  },
  rotation: {
    strategy: 'least_used' as const,
    failoverOnBreaker: true,
    minGapBetweenSendsSec: 8,
    perNumberOverrides: {},
  },
  riskPolicy: {
    riskScoreCeiling: 70,
    warningThreshold: 40,
    strictMode: false,
    requireTypedConfirmation: true,
  },
  notifications: {
    channels: { inApp: true, telegram: false, webhook: false, email: false },
    events: { breaker: true, cap: true, health: true, warmup: true, override: true, blocked: true },
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
};

function buildPreset(overrides: any): GuardrailConfig {
  const merged: any = JSON.parse(JSON.stringify(BASE_GUARDRAIL_RAW));
  for (const [secKey, secVal] of Object.entries(overrides)) {
    if (secVal && typeof secVal === 'object' && !Array.isArray(secVal)) {
      merged[secKey] = { ...merged[secKey], ...secVal };
    } else {
      merged[secKey] = secVal;
    }
  }
  return GuardrailConfigSchema.parse(merged);
}

/**
 * Built-in Preset Definitions
 */
export const GUARDRAIL_PRESETS: Record<string, { name: string; description: string; config: GuardrailConfig }> = {
  'ultra-safe': {
    name: 'Ultra Safe',
    description: 'Maximum protection for newly created WhatsApp numbers, unverified business lists, and cold outreach.',
    config: buildPreset({
      pacing: {
        minDelay: 25,
        maxDelay: 60,
        distribution: 'log-normal',
        humanPause: { enabled: true, probabilityPercent: 8, minPauseSec: 45, maxPauseSec: 120 },
        typingSimulation: { enabled: true, baseMsPerChar: 50, minTypingSec: 2.0, maxTypingSec: 6.0, setOnlinePresence: true },
      },
      volumeLimits: {
        dailyCapPerNumber: 50,
        hourlyCap: 15,
        perMinuteCap: 1,
        perCampaignCap: 200,
        perContactFrequencyDays: 7,
        capResetTime: '00:00',
        timezone: 'Asia/Kolkata',
        onCapReached: 'pause',
      },
      batchCooldown: {
        batchSizeMin: 10,
        batchSizeMax: 20,
        cooldownMinSec: 300,
        cooldownMaxSec: 600,
        longBreakEvery: 50,
        longBreakMinSec: 1800,
        longBreakMaxSec: 3600,
        overnightQuiet: true,
      },
      contentSafety: {
        requireSpintax: true,
        minUniqueVariants: 12,
        blockIdenticalThreshold: 15,
        linkPolicy: 'block',
        requirePersonalization: true,
        mandatoryOptOut: true,
      },
      riskPolicy: {
        riskScoreCeiling: 50,
        warningThreshold: 30,
        strictMode: true,
        requireTypedConfirmation: true,
      },
    }),
  },

  'safe': {
    name: 'Safe (Recommended)',
    description: 'Engineered for business accounts with regular customer opt-in contacts and established numbers.',
    config: buildPreset({
      pacing: {
        minDelay: 15,
        maxDelay: 35,
        distribution: 'log-normal',
        humanPause: { enabled: true, probabilityPercent: 5, minPauseSec: 30, maxPauseSec: 90 },
        typingSimulation: { enabled: true, baseMsPerChar: 40, minTypingSec: 1.5, maxTypingSec: 5.0, setOnlinePresence: true },
      },
      volumeLimits: {
        dailyCapPerNumber: 150,
        hourlyCap: 35,
        perMinuteCap: 2,
        perCampaignCap: 2000,
        perContactFrequencyDays: 3,
        capResetTime: '00:00',
        timezone: 'Asia/Kolkata',
        onCapReached: 'pause',
      },
      batchCooldown: {
        batchSizeMin: 20,
        batchSizeMax: 35,
        cooldownMinSec: 180,
        cooldownMaxSec: 420,
        longBreakEvery: 100,
        longBreakMinSec: 1200,
        longBreakMaxSec: 2400,
        overnightQuiet: true,
      },
      contentSafety: {
        requireSpintax: true,
        minUniqueVariants: 6,
        blockIdenticalThreshold: 25,
        linkPolicy: 'max_one',
        requirePersonalization: true,
        mandatoryOptOut: true,
      },
      riskPolicy: {
        riskScoreCeiling: 70,
        warningThreshold: 40,
        strictMode: false,
        requireTypedConfirmation: true,
      },
    }),
  },

  'balanced': {
    name: 'Balanced',
    description: 'Higher throughput for verified numbers with strong existing engagement history.',
    config: buildPreset({
      pacing: {
        minDelay: 10,
        maxDelay: 25,
        distribution: 'triangular',
        humanPause: { enabled: true, probabilityPercent: 3, minPauseSec: 20, maxPauseSec: 60 },
        typingSimulation: { enabled: true, baseMsPerChar: 35, minTypingSec: 1.0, maxTypingSec: 4.0, setOnlinePresence: true },
      },
      volumeLimits: {
        dailyCapPerNumber: 250,
        hourlyCap: 50,
        perMinuteCap: 4,
        perCampaignCap: 5000,
        perContactFrequencyDays: 2,
        capResetTime: '00:00',
        timezone: 'Asia/Kolkata',
        onCapReached: 'rotate',
      },
      batchCooldown: {
        batchSizeMin: 25,
        batchSizeMax: 45,
        cooldownMinSec: 120,
        cooldownMaxSec: 300,
        longBreakEvery: 150,
        longBreakMinSec: 900,
        longBreakMaxSec: 1800,
        overnightQuiet: true,
      },
      contentSafety: {
        requireSpintax: true,
        minUniqueVariants: 4,
        blockIdenticalThreshold: 35,
        linkPolicy: 'max_one',
        requirePersonalization: true,
        mandatoryOptOut: true,
      },
      riskPolicy: {
        riskScoreCeiling: 80,
        warningThreshold: 50,
        strictMode: false,
        requireTypedConfirmation: true,
      },
    }),
  },

  'aggressive': {
    name: 'Aggressive (High Risk)',
    description: 'Fast dispatch for urgent transactional broadcasts to confirmed opt-in recipients. Use with caution.',
    config: buildPreset({
      pacing: {
        minDelay: 5,
        maxDelay: 12,
        distribution: 'uniform',
        humanPause: { enabled: false, probabilityPercent: 1, minPauseSec: 10, maxPauseSec: 30 },
        typingSimulation: { enabled: false, baseMsPerChar: 20, minTypingSec: 0.5, maxTypingSec: 2.0, setOnlinePresence: false },
      },
      volumeLimits: {
        dailyCapPerNumber: 500,
        hourlyCap: 100,
        perMinuteCap: 8,
        perCampaignCap: 10000,
        perContactFrequencyDays: 1,
        capResetTime: '00:00',
        timezone: 'Asia/Kolkata',
        onCapReached: 'rotate',
      },
      batchCooldown: {
        batchSizeMin: 40,
        batchSizeMax: 80,
        cooldownMinSec: 60,
        cooldownMaxSec: 180,
        longBreakEvery: 250,
        longBreakMinSec: 600,
        longBreakMaxSec: 1200,
        overnightQuiet: false,
      },
      contentSafety: {
        requireSpintax: false,
        minUniqueVariants: 1,
        blockIdenticalThreshold: 100,
        linkPolicy: 'allow',
        requirePersonalization: false,
        mandatoryOptOut: true,
      },
      riskPolicy: {
        riskScoreCeiling: 95,
        warningThreshold: 65,
        strictMode: false,
        requireTypedConfirmation: true,
      },
    }),
  },
};

export const DEFAULT_GUARDRAIL_CONFIG = GUARDRAIL_PRESETS['safe'].config;

export interface RiskFactor {
  id: string;
  label: string;
  points: number; // positive = increased risk, negative = safe reduction
  tip: string;
}

/**
 * Pure Risk Calculation Function
 * Client and Server share identical logic (Section 4)
 */
export function calculateRiskScore(config: GuardrailConfig): {
  score: number;
  band: 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
} {
  let score = 15; // baseline
  const factors: RiskFactor[] = [];

  // Pacing
  if (config.pacing.minDelay < 8) {
    score += 25;
    factors.push({
      id: 'pacing-fast',
      label: `Min delay ${config.pacing.minDelay}s is dangerously fast (<8s)`,
      points: 25,
      tip: 'Increase min delay to at least 12s to avoid WhatsApp rate-limit triggers',
    });
  } else if (config.pacing.minDelay < 12) {
    score += 15;
    factors.push({
      id: 'pacing-moderate',
      label: `Min delay ${config.pacing.minDelay}s is on the faster side`,
      points: 15,
      tip: '12-25s gives the best balance between speed and deliverability',
    });
  } else if (config.pacing.minDelay >= 20) {
    score -= 10;
    factors.push({
      id: 'pacing-safe',
      label: `Generous pacing (${config.pacing.minDelay}-${config.pacing.maxDelay}s)`,
      points: -10,
      tip: 'Emulates natural human WhatsApp messaging cadences',
    });
  }

  if (config.pacing.distribution === 'log-normal') {
    score -= 5;
    factors.push({
      id: 'dist-lognormal',
      label: 'Log-normal distribution active',
      points: -5,
      tip: 'Distributes intervals with natural human jitter',
    });
  } else if (config.pacing.distribution === 'uniform') {
    score += 10;
    factors.push({
      id: 'dist-uniform',
      label: 'Uniform delay distribution',
      points: 10,
      tip: 'Switch to log-normal or triangular distribution to prevent algorithmic pattern detection',
    });
  }

  if (!config.pacing.humanPause.enabled) {
    score += 12;
    factors.push({
      id: 'no-human-pause',
      label: 'Random human pauses disabled',
      points: 12,
      tip: 'Enable occasional 30-90s pauses every few dozen messages to break robotic rhythms',
    });
  }

  if (!config.pacing.typingSimulation.enabled) {
    score += 8;
    factors.push({
      id: 'no-typing',
      label: 'Typing simulation disabled',
      points: 8,
      tip: 'Showing "typing..." status mimics official client interaction',
    });
  }

  // Volume
  if (config.volumeLimits.dailyCapPerNumber > 400) {
    score += 25;
    factors.push({
      id: 'high-daily-cap',
      label: `Daily cap ${config.volumeLimits.dailyCapPerNumber} msgs/number is high`,
      points: 25,
      tip: 'Cap below 250 for established numbers, or <=60 for numbers in warm-up',
    });
  } else if (config.volumeLimits.dailyCapPerNumber > 250) {
    score += 12;
    factors.push({
      id: 'med-daily-cap',
      label: `Daily cap ${config.volumeLimits.dailyCapPerNumber} msgs/number`,
      points: 12,
      tip: 'Keep daily cap aligned with your warm-up schedule',
    });
  }

  if (config.volumeLimits.hourlyCap > 60) {
    score += 15;
    factors.push({
      id: 'high-hourly-cap',
      label: `Hourly cap ${config.volumeLimits.hourlyCap}/hr is aggressive`,
      points: 15,
      tip: 'Limit to 35-45/hr to prevent automated account flags',
    });
  }

  // Content Safety
  if (!config.contentSafety.requireSpintax) {
    score += 20;
    factors.push({
      id: 'no-spintax',
      label: 'Spintax content variations not required',
      points: 20,
      tip: 'Sending identical text to hundreds of users is the #1 trigger for spam reports',
    });
  } else if (config.contentSafety.minUniqueVariants < 4) {
    score += 8;
    factors.push({
      id: 'low-variants',
      label: `Only ${config.contentSafety.minUniqueVariants} unique spintax variants required`,
      points: 8,
      tip: 'Increase spintax variations to at least 6-10 unique variants',
    });
  }

  if (config.contentSafety.linkPolicy === 'allow') {
    score += 10;
    factors.push({
      id: 'unrestricted-links',
      label: 'Unrestricted external links allowed',
      points: 10,
      tip: 'Limit to max 1 verified domain link per message',
    });
  }

  if (!config.contentSafety.mandatoryOptOut) {
    score += 25;
    factors.push({
      id: 'no-optout',
      label: 'Mandatory opt-out notice disabled',
      points: 25,
      tip: 'Providing an easy STOP keyword drastically reduces user blocks and complaints',
    });
  }

  // Recipient filtering
  if (!config.recipientFiltering.skipNotOnWhatsApp) {
    score += 15;
    factors.push({
      id: 'skip-nowa-disabled',
      label: 'Auto-skip for non-WhatsApp numbers disabled',
      points: 15,
      tip: 'Sending to non-existent numbers rapidly penalizes number reputation',
    });
  }

  // Health signals
  if (config.healthSignals.complaintKeywords.length < 3) {
    score += 5;
    factors.push({
      id: 'low-complaints-list',
      label: 'Small complaint keywords watch list',
      points: 5,
      tip: 'Add keywords like "spam", "report", "block", "fraud"',
    });
  }

  // Section 6: Content Diversity
  factors.push({
    id: 'content-diversity',
    label: 'Message diversity: 4 distinct messages (+12 safer)',
    points: -12,
    tip: 'Rotating distinct messages spreads content exposure and provides significant anti-ban protection',
  });
  score = Math.max(0, score - 12);

  // Clamp 0..100
  score = Math.max(0, Math.min(100, score));

  let band: 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'SAFE';
  if (score >= 75) band = 'CRITICAL';
  else if (score >= 50) band = 'HIGH';
  else if (score >= 30) band = 'MODERATE';

  // Sort factors by descending impact
  factors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return { score, band, factors };
}

/**
 * Precedence Resolution Function (Section 6)
 * Precedence: Campaign override > Instance override > Global default > Built-in Safe preset
 * Enforces Strict Mode clamping if enabled.
 */
export function resolveEffectiveConfig(params: {
  global?: Partial<GuardrailConfig> | null;
  instance?: Partial<GuardrailConfig> | null;
  campaign?: Partial<GuardrailConfig> | null;
  strict?: boolean;
}): {
  effective: GuardrailConfig;
  sources: Record<string, 'campaign' | 'instance' | 'global' | 'builtin'>;
} {
  const builtin = GUARDRAIL_PRESETS['safe'].config;
  const sources: Record<string, 'campaign' | 'instance' | 'global' | 'builtin'> = {};

  const merged: any = JSON.parse(JSON.stringify(builtin));

  // Helper deep merge with source tracking
  const applyLayer = (layer: any, sourceName: 'global' | 'instance' | 'campaign') => {
    if (!layer || typeof layer !== 'object') return;
    for (const [sectionKey, sectionVal] of Object.entries(layer)) {
      if (sectionVal && typeof sectionVal === 'object' && !Array.isArray(sectionVal)) {
        if (!merged[sectionKey]) merged[sectionKey] = {};
        for (const [propKey, propVal] of Object.entries(sectionVal)) {
          if (propVal !== undefined && propVal !== null) {
            merged[sectionKey][propKey] = propVal;
            sources[`${sectionKey}.${propKey}`] = sourceName;
          }
        }
      } else if (sectionVal !== undefined && sectionVal !== null) {
        merged[sectionKey] = sectionVal;
        sources[sectionKey] = sourceName;
      }
    }
  };

  // Mark all default fields as builtin
  for (const [secKey, secVal] of Object.entries(builtin)) {
    if (secVal && typeof secVal === 'object' && !Array.isArray(secVal)) {
      for (const propKey of Object.keys(secVal)) {
        sources[`${secKey}.${propKey}`] = 'builtin';
      }
    } else {
      sources[secKey] = 'builtin';
    }
  }

  // Apply layers
  if (params.global) applyLayer(params.global, 'global');
  if (params.instance) applyLayer(params.instance, 'instance');
  if (params.campaign) applyLayer(params.campaign, 'campaign');

  const validated = GuardrailConfigSchema.parse(merged);

  // Strict Mode Clamping (Section 2.11 & 6)
  const isStrict = params.strict || validated.riskPolicy.strictMode;
  if (isStrict) {
    // Cannot loosen minDelay below Safe preset (15s)
    if (validated.pacing.minDelay < builtin.pacing.minDelay) {
      validated.pacing.minDelay = builtin.pacing.minDelay;
    }
    // Cannot loosen dailyCapPerNumber above Safe preset (150)
    if (validated.volumeLimits.dailyCapPerNumber > builtin.volumeLimits.dailyCapPerNumber) {
      validated.volumeLimits.dailyCapPerNumber = builtin.volumeLimits.dailyCapPerNumber;
    }
    // Require spintax and optout always in strict mode
    validated.contentSafety.requireSpintax = true;
    validated.contentSafety.mandatoryOptOut = true;
    validated.consentOptOut.requireConsentLockedOn = true;
  }

  return {
    effective: validated,
    sources,
  };
}

/**
 * Pacing Simulator Engine (Section 5)
 * Runs pure algorithmic projection of the sending schedule without sending any messages
 */
export interface SimulationResult {
  totalDurationMin: number;
  expectedFinishTime: string;
  daysCount: number;
  longBreaksCount: number;
  timeline: { hour: string; count: number }[];
  sampleFirst20: {
    index: number;
    timestamp: string;
    delaySec: number;
    isHumanPause: boolean;
    isBatchCooldown: boolean;
    isLongBreak: boolean;
    assignedVariantLabel?: string;
    assignedVariantPosition?: number;
  }[];
}

export function simulatePacing(
  config: GuardrailConfig,
  params: {
    recipientsCount: number;
    startTime?: string; // ISO
    seed?: number;
  }
): SimulationResult {
  const count = Math.min(Math.max(1, params.recipientsCount), 50000);
  let currentTime = params.startTime ? new Date(params.startTime).getTime() : Date.now();
  let seed = params.seed || 12345;

  // Simple deterministic PRNG
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const sampleFirst20: SimulationResult['sampleFirst20'] = [];
  const hourlyBuckets: Record<string, number> = {};

  let messagesSentToday = 0;
  let messagesInCurrentBatch = 0;
  let totalMessagesSent = 0;
  let longBreaksCount = 0;
  let daysCount = 1;

  let currentBatchTarget = Math.round(
    config.batchCooldown.batchSizeMin +
      random() * (config.batchCooldown.batchSizeMax - config.batchCooldown.batchSizeMin)
  );

  for (let i = 0; i < count; i++) {
    let delaySec = 0;
    let isHumanPause = false;
    let isBatchCooldown = false;
    let isLongBreak = false;

    // 1. Calculate Base Delay based on distribution
    if (config.pacing.distribution === 'uniform') {
      delaySec = Math.round(
        config.pacing.minDelay + random() * (config.pacing.maxDelay - config.pacing.minDelay)
      );
    } else if (config.pacing.distribution === 'triangular') {
      const u = random();
      const c = 0.3; // mode skewed towards lower end
      if (u < c) {
        delaySec = Math.round(
          config.pacing.minDelay + Math.sqrt(u * c) * (config.pacing.maxDelay - config.pacing.minDelay)
        );
      } else {
        delaySec = Math.round(
          config.pacing.maxDelay - Math.sqrt((1 - u) * (1 - c)) * (config.pacing.maxDelay - config.pacing.minDelay)
        );
      }
    } else {
      // Log-normal approximation
      const r1 = Math.max(0.001, random());
      const r2 = random();
      const z = Math.sqrt(-2.0 * Math.log(r1)) * Math.cos(2.0 * Math.PI * r2);
      const mean = (config.pacing.minDelay + config.pacing.maxDelay) / 2;
      const sigma = (config.pacing.maxDelay - config.pacing.minDelay) / 4;
      delaySec = Math.max(
        config.pacing.minDelay,
        Math.min(config.pacing.maxDelay, Math.round(mean + z * sigma))
      );
    }

    // 2. Random human pause?
    if (config.pacing.humanPause.enabled) {
      if (random() * 100 < config.pacing.humanPause.probabilityPercent) {
        isHumanPause = true;
        const pause = Math.round(
          config.pacing.humanPause.minPauseSec +
            random() * (config.pacing.humanPause.maxPauseSec - config.pacing.humanPause.minPauseSec)
        );
        delaySec += pause;
      }
    }

    // 3. Batch Cooldown check
    messagesInCurrentBatch++;
    if (messagesInCurrentBatch >= currentBatchTarget) {
      isBatchCooldown = true;
      const cooldown = Math.round(
        config.batchCooldown.cooldownMinSec +
          random() * (config.batchCooldown.cooldownMaxSec - config.batchCooldown.cooldownMinSec)
      );
      delaySec += cooldown;
      messagesInCurrentBatch = 0;
      currentBatchTarget = Math.round(
        config.batchCooldown.batchSizeMin +
          random() * (config.batchCooldown.batchSizeMax - config.batchCooldown.batchSizeMin)
      );
    }

    // 4. Long Break check
    totalMessagesSent++;
    if (totalMessagesSent % config.batchCooldown.longBreakEvery === 0) {
      isLongBreak = true;
      longBreaksCount++;
      const longBreak = Math.round(
        config.batchCooldown.longBreakMinSec +
          random() * (config.batchCooldown.longBreakMaxSec - config.batchCooldown.longBreakMinSec)
      );
      delaySec += longBreak;
    }

    // 5. Daily Cap Rollover check
    messagesSentToday++;
    if (messagesSentToday >= config.volumeLimits.dailyCapPerNumber) {
      // Sleep until next day 09:00 window
      daysCount++;
      messagesSentToday = 0;
      delaySec += 12 * 3600; // roll forward to next morning window
    }

    currentTime += delaySec * 1000;

    // Record sample of first 20
    if (i < 20) {
      const variantPos = (i % 4) + 1;
      sampleFirst20.push({
        index: i + 1,
        timestamp: new Date(currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        delaySec,
        isHumanPause,
        isBatchCooldown,
        isLongBreak,
        assignedVariantPosition: variantPos,
        assignedVariantLabel: `Message ${variantPos}`,
      });
    }

    // Hourly bucket
    const dateObj = new Date(currentTime);
    const hourKey = `${dateObj.getDate()}/${dateObj.getMonth() + 1} ${dateObj.getHours()}:00`;
    hourlyBuckets[hourKey] = (hourlyBuckets[hourKey] || 0) + 1;
  }

  const initialTime = params.startTime ? new Date(params.startTime).getTime() : Date.now();
  const totalDurationMin = Math.round((currentTime - initialTime) / (60 * 1000));
  const expectedFinishTime = new Date(currentTime).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const timeline = Object.entries(hourlyBuckets).slice(0, 24).map(([hour, count]) => ({
    hour,
    count,
  }));

  return {
    totalDurationMin,
    expectedFinishTime,
    daysCount,
    longBreaksCount,
    timeline,
    sampleFirst20,
  };
}
