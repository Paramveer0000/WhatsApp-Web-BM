export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { PREBUILT_TEMPLATES } from '@/lib/flow/templates';

export const GET = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const templates = PREBUILT_TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    category: t.category,
    nodeCount: t.flow.nodes.length,
  }));

  return NextResponse.json({ success: true, templates });
});
