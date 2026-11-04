export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { logger, recordSystemLog } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { error, stack, route, component, userAgent, timestamp } = body;

    logger.error({ error, stack, route, component, userAgent }, `[Client Error Telemetry] on ${route || 'unknown'}`);

    await recordSystemLog('error', 'app', `Client Browser Error on ${route || '/'}: ${error || 'Unknown'}`, {
      stack,
      component,
      userAgent,
      timestamp
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
