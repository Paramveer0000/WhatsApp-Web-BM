/**
 * Pure acknowledgement detector for low-information conversational replies.
 * Handles English, Hindi, Hinglish, Punjabi, and emojis.
 */

export interface AckClassificationResult {
  isAck: boolean;
  ackType: 'gratitude' | 'affirmation' | 'acknowledgement' | 'none';
  suggestedReactionEmoji: string | null;
  suggestedShortClosing: string | null;
}

const ACKNOWLEDGEMENT_PATTERNS = [
  // Emojis
  /^(?:👍|👌|🙏|🙌|❤️|😊|🤝|💯)+$/,

  // English
  /^(?:ok|okay|k|kk|alright|cool|got\s*it|sure|noted|understood|fine|great|awesome|perfect|done|yep|yup|np|no\s*problem|anytime)$/i,
  /^(?:thanks(?:\s+a\s+lot|\s+so\s+much|\s+very\s+much)?|thank\s*you(?:\s+so\s+much|\s+very\s+much)?|thx|ty|tysm|thank\s*u|cheers)$/i,

  // Hindi / Hinglish / Romanized
  /^(?:theek\s*hai|thik\s*hai|theek|thik|achha|acha|accha|sahi\s*hai|badiya|badhiya|shukriya|dhanyawad|dhanyavaad|shukria)(?:\s+ji)?$/i,
  /^(?:chalo\s*theek|samajh\s*gaya|samajh\s*aagaya|done\s*ji|ok\s*ji|okay\s*ji|shukriya\s*ji|dhanyawad\s*ji)$/i,

  // Punjabi
  /^(?:theek\s*aa|thik\s*aa|vadhiya|changa|changa\s*ji|dhanwad|dhanvaad)$/i,
];

export function classifyAck(inboundText: string): AckClassificationResult {
  const clean = (inboundText || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?,:;~]+$/g, '')
    .trim();

  if (!clean || clean.length > 35) {
    return { isAck: false, ackType: 'none', suggestedReactionEmoji: null, suggestedShortClosing: null };
  }

  const isMatched = ACKNOWLEDGEMENT_PATTERNS.some((pattern) => pattern.test(clean));
  if (!isMatched) {
    return { isAck: false, ackType: 'none', suggestedReactionEmoji: null, suggestedShortClosing: null };
  }

  // Determine sub-type
  if (/thank|thx|tysm|shukriya|dhanyawad|dhanwad|cheers/i.test(clean)) {
    return {
      isAck: true,
      ackType: 'gratitude',
      suggestedReactionEmoji: '🙏',
      suggestedShortClosing: "You're most welcome! Let us know if you need anything else.",
    };
  }

  if (/^(?:👍|👌|❤️|great|awesome|perfect|badiya|badhiya|vadhiya)/i.test(clean)) {
    return {
      isAck: true,
      ackType: 'affirmation',
      suggestedReactionEmoji: '👍',
      suggestedShortClosing: 'Happy to help! Have a great day ahead.',
    };
  }

  return {
    isAck: true,
    ackType: 'acknowledgement',
    suggestedReactionEmoji: '👍',
    suggestedShortClosing: null,
  };
}
