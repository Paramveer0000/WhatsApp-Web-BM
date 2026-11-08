import { z } from 'zod';

// =========================================================
// 1. DELIVERY PLAN & STEPS
// =========================================================

export type PlanStepType = 'markRead' | 'presence' | 'sendText' | 'sendMedia' | 'sendReaction' | 'pause';

export interface PlanStep {
  id: string;
  tMs: number; // Offset from start in milliseconds
  type: PlanStepType;
  value?: 'composing' | 'recording' | 'paused' | string;
  durationMs?: number;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  caption?: string;
  reactionEmoji?: string;
  quotedMessageId?: string;
}

export interface DeliveryPlan {
  id?: string;
  sessionId: string;
  stepSeq: number;
  actionIndex: number;
  seed: string;
  steps: PlanStep[];
  totalDurationMs: number;
  bubbleCount: number;
  profileName: string;
  createdAt: number;
}

// =========================================================
// 2. HUMANIZER PROFILE CONFIGURATION
// =========================================================

export type HumanizerPreset = 'instant' | 'natural' | 'relaxed' | 'very_human' | 'custom';

export interface HumanizerTimingConfig {
  readDelayMinMs: number;
  readDelayMaxMs: number;
  autoMarkRead: boolean;
  thinkingPauseMinMs: number;
  thinkingPauseMaxMs: number;
  typingCpsMin: number; // characters per second
  typingCpsMax: number;
  typingMinMs: number;
  typingMaxMs: number;
  interBubbleDelayMinMs: number;
  interBubbleDelayMaxMs: number;
  responseTimeBudgetMs: number; // hard ceiling on total delay
  nightModeEnabled: boolean;
  nightStartHour: number; // e.g. 22 (10 PM)
  nightEndHour: number; // e.g. 8 (8 AM)
  afterHoursGreeting?: string;
}

export interface HumanizerShapingConfig {
  splitIntoBubbles: boolean;
  bubbleMinChars: number; // e.g. 80
  bubbleMaxChars: number; // e.g. 220
  maxBubbles: number; // e.g. 3 or 4
  emojiPolicy: 'none' | 'light' | 'expressive' | 'mirror';
  maxEmojisPerMessage: number;
  formality: 'casual' | 'friendly' | 'professional' | 'formal';
  regionalHonorifics: boolean; // e.g. "aap" in Hindi/Hinglish
  nameUsageFrequency: 'always' | 'first_only' | 'occasionally' | 'never';
  languageMatching: 'match_user' | 'always_english' | 'fixed_hindi' | 'fixed_punjabi';
}

export interface HumanizerNaturalBehaviorsConfig {
  burstDebounceMs: number; // wait window for rapid user messages (default 4000ms)
  burstMaxWaitMs: number; // max wait ceiling (default 12000ms)
  ackHandling: 'silent' | 'reaction_only' | 'short_reply' | 'full_reply';
  ackReactionEmoji: string; // e.g. '👍' or '🙏'
  quotedReplies: 'smart' | 'always' | 'never';
  typoSimulation: boolean; // experimental, off by default
  aiParaphraseEnabled: boolean;
  smallTalkFiller: boolean; // filler line before slow AI/API calls
}

export interface HumanizerDisclosureConfig {
  enabled: boolean;
  frequency: 'session_start' | 'once_per_contact' | 'off';
  disclosureText: string;
}

export interface HumanizerProfile {
  id?: string;
  name: string;
  preset: HumanizerPreset;
  scope: 'global' | 'bot' | 'node';
  scopeId?: string;
  timing: HumanizerTimingConfig;
  shaping: HumanizerShapingConfig;
  natural: HumanizerNaturalBehaviorsConfig;
  disclosure: HumanizerDisclosureConfig;
  personaId?: string;
  version: number;
}

// =========================================================
// 3. PERSONA MODEL
// =========================================================

export interface PersonaToneSliders {
  friendliness: number; // 0-100
  formality: number; // 0-100
  brevity: number; // 0-100
  humor: number; // 0-100
  emojiLevel: number; // 0-100
  languageMix: number; // 0 = 100% English, 100 = 100% Hindi/Hinglish
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatarUrl?: string;
  sliders: PersonaToneSliders;
  doList: string[];
  dontList: string[];
  examplePhrases: string[];
  isTeamMemberPersona?: boolean;
}

