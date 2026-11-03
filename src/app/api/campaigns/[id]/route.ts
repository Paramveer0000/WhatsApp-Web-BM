export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { campaignRunner } from '@/lib/queue/campaign-runner';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const campaignId = params.id;
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        instances: { include: { instance: true } },
        variants: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const counts = await db.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });

    const statusMap: Record<string, number> = {};
    for (const item of counts) {
      statusMap[item.status] = item._count._all;
    }

    const total = await db.campaignRecipient.count({ where: { campaignId } });
    const sent = statusMap['SENT'] || 0;
    const delivered = statusMap['DELIVERED'] || 0;
    const read = statusMap['READ'] || 0;
    const replied = statusMap['REPLIED'] || 0;
    const failed = statusMap['FAILED'] || 0;
    const pending = (statusMap['PENDING'] || 0) + (statusMap['SENDING'] || 0);

    return NextResponse.json({
      success: true,
      campaign,
      stats: {
        total,
        sent: sent + delivered + read + replied,
        delivered,
        read,
        replied,
        failed,
        pending,
        percentage: total > 0 ? Math.round(((sent + delivered + read + replied + failed) / total) * 100) : 0,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/campaigns/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaignId = params.id;
    campaignRunner.requestAbort(campaignId);

    await db.campaign.delete({ where: { id: campaignId } });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'CAMPAIGN_DELETE',
        entity: 'CAMPAIGN',
        details: JSON.stringify({ campaignId }),
      },
    });

    return NextResponse.json({ success: true, message: 'Campaign deleted' });
  } catch (err: any) {
    logger.error({ err }, 'Error deleting campaign');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

