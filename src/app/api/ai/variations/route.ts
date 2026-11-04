export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

// 12 Warm, Polite & Friendly Styles (Preserving 100% meaning without changing intention)
export const WARM_VARIATION_STYLES = [
  {
    label: 'Warm & Friendly',
    greeting: 'Hello {name|Friend}, hope you are doing wonderfully!',
    signoff: 'Warm regards and take care!',
    shortPhrases: [
      'Hello {name|buddy}, hope you are having a wonderful day!',
      'Hi {name|friend}! Wishing you a great day ahead.',
      'Warm hello to you! Hope all is going great.',
    ],
  },
  {
    label: 'Polite & Cordial',
    greeting: 'Dear {name|Customer}, hope all is well with you.',
    signoff: 'With kind regards and best wishes.',
    shortPhrases: [
      'Hi {name|there}, hope you are doing well today!',
      'Hello {name|friend}, hope everything is going smoothly.',
      'Greetings! Hope your week is off to a great start.',
    ],
  },
  {
    label: 'Gracious & Welcoming',
    greeting: 'Warm greetings {name|there}! Hope your week is going great.',
    signoff: 'Always a pleasure connecting with you!',
    shortPhrases: [
      'Warm greetings to you! Hope you have a wonderful day.',
      'Good day {name|friend}! Sending best wishes your way.',
      'Hello {name|there}! A warm hello from all of us.',
    ],
  },
  {
    label: 'Courteous & Pleasant',
    greeting: 'Good day {name|Friend}! Sending best wishes your way.',
    signoff: 'Wishing you a pleasant and peaceful day ahead!',
    shortPhrases: [
      'Good day to you! Hope you are having a lovely day.',
      'Hi {name|friend}, wishing you a peaceful and productive day.',
      'Hello! Hope you are in great spirits today.',
    ],
  },
  {
    label: 'Gentle & Attentive',
    greeting: 'Hi {name|there}, hope everything is going smoothly on your end.',
    signoff: 'Please feel welcome to reply if you need any assistance.',
    shortPhrases: [
      'Hi {name|there}, hope all is great on your end!',
      'Hello {name|friend}, just wishing you a wonderful day!',
      'Hey {name|buddy}, hope everything is going great.',
    ],
  },
  {
    label: 'Kind & Personable',
    greeting: 'Hello {name|Friend}, wishing you a peaceful and productive day.',
    signoff: 'Appreciate your time and valued connection!',
    shortPhrases: [
      'Hello {name|friend}, hope your day is going fantastic!',
      'Hi there! Sending you warm thoughts and best wishes.',
      'Warm greetings {name|friend}, hope life is treating you well!',
    ],
  },
  {
    label: 'Respectful & Sincere',
    greeting: 'Dear {name|Valued Customer}, hope this note finds you in great spirits.',
    signoff: 'Thank you very much and have a wonderful day.',
    shortPhrases: [
      'Dear {name|friend}, hope this message finds you well!',
      'Greetings to you! Wishing you all the very best today.',
      'Hello {name|there}, hope you are having a pleasant week.',
    ],
  },
  {
    label: 'Friendly & Cheerful',
    greeting: 'Hi {name|Friend}! Reaching out with warm thoughts today.',
    signoff: 'Have a delightful day ahead!',
    shortPhrases: [
      'Hi {name|friend}! Hope your day is filled with good moments.',
      'Hey {name|buddy}, hope you are having an awesome day!',
      'Hello {name|there}! Sending cheerful greetings your way.',
    ],
  },
  {
    label: 'Considerate & Helpful',
    greeting: 'Greetings {name|there}! Hope all is well with you and your team.',
    signoff: 'We are always glad to be of assistance anytime.',
    shortPhrases: [
      'Greetings {name|friend}! Hope everything is going smoothly for you.',
      'Hi {name|there}, wishing you a smooth and wonderful day.',
      'Hello {name|friend}, hope you have a really productive day!',
    ],
  },
  {
    label: 'Warm Appreciation',
    greeting: 'Hello {name|Friend}, warm greetings to you today!',
    signoff: 'Thank you for being with us and take care!',
    shortPhrases: [
      'Hello {name|friend}! Thank you for connecting with us and take care.',
      'Warm greetings to you! Appreciate having you in our circle.',
      'Hi {name|there}, sending gratitude and warm wishes today!',
    ],
  },
  {
    label: 'Pleasant & Engaging',
    greeting: 'Hi {name|there}, hope you are enjoying a great week so far.',
    signoff: 'Wishing you all the very best!',
    shortPhrases: [
      'Hi {name|friend}, hope you are enjoying a wonderful week!',
      'Hello {name|there}, hope all is positive and bright today.',
      'Greetings {name|buddy}! Wishing you a fabulous day ahead.',
    ],
  },
  {
    label: 'Gracious & Courteous',
    greeting: 'Dear {name|Friend}, sending warm regards your way.',
    signoff: 'With gratitude and warmest wishes.',
    shortPhrases: [
      'Dear {name|friend}, sending warm wishes your way today.',
      'Hello to you! Wishing you joy and success in all you do.',
      'Hi {name|there}, hope you have a truly pleasant day!',
    ],
  },
];

