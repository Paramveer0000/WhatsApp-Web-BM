export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { campaignRunner } from '@/lib/queue/campaign-runner';
import { CircuitBreaker } from '@/lib/evolution';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const campaignId = params.id;
    const body = await req.json();
    const action = (body.action || '').toUpperCase(); // 'START', 'PAUSE', 'RESUME', 'ABORT', 'DUPLICATE', 'RESEND_FAILED'

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { instances: { include: { instance: true } }, variants: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (action === 'START' || action === 'RESUME' || action === 'OVERRIDE_WINDOW' || action === 'SEND_NOW') {
      for (const inst of campaign.instances) {
        if ((inst as any).instance?.name) CircuitBreaker.recordSuccess((inst as any).instance.name);
        if (inst.instanceId) CircuitBreaker.recordSuccess(inst.instanceId);
      }
      if (action === 'OVERRIDE_WINDOW' || action === 'SEND_NOW') {
        campaignRunner.overrideWindow(campaignId);
      }
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING', haltReason: null },
      });

      campaignRunner.runCampaign(campaignId).catch((err) => {
        logger.error({ err, campaignId }, 'Error running campaign');
      });

      await db.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: action === 'START' ? 'CAMPAIGN_START' : 'CAMPAIGN_RESUME',
          entity: 'CAMPAIGN',
          details: JSON.stringify({ campaignId, name: campaign.name }),
        },
      });

      return NextResponse.json({ success: true, message: `Campaign ${action.toLowerCase()}ed` });
    }

    if (action === 'PAUSE') {
      campaignRunner.requestPause(campaignId);
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' },
      });

      await db.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: 'CAMPAIGN_PAUSE',
          entity: 'CAMPAIGN',
          details: JSON.stringify({ campaignId }),
        },
      });

      return NextResponse.json({ success: true, message: 'Campaign paused' });
    }

    if (action === 'ABORT') {
      campaignRunner.requestAbort(campaignId);
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'ABORTED', completedAt: new Date() },
      });

      await db.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: 'CAMPAIGN_ABORT',
          entity: 'CAMPAIGN',
          details: JSON.stringify({ campaignId }),
        },
      });

      return NextResponse.json({ success: true, message: 'Campaign aborted' });
    }

    // Duplicate Campaign
    if (action === 'DUPLICATE') {
      const duplicate = await db.campaign.create({
        data: {
          name: `${campaign.name} (Copy)`,
          status: 'DRAFT',
          minDelay: campaign.minDelay,
          maxDelay: campaign.maxDelay,
          simulateTyping: campaign.simulateTyping,
          batchBreakSize: campaign.batchBreakSize,
          batchBreakDuration: campaign.batchBreakDuration,
          sendWindowStart: campaign.sendWindowStart,
          sendWindowEnd: campaign.sendWindowEnd,
          timezone: campaign.timezone,
          warmUpMode: campaign.warmUpMode,
          rotationMode: campaign.rotationMode,
          createdById: user.id,
        },
      });

      // Link instances
      for (const ci of campaign.instances) {
        await db.campaignInstance.create({
          data: { campaignId: duplicate.id, instanceId: ci.instanceId },
        });
      }

      // Copy variants
      for (const v of campaign.variants) {
        await db.campaignVariant.create({
          data: {
            campaignId: duplicate.id,
            index: v.index,
            content: v.content,
            mediaType: v.mediaType,
            mediaUrl: v.mediaUrl,
            fileName: v.fileName,
            caption: v.caption,
            weightPercent: v.weightPercent,
          },
        });
      }

      return NextResponse.json({ success: true, duplicateId: duplicate.id });
    }

    // Re-send to failed only
    if (action === 'RESEND_FAILED') {
      const updated = await db.campaignRecipient.updateMany({
        where: { campaignId, status: 'FAILED' },
        data: { status: 'PENDING', lastError: null },
      });

      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING', haltReason: null },
      });

      campaignRunner.runCampaign(campaignId).catch((err) => {
        logger.error({ err, campaignId }, 'Error running re-send failed');
      });

      return NextResponse.json({
        success: true,
        message: `Queued ${updated.count} failed message(s) for re-dispatch`,
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/campaigns/[id]/control');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

