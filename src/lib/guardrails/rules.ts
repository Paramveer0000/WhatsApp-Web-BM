import { DateTime } from 'luxon';
import { GuardrailConfig } from './types';
import { db } from '../db';

export interface RuleContext {
  recipient: {
    id: string;
    phone: string;
    name?: string | null;
    customVariables?: any;
    lastContactDate?: Date | null;
  };
  campaign: {
    id: string;
    name: string;
    timezone: string;
  };
  instance: {
    id: string;
    name: string;
    dailyCap: number;
    sentToday: number;
    status: string;
    circuitState?: string;
  };
  config: GuardrailConfig;
  consecutiveFailures: number;
  messagesInBatch: number;
  totalSentInCampaign: number;
  todaySentInstance: number;
}

export type RuleDecision =
  | { action: 'allow'; delayMs: number; isHumanPause: boolean; isBatchCooldown: boolean; typingMs: number }
  | { action: 'delay'; delayMs: number; reason: string }
  | { action: 'block'; reason: string }
  | { action: 'pause'; reason: string };

/**
 * 1. Window Rule
 */
export function evaluateWindowRule(ctx: RuleContext): { allowed: boolean; reason?: string; sleepMs?: number } {
  const tz = ctx.config.sendingWindow.timezone || 'Asia/Kolkata';
  const now = DateTime.now().setZone(tz);

  // Check blackout dates
  const todayStr = now.toFormat('yyyy-MM-dd');
  if (ctx.config.sendingWindow.blackoutDates.includes(todayStr)) {
    return {
      allowed: false,
      reason: `Today (${todayStr}) is a scheduled Blackout Date under Guardrails sending window policy.`,
      sleepMs: 60000,
    };
  }

  // Check day of week (0=Sunday, 1=Monday... 6=Saturday)
  const luxonDay = now.weekday % 7; // Sunday is 7 in Luxon, 7%7 = 0
  if (!ctx.config.sendingWindow.daysOfWeek.includes(luxonDay)) {
    return {
      allowed: false,
      reason: `Sending is disabled on ${now.weekdayLong} under Guardrails sending window policy.`,
      sleepMs: 60000,
    };
  }

  // Check hour window
  const [startHour, startMin] = ctx.config.sendingWindow.startTime.split(':').map(Number);
  const [endHour, endMin] = ctx.config.sendingWindow.endTime.split(':').map(Number);

  const startToday = now.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
  const endToday = now.set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 });

  if (now < startToday || now > endToday) {
    let msUntilStart = 60000;
    if (now < startToday) {
      msUntilStart = startToday.diff(now).milliseconds;
    } else {
      const startTomorrow = startToday.plus({ days: 1 });
      msUntilStart = startTomorrow.diff(now).milliseconds;
    }
    return {
      allowed: false,
      reason: `Current time (${now.toFormat('HH:mm')}) is outside allowed window (${ctx.config.sendingWindow.startTime} - ${ctx.config.sendingWindow.endTime}).`,
      sleepMs: Math.min(msUntilStart, 60000),
    };
  }

  return { allowed: true };
}

/**
 * 2. Volume Caps Rule
 */
export function evaluateVolumeCapsRule(ctx: RuleContext): { allowed: boolean; action?: 'pause' | 'stop' | 'rotate'; reason?: string } {
  const { volumeLimits, warmUp } = ctx.config;

  // Warm-up cap overrides normal cap if warm-up is active
  let effectiveDailyCap = volumeLimits.dailyCapPerNumber;
  if (warmUp.enabled && warmUp.schedule.length > 0) {
    const daySchedule = warmUp.schedule.find((s) => s.day === 1);
    if (daySchedule && daySchedule.cap < effectiveDailyCap) {
      effectiveDailyCap = daySchedule.cap;
    }
  }

  if (ctx.todaySentInstance >= effectiveDailyCap) {
    return {
      allowed: false,
      action: volumeLimits.onCapReached,
      reason: `Instance ${ctx.instance.name} reached daily cap of ${effectiveDailyCap} messages.`,
    };
  }

  if (ctx.totalSentInCampaign >= volumeLimits.perCampaignCap) {
    return {
      allowed: false,
      action: 'stop',
      reason: `Campaign reached maximum allowed volume limit of ${volumeLimits.perCampaignCap} messages.`,
    };
  }

  return { allowed: true };
}

/**
 * 3. Recipient Filtering Rule
 */
export async function evaluateRecipientFilterRule(ctx: RuleContext): Promise<{ allowed: boolean; reason?: string }> {
  const { recipientFiltering, consentOptOut } = ctx.config;
  const cleanPhone = ctx.recipient.phone.replace(/\D/g, '');

  // Check country codes
  if (recipientFiltering.allowedCountryCodes.length > 0) {
    const matchesAllowed = recipientFiltering.allowedCountryCodes.some((code) => cleanPhone.startsWith(code));
    if (!matchesAllowed) {
      return {
        allowed: false,
        reason: `Recipient phone +${cleanPhone} does not match allowed country codes (${recipientFiltering.allowedCountryCodes.join(', ')}).`,
      };
    }
  }

  if (recipientFiltering.blockedCountryCodes.length > 0) {
    const matchesBlocked = recipientFiltering.blockedCountryCodes.some((code) => cleanPhone.startsWith(code));
    if (matchesBlocked) {
      return {
        allowed: false,
        reason: `Recipient phone +${cleanPhone} belongs to a blocked country code.`,
      };
    }
  }

  // Check blacklist
  if (recipientFiltering.skipBlacklisted) {
    const blacklisted = await db.blacklist.findFirst({
      where: { phone: cleanPhone },
    });
    if (blacklisted) {
      return {
        allowed: false,
        reason: `Recipient +${cleanPhone} is in the global blacklist (opted out).`,
      };
    }
  }

  return { allowed: true };
}