// Meaning-preserving polite synonym mappings
const POLITE_WORDPLAY_MAP: Array<{ pattern: RegExp; options: string[] }> = [
  { pattern: /\bpleased to share\b/gi, options: ['delighted to share', 'happy to share', 'glad to share with you', 'excited to pass along'] },
  { pattern: /\bwe are pleased to\b/gi, options: ['we are delighted to', 'it is a pleasure to', 'we are glad to', 'we are happy to'] },
  { pattern: /\bpleased to\b/gi, options: ['delighted to', 'happy to', 'glad to', 'thrilled to'] },
  { pattern: /\bexcited to\b/gi, options: ['delighted to', 'happy to', 'glad to', 'pleased to'] },
  { pattern: /\bcheck out\b/gi, options: ['take a look at', 'explore', 'have a look at', 'view'] },
  { pattern: /\buse code\b/gi, options: ['apply code', 'enter code', 'use promo code', 'apply coupon'] },
  { pattern: /\bcontact us\b/gi, options: ['reach out to us', 'connect with us', 'get in touch with us', 'message us'] },
  { pattern: /\bfeel free to\b/gi, options: ['please feel welcome to', 'you are welcome to', 'don\'t hesitate to', 'feel free to'] },
  { pattern: /\blet us know\b/gi, options: ['please let us know', 'feel welcome to inform us', 'feel free to reach out', 'drop us a quick note'] },
  { pattern: /\bassist you\b/gi, options: ['help you', 'support you', 'be of service', 'assist you'] },
  { pattern: /\bany assistance\b/gi, options: ['any help', 'any support', 'any questions or assistance', 'any assistance'] },
  { pattern: /\bnewest\b/gi, options: ['latest', 'fresh', 'newest', 'recent'] },
  { pattern: /\bquestions\b/gi, options: ['inquiries', 'queries', 'questions', 'questions or thoughts'] },
];

export function generateSmartFallbackVariations(baseMessage: string): Array<{ label: string; content: string }> {
  const trimmed = baseMessage.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // Case 1: Ultra-short inputs (e.g., "hello buddy", "hi there", "good morning")
  if (wordCount <= 6) {
    const isBuddyGreeting = /buddy|bro|friend|pal|mate/i.test(trimmed);
    const hasNameToken = /\{name[^\}]*\}/i.test(trimmed);

    return WARM_VARIATION_STYLES.map((style, idx) => {
      let content = '';
      if (style.shortPhrases && style.shortPhrases.length > 0) {
        content = style.shortPhrases[idx % style.shortPhrases.length];
        if (!hasNameToken && !isBuddyGreeting) {
          content = content.replace(/\{name\|[^\}]*\}\s*/g, '').replace(/buddy|friend/g, 'there');
        }
      } else {
        content = `${style.greeting}`;
      }

      return {
        label: `Message ${idx + 2} (${style.label})`,
        content: content.trim(),
      };
    });
  }

  // Case 2: Multi-word / full broadcast messages
  // Extract and preserve tokens like {name|...}, URLs, codes so wordplay never mutates them
  const tokenList: string[] = [];
  const tokenized = trimmed
    .replace(/\{[^{}]+\}/g, (match) => {
      tokenList.push(match);
      return `__TOKEN_${tokenList.length - 1}__`;
    })
    .replace(/https?:\/\/[^\s]+/g, (match) => {
      tokenList.push(match);
      return `__TOKEN_${tokenList.length - 1}__`;
    })
    .replace(/`[^`]+`/g, (match) => {
      tokenList.push(match);
      return `__TOKEN_${tokenList.length - 1}__`;
    });

  return WARM_VARIATION_STYLES.map((style, idx) => {
    let body = tokenized;

    // Apply meaning-preserving polite wordplay substitutions
    POLITE_WORDPLAY_MAP.forEach(({ pattern, options }) => {
      const chosen = options[idx % options.length];
      body = body.replace(pattern, chosen);
    });

    // Detect and gracefully adapt greeting if already present at start
    const greetingMatch = body.match(/^(__TOKEN_\d+__|Hi|Hello|Hey|Dear|Greetings|Good day|Warm greetings)[^\n,]*[,!]?\s*\n*/i);
    if (greetingMatch) {
      body = body.slice(greetingMatch[0].length).trim();
    }

    // Detect and gracefully adapt closing if already present at end
    const closingMatch = body.match(/\n+(Best regards|Warm regards|Regards|Thanks|Thank you|Cheers|Warm wishes|Sincerely)[^\n]*$/i);
    if (closingMatch) {
      body = body.slice(0, closingMatch.index).trim();
    }

    // Assemble warm, polite variation with exact core content preserved
    let finalContent = `${style.greeting}\n\n${body}\n\n${style.signoff}`;

    // Restore protected tokens
    finalContent = finalContent.replace(/__TOKEN_(\d+)__/g, (_, num) => tokenList[Number(num)] || '');

    return {
      label: `Message ${idx + 2} (${style.label})`,
      content: finalContent.trim(),
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const baseMessage = body.baseMessage || body.message || body.template || '';

    if (!baseMessage || !baseMessage.trim()) {
      return NextResponse.json({ error: 'Base message is required' }, { status: 400 });
    }

    // Check if OpenRouter key is configured
    const aiSettings = await db.aiSettings.findFirst();
    let apiKey = '';
    if (aiSettings?.apiKeyEncrypted) {
      try {
        apiKey = decrypt(aiSettings.apiKeyEncrypted);
      } catch {}
    }

    // If API key is available, attempt OpenRouter generation with strict meaning preservation
    if (apiKey && apiKey.trim().length > 10) {
      try {
        const model = aiSettings?.model || 'anthropic/claude-3.5-haiku';
        const prompt = `You are an expert copywriter specializing in warm, polite, and friendly WhatsApp messaging.
