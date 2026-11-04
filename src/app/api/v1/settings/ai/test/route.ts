export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { OpenRouterClient } from '@/lib/advisor/openrouter';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let apiKey = body.apiKey;

    if (!apiKey) {
      const settings = await db.aiSettings.findFirst();
      if (settings?.apiKeyEncrypted) {
        apiKey = decrypt(settings.apiKeyEncrypted);
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'No OpenRouter API key configured. Please enter a valid key.',
      }, { status: 400 });
    }

    const model = body.model || 'anthropic/claude-3.5-haiku';
    const client = new OpenRouterClient({
      apiKey,
      model,
      timeoutMs: 15000,
    });

    const start = Date.now();
    const result = await client.testConnection();
    const pingMs = Date.now() - start;

    return NextResponse.json({
      success: result.success,
      label: result.label,
      model,
      pingMs,
      error: result.error,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in AI test endpoint');
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
