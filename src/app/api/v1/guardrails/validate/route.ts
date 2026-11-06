export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { GuardrailConfigSchema, calculateRiskScore } from '@/lib/guardrails';

import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const validated = GuardrailConfigSchema.parse(body.config);
    const risk = calculateRiskScore(validated);

    const warnings: string[] = [];
    if (validated.pacing.minDelay < 8) {
      warnings.push('Min delay is below 8 seconds. This carries a high risk of WhatsApp rate limiting.');
    }
    if (validated.volumeLimits.dailyCapPerNumber > 300) {
      warnings.push('Daily cap exceeds 300 messages. Recommended only for aged numbers with high reputation.');
    }
    if (!validated.contentSafety.requireSpintax) {
      warnings.push('Spintax is disabled. Sending identical copy to large lists triggers rapid automated account flags.');
    }

    return NextResponse.json({
      success: true,
      valid: true,
      risk,
      warnings,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      valid: false,
      error: err.message,
      issues: err.issues || [],
    }, { status: 400 });
  }
}

