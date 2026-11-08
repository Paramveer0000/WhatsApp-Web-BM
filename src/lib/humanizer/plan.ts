import {
  DeliveryPlan,
  PlanStep,
  HumanizerProfile,
  DEFAULT_HUMANIZER_PROFILE,
} from './types';
import { splitIntoBubbles } from './split';
import { computeTypingDurationMs } from './typing';
import { sampleDelays, hashSeed, seededRandom } from './timing';

export interface BuildPlanContext {
  sessionId: string;
  stepSeq: number;
  actionIndex?: number;
  inboundMessageId?: string;
  inboundText?: string;
  isFirstSessionStep?: boolean;
  businessName?: string;
  urgentNoDelay?: boolean;
}

export interface RawActionInput {
  type: 'send_text' | 'send_media' | 'handoff' | 'opt_out';
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio';
  caption?: string;
  quotedMessageId?: string;
  overrideSplit?: boolean;
  overrideNoDelay?: boolean;
}

/**
 * Pure, deterministic function that compiles an outgoing action into a Delivery Plan.
 */
export function buildDeliveryPlan(
  action: RawActionInput,
  context: BuildPlanContext,
  profile: HumanizerProfile = DEFAULT_HUMANIZER_PROFILE,
  customSeed?: string
): DeliveryPlan {
  const {
    sessionId,
    stepSeq,
    actionIndex = 0,
    inboundMessageId,
    inboundText = '',
    isFirstSessionStep = false,
    businessName = 'our team',
    urgentNoDelay = false,
  } = context;

  const seed = customSeed || `${sessionId}:${stepSeq}:${actionIndex}`;
  const baseHash = hashSeed(seed);

  const steps: PlanStep[] = [];
  let currentTimeMs = 0;

  const isNoDelay = urgentNoDelay || action.overrideNoDelay || profile.preset === 'instant';

  // 1. Sample Delays
  const delays = sampleDelays({
    seed,
    timing: profile.timing,
    inboundLength: inboundText.length,
    isAiAnswer: false,
    urgentNoDelay: isNoDelay,
  });

  // 2. Step 1: Mark as read (if enabled and an inbound message exists)
  if (!isNoDelay && profile.timing.autoMarkRead && inboundMessageId) {
    currentTimeMs += delays.readDelayMs;
    steps.push({
      id: `step_${steps.length + 1}`,
      tMs: currentTimeMs,
      type: 'markRead',
      quotedMessageId: inboundMessageId,
    });
  }

  // 3. Step 2: Thinking pause
  if (!isNoDelay && delays.thinkingPauseMs > 0) {
    currentTimeMs += delays.thinkingPauseMs;
    steps.push({
      id: `step_${steps.length + 1}`,
      tMs: currentTimeMs,
      type: 'pause',
      durationMs: delays.thinkingPauseMs,
    });
  }

  // Handle Action Content
  if (action.type === 'send_text' && action.text) {
    let fullText = action.text.trim();

    // Check Bot Disclosure on first message of new session
    if (isFirstSessionStep && profile.disclosure?.enabled && profile.disclosure.disclosureText) {
      const disc = profile.disclosure.disclosureText.replace(/\{\{business\}\}/g, businessName);
      fullText = `${disc}\n\n${fullText}`;
    }

    // Split into conversational bubbles
    const shouldSplit = action.overrideSplit !== undefined
      ? action.overrideSplit
      : profile.shaping.splitIntoBubbles;

    const bubbles = splitIntoBubbles(fullText, {
      splitIntoBubbles: shouldSplit,
      minChars: profile.shaping.bubbleMinChars,
      maxChars: profile.shaping.bubbleMaxChars,
      maxBubbles: profile.shaping.maxBubbles,
    });

    for (let bIndex = 0; bIndex < bubbles.length; bIndex++) {
      const bubbleText = bubbles[bIndex];

      if (!isNoDelay) {
        // Typing simulation duration for this bubble
        const randRatio = seededRandom(baseHash, 10 + bIndex);
        const typing = computeTypingDurationMs({
          chars: bubbleText.length,
          cpsMin: profile.timing.typingCpsMin,
          cpsMax: profile.timing.typingCpsMax,
          minMs: profile.timing.typingMinMs,
          maxMs: profile.timing.typingMaxMs,
          seedRatio: randRatio,
        });

        // Add presence composing
        steps.push({
          id: `step_${steps.length + 1}`,
          tMs: currentTimeMs,
          type: 'presence',
          value: 'composing',
          durationMs: typing.durationMs,
        });

        currentTimeMs += typing.durationMs;
      }

      // Add Send Text step
      steps.push({
        id: `step_${steps.length + 1}`,
        tMs: currentTimeMs,
        type: 'sendText',
        text: bubbleText,
        quotedMessageId: bIndex === 0 && profile.natural.quotedReplies === 'always' ? inboundMessageId : undefined,
      });

      // Inter-bubble pause between bubbles (except after the last one)
      if (bIndex < bubbles.length - 1 && !isNoDelay) {
        currentTimeMs += delays.interBubbleDelayMs;
        steps.push({
          id: `step_${steps.length + 1}`,
          tMs: currentTimeMs,
          type: 'pause',
          durationMs: delays.interBubbleDelayMs,
        });
      }
    }

    return {
      sessionId,
      stepSeq,
      actionIndex,
      seed,
      steps,
      totalDurationMs: currentTimeMs,
      bubbleCount: bubbles.length,
      profileName: profile.name,
      createdAt: Date.now(),
    };
  }

  // Handle Media Action
  if (action.type === 'send_media') {
    const presenceType = action.mediaType === 'audio' ? 'recording' : 'composing';

    if (!isNoDelay) {
      const durationMs = action.mediaType === 'audio' ? 3000 : 1500;
      steps.push({
        id: `step_${steps.length + 1}`,
        tMs: currentTimeMs,
        type: 'presence',
        value: presenceType,
        durationMs,
      });
      currentTimeMs += durationMs;
    }

    steps.push({
      id: `step_${steps.length + 1}`,
      tMs: currentTimeMs,
      type: 'sendMedia',
      mediaUrl: action.mediaUrl,
      mediaType: action.mediaType,
      caption: action.caption,
    });

    return {
      sessionId,
      stepSeq,
      actionIndex,
      seed,
      steps,
      totalDurationMs: currentTimeMs,
      bubbleCount: 1,
      profileName: profile.name,
      createdAt: Date.now(),
    };
  }

  return {
    sessionId,
    stepSeq,
    actionIndex,
    seed,
    steps,
    totalDurationMs: currentTimeMs,
    bubbleCount: 0,
    profileName: profile.name,
    createdAt: Date.now(),
  };
}
