export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { warmerRunner } from '@/lib/warmer/warmer-runner';
import { isTenantScoped, getTenantWhere } from '@/lib/tenant';

/**
 * Emergency stop endpoint: immediately pauses all running Number Warmer sessions
 * and clears pending schedules in database & memory.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const whereClause: any = {
      status: 'RUNNING',
    };

    if (isTenantScoped(user)) {
      whereClause.clientId = user.clientId;
    }

    const runningSessions = await db.numberWarmerSession.findMany({
      where: whereClause,
      select: { id: true },
    });

    // Update all matching running sessions to PAUSED and clear scheduling
    await db.numberWarmerSession.updateMany({
      where: whereClause,
      data: {
        status: 'PAUSED',
        nextScheduledAt: null,
      },
    });

    // Clear runner tracking
    warmerRunner.pauseAll();

    return NextResponse.json({
      success: true,
      message: `Emergency stop executed. ${runningSessions.length} warmer session(s) paused immediately.`,
      count: runningSessions.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to emergency stop warmers' }, { status: 500 });
  }
}
