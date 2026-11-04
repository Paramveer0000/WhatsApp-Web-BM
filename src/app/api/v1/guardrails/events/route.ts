export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');

    const where: any = {};
    if (severity) where.severity = severity;
    if (type) where.type = type;

    const events = await db.guardrailEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      events: events.map((e) => ({
        id: e.id,
        instanceId: e.instanceId,
        campaignId: e.campaignId,
        type: e.type,
        severity: e.severity,
        detail: JSON.parse(e.detail || '{}'),
        createdAt: e.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

