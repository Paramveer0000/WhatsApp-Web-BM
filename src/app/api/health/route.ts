import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Quick DB check
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Health check failed');
    return NextResponse.json(
      {
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

