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

    // Compute Per-Variant Detailed Stats (Section 5)
    const variantStats = await Promise.all(
      campaign.variants.map(async (v) => {
        const vCounts = await db.campaignRecipient.groupBy({
          by: ['status'],
          where: {
            campaignId,
            OR: [
              { variantId: v.id },
              { variantIndex: v.index },
            ],
          },
          _count: { _all: true },
        });

        const vStatus: Record<string, number> = {};
        for (const item of vCounts) {
          vStatus[item.status] = item._count._all;
        }

        const vTotal = Object.values(vStatus).reduce((a, b) => a + b, 0);
        const vSent = vStatus['SENT'] || 0;
        const vDelivered = vStatus['DELIVERED'] || 0;
        const vRead = vStatus['READ'] || 0;
        const vReplied = vStatus['REPLIED'] || 0;
        const vFailed = vStatus['FAILED'] || 0;
        const vCompletedSends = vSent + vDelivered + vRead + vReplied;

        const deliveryRate = vCompletedSends > 0 ? Math.round(((vDelivered + vRead + vReplied) / vCompletedSends) * 1000) / 10 : 0;
        const readRate = vCompletedSends > 0 ? Math.round(((vRead + vReplied) / vCompletedSends) * 1000) / 10 : 0;
        const replyRate = vCompletedSends > 0 ? Math.round((vReplied / vCompletedSends) * 1000) / 10 : 0;

        return {
          id: v.id,
          position: v.position,
          label: v.label || `Message ${v.position}`,
          content: v.content,
          isPaused: Boolean(v.isPaused),
          totalAssigned: vTotal,
          sent: vCompletedSends,
          delivered: vDelivered + vRead + vReplied,
          read: vRead + vReplied,
          replied: vReplied,
          failed: vFailed,
          deliveryRate,
          readRate,
          replyRate,
          smallSampleWarning: vCompletedSends < 100,
        };
      })
    );

    // Identify winning performer (highest reply rate among messages with sends)
    let bestVariantId: string | null = null;
    let maxReplyRate = -1;
    for (const vs of variantStats) {
      if (vs.sent > 0 && vs.replyRate > maxReplyRate) {
        maxReplyRate = vs.replyRate;
        bestVariantId = vs.id;
      }
    }

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
      variantStats: variantStats.map((vs) => ({
        ...vs,
        isBestPerformer: vs.id === bestVariantId && maxReplyRate > 0,
      })),
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
