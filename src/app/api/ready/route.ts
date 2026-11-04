export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRedisConnection } from '@/lib/queue/redis';
import { logger } from '@/lib/logger';

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {
    database: 'error',
    redis: 'error',
  };

  try {
    // 1. Check DB
    await db.$queryRaw`SELECT 1`;
    checks.database = 'ok';

    // 2. Check Redis
    const redis = getRedisConnection();
    if (redis) {
      const pong = await redis.ping();
      if (pong === 'PONG') checks.redis = 'ok';
    } else {
      checks.redis = 'ok';
    }

    const isReady = checks.database === 'ok' && checks.redis === 'ok';

    return NextResponse.json(
      {
        ready: isReady,
        checks,
        timestamp: new Date().toISOString(),
      },
      { status: isReady ? 200 : 503 }
    );
  } catch (err: any) {
    logger.error({ err: err.message }, 'Readiness check failed');
    return NextResponse.json(
      {
        ready: false,
        error: err.message,
        checks,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
