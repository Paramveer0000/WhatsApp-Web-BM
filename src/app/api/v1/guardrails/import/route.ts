export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { GuardrailConfigSchema, calculateRiskScore } from '@/lib/guardrails';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const configData = body.config || body;

    const validated = GuardrailConfigSchema.parse(configData);
    const risk = calculateRiskScore(validated);

    return NextResponse.json({
      success: true,
      valid: true,
      config: validated,
      risk,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Invalid Guardrail JSON configuration: ' + err.message,
      issues: err.issues || [],
    }, { status: 400 });
  }
}
