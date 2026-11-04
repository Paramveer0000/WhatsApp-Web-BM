export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { campaignRunner } from '@/lib/queue/campaign-runner';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const campaigns = await db.campaign.findMany({
      include: {
        instances: { include: { instance: true } },
        variants: true,
        _count: {
          select: { recipients: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute progress stats for each campaign
    const detailed = await Promise.all(
      campaigns.map(async (c) => {
        const counts = await db.campaignRecipient.groupBy({
          by: ['status'],
          where: { campaignId: c.id },
          _count: { _all: true },
        });

        const statusMap: Record<string, number> = {};
        for (const item of counts) {
          statusMap[item.status] = item._count._all;
        }

        const total = c._count.recipients;
        const sent = statusMap['SENT'] || 0;
        const delivered = statusMap['DELIVERED'] || 0;
        const read = statusMap['READ'] || 0;
        const replied = statusMap['REPLIED'] || 0;
        const failed = statusMap['FAILED'] || 0;
        const pending = (statusMap['PENDING'] || 0) + (statusMap['SENDING'] || 0);

        return {
          ...c,
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
        };
      })
    );

    return NextResponse.json({ success: true, campaigns: detailed });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/campaigns');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const rawInstances: string[] = body.instanceIds || body.instances || [];
    const rawLists: string[] = body.listIds || body.contactListIds || [];
    const rawTemplate: string = body.template || body.content || '';
    const consentConfirmed = body.consentConfirmed ?? true;
    const launchImmediately = body.launchImmediately ?? body.sendNow ?? false;
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

    const {
      name,
      recipients = [],
      variants = [],
      minDelay = 12,
      maxDelay = 25,
      simulateTyping = true,
      batchBreakSize = 30,
      batchBreakDuration = 5,
      sendWindowStart = '09:00',
      sendWindowEnd = '20:00',
      timezone = 'Asia/Kolkata',
      warmUpMode = false,
      rotationMode = 'ROUND_ROBIN',
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    if (!rawInstances || rawInstances.length === 0) {
      return NextResponse.json({ error: 'At least one WhatsApp instance must be assigned' }, { status: 400 });
    }

    // Resolve instances by ID or Name
    const instanceRecords = await db.instance.findMany({
      where: {
        OR: [
          { id: { in: rawInstances } },
          { name: { in: rawInstances } },
        ],
      },
    });

    if (instanceRecords.length === 0) {
      return NextResponse.json({ error: 'No matching WhatsApp instances found in database' }, { status: 400 });
    }

    // Compliance Check: User must confirm opt-in consent
    if (!consentConfirmed) {
      return NextResponse.json({
        error: 'Compliance requirement: You must confirm that all contacts have opted in to receive messages.',
      }, { status: 400 });
    }

    // 1. Gather all target recipients (from selected lists or direct array)
    const targetContactsMap = new Map<string, { phone: string; name?: string; customVariables?: any }>();

    if (rawLists.length > 0) {
      const listContacts = await db.listContact.findMany({
        where: { listId: { in: rawLists } },
        include: { contact: true },
      });

      for (const lc of listContacts) {
        if (!lc.contact.isBlacklisted) {
          targetContactsMap.set(lc.contact.phone, {
            phone: lc.contact.phone,
            name: lc.contact.name || undefined,
            customVariables: lc.contact.customFields ? JSON.parse(lc.contact.customFields) : undefined,
          });
        }
      }
    }

    if (Array.isArray(recipients)) {
      for (const r of recipients) {
        if (r.phone && !targetContactsMap.has(r.phone)) {
          targetContactsMap.set(r.phone, r);
        }
      }
    }

    if (targetContactsMap.size === 0) {
      return NextResponse.json({ error: 'No valid recipients selected for this campaign.' }, { status: 400 });
    }

    const campaignStatus = scheduledAt ? 'SCHEDULED' : (launchImmediately ? 'RUNNING' : 'DRAFT');

    // 2. Create Campaign
    const campaign = await db.campaign.create({
      data: {
        name: name.trim(),
        status: campaignStatus,
        minDelay: Number(minDelay) || 12,
        maxDelay: Number(maxDelay) || 25,
        simulateTyping: Boolean(simulateTyping),
        batchBreakSize: Number(batchBreakSize) || 30,
        batchBreakDuration: Number(batchBreakDuration) || 5,
        sendWindowStart,
        sendWindowEnd,
        timezone,
        warmUpMode: Boolean(warmUpMode),
        rotationMode: rotationMode || 'ROUND_ROBIN',
        consentConfirmedAt: new Date(),
        scheduledAt,
        createdById: user.id,
      },
    });

    // 3. Link Instances (using resolved database IDs)
    for (const inst of instanceRecords) {
      await db.campaignInstance.create({
        data: {
          campaignId: campaign.id,
          instanceId: inst.id,
        },
      });
    }

    // 4. Create Variants (A/B testing or default wizard template)
    const defaultVariants = variants.length > 0
      ? variants
      : [{
          content: rawTemplate || 'Hello {name}',
          mediaType: body.mediaType || 'text',
          mediaUrl: body.mediaUrl || null,
          fileName: body.fileName || null,
          caption: body.caption || null,
          weightPercent: 100,
        }];

    for (let i = 0; i < defaultVariants.length; i++) {
      const v = defaultVariants[i];
      await db.campaignVariant.create({
        data: {
          campaignId: campaign.id,
          index: i,
          content: v.content,
          mediaType: v.mediaType || 'text',
          mediaUrl: v.mediaUrl || null,
          fileName: v.fileName || null,
          caption: v.caption || null,
          weightPercent: v.weightPercent || 100,
        },
      });
    }

    // 5. Insert Recipients (assigned variant round-robin or by weight)
    const allContacts = Array.from(targetContactsMap.values());
    const recipientData = allContacts.map((c, idx) => ({
      campaignId: campaign.id,
      phone: c.phone,
      name: c.name || null,
      customVariables: c.customVariables ? JSON.stringify(c.customVariables) : null,
      variantIndex: idx % defaultVariants.length,
      status: 'PENDING',
    }));

    // Chunk insert to avoid SQLite parameter limit
    const chunkSize = 200;
    for (let i = 0; i < recipientData.length; i += chunkSize) {
      await db.campaignRecipient.createMany({
        data: recipientData.slice(i, i + chunkSize),
      });
    }

    // Audit Log
    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'CAMPAIGN_CREATE',
        entity: 'CAMPAIGN',
        details: JSON.stringify({
          campaignId: campaign.id,
          name: campaign.name,
          recipientsCount: allContacts.length,
          status: campaignStatus,
          scheduledAt: scheduledAt?.toISOString() || null,
        }),
      },
    });

    // 6. If launch immediately, trigger campaign runner
    if (launchImmediately && !scheduledAt) {
      campaignRunner.runCampaign(campaign.id).catch((err) => {
        logger.error({ err, campaignId: campaign.id }, 'Error launching campaign runner');
      });
    }

    return NextResponse.json({
      success: true,
      campaign,
      totalRecipients: allContacts.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error creating campaign');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