/**
 * 4. Content Safety Rule
 */
export function evaluateContentSafetyRule(
  ctx: RuleContext,
  renderedText: string
): { allowed: boolean; reason?: string } {
  const { contentSafety } = ctx.config;

  // Max message length
  if (renderedText.length > contentSafety.maxMessageLength) {
    return {
      allowed: false,
      reason: `Message length (${renderedText.length} chars) exceeds safety maximum (${contentSafety.maxMessageLength} chars).`,
    };
  }

  // Blocked words check
  const lower = renderedText.toLowerCase();
  for (const word of contentSafety.blockedWords) {
    if (lower.includes(word.toLowerCase())) {
      return {
        allowed: false,
        reason: `Message contains flagged spam keyword: "${word}".`,
      };
    }
  }

  // Link policy check
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = renderedText.match(urlRegex) || [];
  if (contentSafety.linkPolicy === 'block' && matches.length > 0) {
    return {
      allowed: false,
      reason: 'External links are blocked under the active Ultra-Safe content guardrail policy.',
    };
  }
  if (contentSafety.linkPolicy === 'max_one' && matches.length > 1) {
    return {
      allowed: false,
      reason: `Message contains ${matches.length} links. Maximum 1 link permitted.`,
    };
  }

  // Blocked domains check
  for (const match of matches) {
    for (const blockedDomain of contentSafety.blockedDomains) {
      if (match.toLowerCase().includes(blockedDomain.toLowerCase())) {
        return {
          allowed: false,
          reason: `Link contains suspicious or URL-shortener domain: "${blockedDomain}".`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * 5. Pacing & Delay Calculation
 */
export function calculatePacingDecision(ctx: RuleContext): {
  delayMs: number;
  isHumanPause: boolean;
  isBatchCooldown: boolean;
  typingMs: number;
} {
  const { pacing, batchCooldown } = ctx.config;
  let delaySec = 0;
  let isHumanPause = false;
  let isBatchCooldown = false;

  // 1. Distribution
  const min = pacing.minDelay;
  const max = pacing.maxDelay;
  if (pacing.distribution === 'uniform') {
    delaySec = Math.round(min + Math.random() * (max - min));
  } else if (pacing.distribution === 'triangular') {
    const u = Math.random();
    const c = 0.3;
    if (u < c) {
      delaySec = Math.round(min + Math.sqrt(u * c) * (max - min));
    } else {
      delaySec = Math.round(max - Math.sqrt((1 - u) * (1 - c)) * (max - min));
    }
  } else {
    // Log-normal
    const r1 = Math.max(0.001, Math.random());
    const r2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(r1)) * Math.cos(2.0 * Math.PI * r2);
    const mean = (min + max) / 2;
    const sigma = (max - min) / 4;
    delaySec = Math.max(min, Math.min(max, Math.round(mean + z * sigma)));
  }

  // 2. Random human pause
  if (pacing.humanPause.enabled) {
    if (Math.random() * 100 < pacing.humanPause.probabilityPercent) {
      isHumanPause = true;
      const pause = Math.round(
        pacing.humanPause.minPauseSec +
          Math.random() * (pacing.humanPause.maxPauseSec - pacing.humanPause.minPauseSec)
      );
      delaySec += pause;
    }
  }

  // 3. Batch cooldown
  const batchTarget = Math.round(
    batchCooldown.batchSizeMin + Math.random() * (batchCooldown.batchSizeMax - batchCooldown.batchSizeMin)
  );
  if (ctx.messagesInBatch >= batchTarget) {
    isBatchCooldown = true;
    const cooldown = Math.round(
      batchCooldown.cooldownMinSec + Math.random() * (batchCooldown.cooldownMaxSec - batchCooldown.cooldownMinSec)
    );
    delaySec += cooldown;
  }

  // 4. Typing simulation time
  let typingMs = 0;
  if (pacing.typingSimulation.enabled) {
    const charCount = ctx.recipient.name ? 100 : 80;
    const computedSec = (charCount * pacing.typingSimulation.baseMsPerChar) / 1000;
    const clampedSec = Math.max(
      pacing.typingSimulation.minTypingSec,
      Math.min(pacing.typingSimulation.maxTypingSec, computedSec)
    );
    typingMs = Math.round(clampedSec * 1000);
  }

  return {
    delayMs: Math.max(1000, delaySec * 1000),
    isHumanPause,
    isBatchCooldown,
    typingMs,
  };
}

/**
 * Log a Guardrail Event to Database
 */
export async function logGuardrailEvent(event: {
  instanceId?: string;
  campaignId?: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  detail: any;
}) {
  try {
    await db.guardrailEvent.create({
      data: {
        instanceId: event.instanceId,
        campaignId: event.campaignId,
        type: event.type,
        severity: event.severity,
        detail: JSON.stringify(event.detail),
      },
    });
  } catch (err) {
    console.error('Failed to log guardrail event:', err);
  }
}

