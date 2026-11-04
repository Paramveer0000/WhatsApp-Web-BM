export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await db.aiSettings.findFirst();

    if (!settings) {
      return NextResponse.json({
        success: true,
        settings: {
          hasKey: false,
          maskedKey: '',
          defaultModel: 'anthropic/claude-3.5-haiku',
          monthlySpendCapUsd: 10.0,
          temperature: 0.2,
          timeoutSec: 30,
        },
      });
    }

    let maskedKey = '';
    if (settings.apiKeyEncrypted) {
      try {
        const decrypted = decrypt(settings.apiKeyEncrypted);
        maskedKey = decrypted.length > 8 
          ? `sk-or-...${decrypted.slice(-4)}`
          : 'sk-or-••••••••';
      } catch {
        maskedKey = 'sk-or-••••••••';
      }
    }

    return NextResponse.json({
      success: true,
      settings: {
        hasKey: Boolean(settings.apiKeyEncrypted),
        maskedKey,
        defaultModel: settings.model || 'anthropic/claude-3.5-haiku',
        monthlySpendCapUsd: settings.monthlyCapUsd ?? 10.0,
        temperature: settings.temperature ?? 0.2,
        timeoutSec: Math.round((settings.timeoutMs ?? 30000) / 1000),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error fetching AI settings');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { apiKey, defaultModel, monthlySpendCapUsd, temperature, timeoutSec } = body;

    let existing = await db.aiSettings.findFirst();

    const dataToSave: any = {
      model: defaultModel || existing?.model || 'anthropic/claude-3.5-haiku',
      monthlyCapUsd: typeof monthlySpendCapUsd === 'number' ? monthlySpendCapUsd : (existing?.monthlyCapUsd ?? 10.0),
      temperature: typeof temperature === 'number' ? temperature : (existing?.temperature ?? 0.2),
      timeoutMs: typeof timeoutSec === 'number' ? timeoutSec * 1000 : (existing?.timeoutMs ?? 30000),
    };

    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      const cleanKey = apiKey.trim();
      dataToSave.apiKeyEncrypted = encrypt(cleanKey);
    }

    if (existing) {
      existing = await db.aiSettings.update({
        where: { id: existing.id },
        data: dataToSave,
      });
    } else {
      existing = await db.aiSettings.create({
        data: {
          id: 'default',
          ...dataToSave,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'AI settings updated successfully',
      settings: {
        hasKey: Boolean(existing.apiKeyEncrypted),
        defaultModel: existing.model,
        monthlySpendCapUsd: existing.monthlyCapUsd,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error updating AI settings');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
