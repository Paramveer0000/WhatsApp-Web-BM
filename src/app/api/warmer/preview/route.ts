export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { generateDynamicWarmerTurn } from '@/lib/warmer/dynamic-generator';

// POST /api/warmer/preview - Generate dynamic sample dialogue turns
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { topic = 'casual', useAi = false, aiPrompt } = body;

    const result = await generateDynamicWarmerTurn({
      topic,
      useAi: Boolean(useAi),
      aiPrompt,
      clientId: user.clientId || null,
      historyLogs: [],
    });

    return NextResponse.json({
      success: true,
      preview: result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to preview turn' }, { status: 500 });
  }
}
