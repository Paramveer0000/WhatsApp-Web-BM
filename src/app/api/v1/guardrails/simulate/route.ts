export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { GuardrailConfigSchema, simulatePacing } from '@/lib/guardrails';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = GuardrailConfigSchema.parse(body.config);
    const recipientsCount = Number(body.recipientsCount || 500);
    const startTime = body.startTime || new Date().toISOString();
    const seed = body.seed ? Number(body.seed) : 12345;

    const simulation = simulatePacing(config, {
      recipientsCount,
      startTime,
      seed,
    });

    return NextResponse.json({
      success: true,
      simulation,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

