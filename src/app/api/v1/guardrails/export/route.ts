export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveGuardrails } from '@/lib/guardrails';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get('scope') || 'global') as 'global' | 'instance' | 'campaign';
    const scopeId = searchParams.get('scopeId') || '';

    const effective = await getEffectiveGuardrails({
      scope,
      scopeId,
    });

    const exportData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      scope,
      scopeId,
      config: effective.effective,
      strictMode: effective.strictMode,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="guardrails-${scope}${scopeId ? `-${scopeId}` : ''}.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

