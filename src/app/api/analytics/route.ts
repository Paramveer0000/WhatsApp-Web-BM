import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [
      instances,
      activeCampaignsCount,
      totalContactsCount,
      blacklistCount,
      incomingMessagesCount,
    ] = await Promise.all([
      db.instance.findMany(),
      db.campaign.count({ where: { status: 'RUNNING' } }),
      db.contact.count(),
      db.blacklist.count(),
      db.incomingMessage.count({ where: { status: 'UNREAD' } }),
    ]);

    const totalDailyCap = instances.reduce((acc, inst) => acc + inst.dailyCap, 0);
    const totalSentToday = instances.reduce((acc, inst) => acc + inst.sentToday, 0);

    // Aggregate 7-day trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRecipients = await db.campaignRecipient.findMany({
      where: {
        sentAt: { gte: sevenDaysAgo },
      },
      select: {
        status: true,
        sentAt: true,
      },
    });

    const dayMap = new Map<string, { date: string; sent: number; delivered: number; read: number; failed: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dayMap.set(dateStr, { date: dateStr, sent: 0, delivered: 0, read: 0, failed: 0 });
    }

    for (const r of recentRecipients) {
      if (!r.sentAt) continue;
      const dateStr = r.sentAt.toISOString().split('T')[0];
      const entry = dayMap.get(dateStr);
      if (entry) {
        if (r.status === 'SENT') entry.sent++;
        else if (r.status === 'DELIVERED') entry.delivered++;
        else if (r.status === 'READ') entry.read++;
        else if (r.status === 'FAILED') entry.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        instancesCount: instances.length,
        connectedInstancesCount: instances.filter((i) => i.status === 'OPEN').length,
        totalSentToday,
        totalDailyCap,
        activeCampaignsCount,
        totalContactsCount,
        blacklistCount,
        unreadRepliesCount: incomingMessagesCount,
      },
      chartData: Array.from(dayMap.values()),
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/analytics');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