The user will provide 1 base WhatsApp message. Your task is to generate exactly 12 distinct variations of this message.

CRITICAL NON-NEGOTIABLE RULES:
1. PRESERVE 100% OF THE ORIGINAL MEANING AND INTENTION:
   - Do NOT change the meaning, purpose, facts, or instructions of the message.
   - NEVER fabricate or invent discounts, deadlines, urgency, countdowns, emergency warnings (NO "urgent", NO "final call", NO "expires soon", NO "🚨", NO "⚡", NO artificial claims).
   - If the user wrote a simple short message (e.g. "hello buddy"), keep every variation brief, friendly, and natural. Do NOT add sales pitch or marketing paragraphs that were not present.
2. TONE MUST ALWAYS BE WARM, FRIENDLY, AND POLITE:
   - Every single variation must be courteous, warm, respectful, polite, and welcoming.
3. ONLY USE SUBTLE WORDPLAY AND NATURAL PARAPHRASING:
   - Use graceful sentence rephrasing, natural synonyms, and polite variations.
   - The recipient must receive the EXACT same information, just expressed in 12 different polite, natural styles.
4. PRESERVE ALL PLACEHOLDERS AND FORMATTING EXACTLY:
   - Keep dynamic variables like {name}, {company}, {phone}, etc., exactly as written.
   - Keep WhatsApp formatting (*bold*, _italic_, ~strike~, \`code\`) intact.
   - Keep links, phone numbers, and promo codes completely unchanged.

Return ONLY a valid JSON object matching this schema:
{
  "variations": [
    { "label": "Message 2 (Warm & Friendly)", "content": "..." },
    { "label": "Message 3 (Polite & Cordial)", "content": "..." },
    { "label": "Message 4 (Gracious & Welcoming)", "content": "..." },
    { "label": "Message 5 (Courteous & Pleasant)", "content": "..." },
    { "label": "Message 6 (Gentle & Attentive)", "content": "..." },
    { "label": "Message 7 (Kind & Personable)", "content": "..." },
    { "label": "Message 8 (Respectful & Sincere)", "content": "..." },
    { "label": "Message 9 (Friendly & Cheerful)", "content": "..." },
    { "label": "Message 10 (Considerate & Helpful)", "content": "..." },
    { "label": "Message 11 (Warm Appreciation)", "content": "..." },
    { "label": "Message 12 (Pleasant & Engaging)", "content": "..." },
    { "label": "Message 13 (Gracious & Courteous)", "content": "..." }
  ]
}

Base Message:
${baseMessage}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://bulkflow.whatsapp',
            'X-Title': 'BulkFlow WhatsApp Campaign Manager',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.35,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (openRouterRes.ok) {
          const aiJson = await openRouterRes.json();
          const rawText = aiJson.choices?.[0]?.message?.content;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const list = Array.isArray(parsed.variations) ? parsed.variations : parsed;
            if (Array.isArray(list) && list.length >= 8) {
              const formatted = list.slice(0, 12).map((item: any, idx: number) => ({
                position: idx + 2,
                label: item.label || `Message ${idx + 2} (${WARM_VARIATION_STYLES[idx]?.label || 'Polite & Warm'})`,
                content: item.content || item.text,
              }));
              return NextResponse.json({
                success: true,
                source: 'openrouter_ai',
                model,
                variations: formatted,
              });
            }
          }
        }
      } catch (aiErr: any) {
        logger.warn({ aiErr: aiErr.message }, 'OpenRouter AI generation failed, falling back to smart engine');
      }
    }

    // Fallback: Smart Algorithmic Linguistic Variation Engine
    const fallbackList = generateSmartFallbackVariations(baseMessage);
    const variations = fallbackList.map((item, idx) => ({
      position: idx + 2,
      label: item.label,
      content: item.content,
    }));

    return NextResponse.json({
      success: true,
      source: 'smart_engine',
      variations,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/ai/variations');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