// =========================================================
// 4. PRESETS DEFINITIONS
// =========================================================

export const HUMANIZER_PRESETS: Record<HumanizerPreset, Omit<HumanizerProfile, 'id' | 'scope' | 'scopeId' | 'version'>> = {
  instant: {
    name: 'Instant',
    preset: 'instant',
    timing: {
      readDelayMinMs: 0,
      readDelayMaxMs: 500,
      autoMarkRead: true,
      thinkingPauseMinMs: 0,
      thinkingPauseMaxMs: 300,
      typingCpsMin: 20,
      typingCpsMax: 30,
      typingMinMs: 200,
      typingMaxMs: 1000,
      interBubbleDelayMinMs: 200,
      interBubbleDelayMaxMs: 500,
      responseTimeBudgetMs: 3000,
      nightModeEnabled: false,
      nightStartHour: 22,
      nightEndHour: 8,
    },
    shaping: {
      splitIntoBubbles: false,
      bubbleMinChars: 120,
      bubbleMaxChars: 400,
      maxBubbles: 2,
      emojiPolicy: 'light',
      maxEmojisPerMessage: 2,
      formality: 'professional',
      regionalHonorifics: false,
      nameUsageFrequency: 'first_only',
      languageMatching: 'match_user',
    },
    natural: {
      burstDebounceMs: 1500,
      burstMaxWaitMs: 4000,
      ackHandling: 'short_reply',
      ackReactionEmoji: '👍',
      quotedReplies: 'smart',
      typoSimulation: false,
      aiParaphraseEnabled: false,
      smallTalkFiller: false,
    },
    disclosure: {
      enabled: true,
      frequency: 'session_start',
      disclosureText: "I'm the virtual assistant. Type 'agent' to connect with a team member.",
    },
  },

  natural: {
    name: 'Natural (Recommended)',
    preset: 'natural',
    timing: {
      readDelayMinMs: 1500,
      readDelayMaxMs: 4000,
      autoMarkRead: true,
      thinkingPauseMinMs: 800,
      thinkingPauseMaxMs: 2500,
      typingCpsMin: 6,
      typingCpsMax: 9,
      typingMinMs: 1200,
      typingMaxMs: 7000,
      interBubbleDelayMinMs: 900,
      interBubbleDelayMaxMs: 2200,
      responseTimeBudgetMs: 20000,
      nightModeEnabled: true,
      nightStartHour: 22,
      nightEndHour: 8,
      afterHoursGreeting: "Thanks for reaching out! We are currently outside business hours, but I'll assist you right away.",
    },
    shaping: {
      splitIntoBubbles: true,
      bubbleMinChars: 80,
      bubbleMaxChars: 220,
      maxBubbles: 3,
      emojiPolicy: 'light',
      maxEmojisPerMessage: 2,
      formality: 'friendly',
      regionalHonorifics: true,
      nameUsageFrequency: 'first_only',
      languageMatching: 'match_user',
    },
    natural: {
      burstDebounceMs: 3500,
      burstMaxWaitMs: 10000,
      ackHandling: 'reaction_only',
      ackReactionEmoji: '👍',
      quotedReplies: 'smart',
      typoSimulation: false,
      aiParaphraseEnabled: false,
      smallTalkFiller: true,
    },
    disclosure: {
      enabled: true,
      frequency: 'session_start',
      disclosureText: "I'm the virtual assistant. Type 'agent' anytime to talk to our team.",
    },
  },

  relaxed: {
    name: 'Relaxed',
    preset: 'relaxed',
    timing: {
      readDelayMinMs: 2500,
      readDelayMaxMs: 6000,
      autoMarkRead: true,
      thinkingPauseMinMs: 1500,
      thinkingPauseMaxMs: 3500,
      typingCpsMin: 4,
      typingCpsMax: 7,
      typingMinMs: 2000,
      typingMaxMs: 9000,
      interBubbleDelayMinMs: 1400,
      interBubbleDelayMaxMs: 2800,
      responseTimeBudgetMs: 25000,
      nightModeEnabled: true,
      nightStartHour: 21,
      nightEndHour: 9,
    },
    shaping: {
      splitIntoBubbles: true,
      bubbleMinChars: 60,
      bubbleMaxChars: 180,
      maxBubbles: 4,
      emojiPolicy: 'expressive',
      maxEmojisPerMessage: 3,
      formality: 'friendly',
      regionalHonorifics: true,
      nameUsageFrequency: 'occasionally',
      languageMatching: 'match_user',
    },
    natural: {
      burstDebounceMs: 5000,
      burstMaxWaitMs: 15000,
      ackHandling: 'reaction_only',
      ackReactionEmoji: '🙏',
      quotedReplies: 'smart',
      typoSimulation: false,
      aiParaphraseEnabled: false,
      smallTalkFiller: true,
    },
    disclosure: {
      enabled: true,
      frequency: 'session_start',
      disclosureText: "Virtual Assistant at your service! Type 'agent' if you'd like a human team member.",
    },
  },

  very_human: {
    name: 'Very Human',
    preset: 'very_human',
    timing: {
      readDelayMinMs: 3000,
      readDelayMaxMs: 7000,
      autoMarkRead: true,
      thinkingPauseMinMs: 2000,
      thinkingPauseMaxMs: 4500,
      typingCpsMin: 4,
      typingCpsMax: 6,
      typingMinMs: 2500,
      typingMaxMs: 10000,
      interBubbleDelayMinMs: 1800,
      interBubbleDelayMaxMs: 3200,
      responseTimeBudgetMs: 30000,
      nightModeEnabled: true,
      nightStartHour: 21,
      nightEndHour: 9,
    },
    shaping: {
      splitIntoBubbles: true,
      bubbleMinChars: 50,
      bubbleMaxChars: 160,
      maxBubbles: 4,
      emojiPolicy: 'expressive',
      maxEmojisPerMessage: 4,
      formality: 'casual',
      regionalHonorifics: true,
      nameUsageFrequency: 'occasionally',
      languageMatching: 'match_user',
    },
    natural: {
      burstDebounceMs: 6000,
      burstMaxWaitMs: 18000,
      ackHandling: 'reaction_only',
      ackReactionEmoji: '🙏',
      quotedReplies: 'smart',
      typoSimulation: false,
      aiParaphraseEnabled: true,
      smallTalkFiller: true,
    },
    disclosure: {
      enabled: true,
      frequency: 'session_start',
      disclosureText: "Hi! I'm an automated assistant. Type 'agent' anytime to reach our support desk.",
    },
  },

  custom: {
    name: 'Custom',
    preset: 'custom',
    timing: {
      readDelayMinMs: 1500,
      readDelayMaxMs: 4000,
      autoMarkRead: true,
      thinkingPauseMinMs: 1000,
      thinkingPauseMaxMs: 2500,
      typingCpsMin: 6,
      typingCpsMax: 9,
      typingMinMs: 1200,
      typingMaxMs: 7000,
      interBubbleDelayMinMs: 1000,
      interBubbleDelayMaxMs: 2000,
      responseTimeBudgetMs: 20000,
      nightModeEnabled: false,
      nightStartHour: 22,
      nightEndHour: 8,
    },
    shaping: {
      splitIntoBubbles: true,
      bubbleMinChars: 80,
      bubbleMaxChars: 220,
      maxBubbles: 3,
      emojiPolicy: 'light',
      maxEmojisPerMessage: 2,
      formality: 'friendly',
      regionalHonorifics: true,
      nameUsageFrequency: 'first_only',
      languageMatching: 'match_user',
    },
    natural: {
      burstDebounceMs: 3500,
      burstMaxWaitMs: 10000,
      ackHandling: 'reaction_only',
      ackReactionEmoji: '👍',
      quotedReplies: 'smart',
      typoSimulation: false,
      aiParaphraseEnabled: false,
      smallTalkFiller: false,
    },
    disclosure: {
      enabled: true,
      frequency: 'session_start',
      disclosureText: "I'm the virtual assistant. Type 'agent' to connect with our team.",
    },
  },
};

export const DEFAULT_HUMANIZER_PROFILE: HumanizerProfile = {
  ...HUMANIZER_PRESETS.natural,
  scope: 'global',
  version: 1,
};
