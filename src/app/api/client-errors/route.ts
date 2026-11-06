export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { logger, recordSystemLog } from '@/lib/logger';

// In-memory rate limiting for error telemetry (max 10 error events per min per IP)
const telemetryRateMap = new Map<string, { count: number; resetAt: number }>();

function checkTelemetryRate(ip: string): boolean {
  const now = Date.now();
  const entry = telemetryRateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    telemetryRateMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!checkTelemetryRate(ip)) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const error = String(body.error || 'Unknown').slice(0, 300);
    const route = String(body.route || '/').slice(0, 100);
    const stack = typeof body.stack === 'string' ? body.stack.slice(0, 1000) : undefined;
    const component = typeof body.component === 'string' ? body.component.slice(0, 100) : undefined;

    logger.error({ error, route, component }, `[Client Error Telemetry] on ${route}`);

    await recordSystemLog('error', 'app', `Client Browser Error on ${route}: ${error}`, {
      stack,
      component,
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

