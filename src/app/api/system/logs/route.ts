import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { recordSystemLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '150', 10), 500);
    const level = searchParams.get('level');
    const source = searchParams.get('source');
    const search = searchParams.get('search')?.trim();

    // Build filter
    const whereClause: any = {};
    if (level && level !== 'all') {
      whereClause.level = level;
    }
    if (source && source !== 'all') {
      whereClause.source = source;
    }
    if (search) {
      whereClause.OR = [
        { message: { contains: search } },
        { details: { contains: search } },
      ];
    }

    // Query logs and counts in parallel
    const [logs, totalLogs, errorCount, warnCount, infoCount, heartbeat] = await Promise.all([
      db.systemLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.systemLog.count(),
      db.systemLog.count({ where: { level: 'error' } }),
      db.systemLog.count({ where: { level: 'warn' } }),
      db.systemLog.count({ where: { level: 'info' } }),
      db.workerHeartbeat.findUnique({
        where: { id: 'default' },
      }),
    ]);

    // Calculate worker online status (online if heartbeat reported within last 20 seconds)
    const now = Date.now();
    let isWorkerOnline = false;
    let secondsAgo: number | null = null;
    let parsedMetadata: any = null;

    if (heartbeat && heartbeat.lastSeen) {
      const lastSeenMs = new Date(heartbeat.lastSeen).getTime();
      secondsAgo = Math.max(0, Math.floor((now - lastSeenMs) / 1000));
      isWorkerOnline = secondsAgo < 25; // 5-second interval + 20s grace period

      if (heartbeat.metadata) {
        try {
          parsedMetadata = JSON.parse(heartbeat.metadata);
        } catch {
          parsedMetadata = { raw: heartbeat.metadata };
        }
      }
    }

    return NextResponse.json({
      success: true,
      logs,
      worker: {
        isOnline: isWorkerOnline,
        lastSeen: heartbeat?.lastSeen || null,
        secondsAgo,
        status: heartbeat?.status || 'UNKNOWN',
        metadata: parsedMetadata,
      },
      stats: {
        totalLogs,
        errorCount,
        warnCount,
        infoCount,
      },
      system: {
        database: 'ONLINE',
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch system logs',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDbSchema();
    const { searchParams } = new URL(req.url);
    const keepLast = parseInt(searchParams.get('keepLast') || '0', 10);

    if (keepLast > 0) {
      const recent = await db.systemLog.findMany({
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: keepLast,
      });
      const keepIds = recent.map((r) => r.id);
      await db.systemLog.deleteMany({
        where: {
          id: { notIn: keepIds },
        },
      });
    } else {
      await db.systemLog.deleteMany();
    }

    await recordSystemLog('info', 'app', 'System logs cleared by user').catch(() => {});

    return NextResponse.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear logs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();
    const body = await req.json().catch(() => ({}));
    const message = body.message || 'Manual system diagnostic ping';
    const level = body.level || 'info';
    const source = body.source || 'app';

    await recordSystemLog(level, source, message, {
      triggeredAt: new Date().toISOString(),
      ...body.details,
    });

    return NextResponse.json({ success: true, message: 'Diagnostic event recorded' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record diagnostic event' },
      { status: 500 }
    );
  }
}
