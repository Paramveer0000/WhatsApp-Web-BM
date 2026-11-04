export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

// 12 Distinct copywriting styles
const VARIATION_PROFILES = [
  { label: 'Friendly & Warm', hook: '{Hi|Hello|Hey} {name|Friend}!', suffix: 'Hope you have a fantastic day ahead! Let us know if you need anything.' },
  { label: 'Direct & Concise', hook: 'Quick update for {name|you}:', suffix: 'Reply directly to this chat to claim.' },
  { label: 'Value & Benefit', hook: 'Greetings {name|Partner}!', suffix: 'Designed to deliver the best value for {company|your team}.' },
  { label: 'Urgent & Exclusive', hook: 'Important reminder {name|Customer}:', suffix: '⚡ Valid for a limited time only. Don\'t miss out!' },
  { label: 'Curiosity & Question', hook: 'Quick question for you, {name|Friend} —', suffix: 'Would love to hear your thoughts on this!' },
  { label: 'VIP Insider', hook: 'Exclusive announcement for {name|VIP}:', suffix: 'Reserved especially for our priority members.' },
  { label: 'Problem & Solution', hook: 'Looking to save time and budget, {name|there}?', suffix: 'Here is the simplest way forward today.' },
  { label: 'Bulleted Highlights', hook: '{Hi|Greetings} {name}: Here is what is waiting for you:', suffix: '• Instant activation\n• Priority support\n• Zero hassle' },
  { label: 'Conversational & Casual', hook: 'Hey {name|buddy},', suffix: 'Felt like sharing this with you before the weekend! Cheers.' },
  { label: 'Professional & Executive', hook: 'Dear {name|Sir/Madam},', suffix: 'We remain at your service for any questions or support.' },
  { label: 'Final Call & Deadline', hook: '⏳ Final opportunity for {name}:', suffix: 'Offer expires soon. Secure yours before it closes!' },
  { label: 'Helpful & Consultative', hook: '{Hello|Hi} {name|there}! Reaching out to see if we can help you with:', suffix: 'Feel free to reply right here anytime.' },
];

function generateSmartFallbackVariations(baseMessage: string): Array<{ label: string; content: string }> {
  // Clean base message
  const cleaned = baseMessage.trim();

  return VARIATION_PROFILES.map((profile, idx) => {
    let content = '';

    // Style-specific transformation
    if (idx === 0) {
      // Friendly
      content = `${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 1) {
      // Direct
      content = `${profile.hook} ${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 2) {
      // Value
      content = `${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 3) {
      // Urgent
      content = `🚨 ${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 4) {
      // Question
      content = `${profile.hook}\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 5) {
      // VIP
      content = `⭐ ${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 6) {
      // Problem & Solution
      content = `${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 7) {
      // Bulleted
      content = `${profile.hook}\n\n${cleaned}\n\nKey highlights:\n${profile.suffix}`;
    } else if (idx === 8) {
      // Casual
      content = `${profile.hook} ${cleaned} ${profile.suffix}`;
    } else if (idx === 9) {
      // Professional
      content = `${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else if (idx === 10) {
      // Final call
      content = `${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    } else {
      // Consultative
      content = `${profile.hook}\n\n${cleaned}\n\n${profile.suffix}`;
    }

    return {
      label: `Message ${idx + 2} (${profile.label})`,
      content,
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

    // If API key is available, attempt OpenRouter generation
    if (apiKey && apiKey.trim().length > 10) {
      try {
        const model = aiSettings?.model || 'anthropic/claude-3.5-haiku';
        const prompt = `You are an expert WhatsApp marketing copywriter specializing in anti-spam message variations.
The user will provide 1 base WhatsApp message. Your task is to generate exactly 12 distinct, high-converting variations of this message.

CRITICAL RULES:
1. Preserve dynamic placeholders like {name}, {company}, etc. exactly as they appear in the original text.
2. Maintain spintax syntax like {Hi|Hello} if used.
3. Keep the core offer/information identical, but vary the sentence structure, tone, opening hook, and CTA significantly to avoid WhatsApp bulk filters:
   - Variation 1: Friendly & Warm
   - Variation 2: Direct & Short
   - Variation 3: Value & Feature Highlights
   - Variation 4: Urgent & Limited-Time
   - Variation 5: Curiosity & Question Opening
   - Variation 6: VIP & Priority Privilege
   - Variation 7: Problem & Solution
   - Variation 8: Bulleted Highlights
   - Variation 9: Casual & Conversational
   - Variation 10: Professional & Polite
   - Variation 11: Final Call & Countdown
   - Variation 12: Helpful & Consultative

Return ONLY valid JSON with this exact schema:
{
  "variations": [
    { "label": "Message 2 (Friendly & Warm)", "content": "..." },
    { "label": "Message 3 (Direct & Short)", "content": "..." },
    ...
    { "label": "Message 13 (Helpful & Consultative)", "content": "..." }
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
            temperature: 0.7,
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
                label: item.label || `Message ${idx + 2} (${VARIATION_PROFILES[idx]?.label || 'Variant'})`,
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

