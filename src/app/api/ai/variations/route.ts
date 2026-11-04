export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import {
  WARM_VARIATION_STYLES,
  generateSmartFallbackVariations,
} from '@/lib/variations';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const baseMessage = body.baseMessage || body.message || body.template || '';
    const requestedCount = Math.min(19, Math.max(1, Number(body.count || 12)));

    if (!baseMessage || !baseMessage.trim()) {
      return NextResponse.json({ error: 'Base message is required' }, { status: 400 });
    }

    // Check OpenRouter AI Settings
    const settingRecord = await db.setting.findUnique({
      where: { key: 'AI_PROVIDER_SETTINGS' },
    });

    let aiSettings: any = null;
    if (settingRecord?.value) {
      try {
        aiSettings = JSON.parse(settingRecord.value);
      } catch {}
    }

    const openRouterApiKey = aiSettings?.apiKey || process.env.OPENROUTER_API_KEY;

    if (openRouterApiKey) {
      try {
        const model = aiSettings?.model || 'anthropic/claude-3.5-haiku';
        const prompt = `You are an expert copywriter specializing in warm, polite, and friendly WhatsApp messaging.
The user will provide 1 base WhatsApp message. Your task is to generate exactly ${requestedCount} distinct variations of this message.

CRITICAL NON-NEGOTIABLE RULES:
1. PRESERVE 100% OF THE ORIGINAL MEANING AND INTENTION:
   - Do NOT alter the core offer, facts, dates, codes, or instructions.
   - Do NOT introduce artificial urgency or fake countdowns if not in the base message.
   - Do NOT remove any important detail.
2. ALL VARIATIONS MUST BE WARM, POLITE, RESPECTFUL, AND FRIENDLY:
   - Every single variation must be courteous, warm, respectful, polite, and welcoming.
3. ONLY USE SUBTLE WORDPLAY AND NATURAL PARAPHRASING:
   - Use graceful sentence rephrasing, natural synonyms, and polite variations.
   - The recipient must receive the EXACT same information, just expressed in ${requestedCount} different polite, natural styles.
4. PRESERVE ALL PLACEHOLDERS AND FORMATTING EXACTLY:
   - Keep dynamic variables like {name}, {company}, {phone}, etc., exactly as written.
   - Keep WhatsApp formatting (*bold*, _italic_, ~strike~, \`code\`) intact.

Return ONLY a valid JSON object matching this schema:
{
  "variations": [
    { "label": "Message 2 (Warm & Friendly)", "content": "..." },
    { "label": "Message 3 (Polite & Cordial)", "content": "..." }
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
            Authorization: `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': 'https://bulkflow.app',
            'X-Title': 'BulkFlow WhatsApp Gateway',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.6,
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
            if (Array.isArray(list) && list.length >= 1) {
              const formatted = list.slice(0, requestedCount).map((item: any, idx: number) => ({
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
    const fallbackList = generateSmartFallbackVariations(baseMessage, requestedCount);
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
