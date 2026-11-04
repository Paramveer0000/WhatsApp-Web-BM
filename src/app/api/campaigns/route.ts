export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { campaignRunner } from '@/lib/queue/campaign-runner';
import { logger } from '@/lib/logger';
import {
  assignMessageRotation,
  computeContentHash,
  detectDuplicateVariants,
  CampaignRotationSchema,
  VariantInput,
  RecipientInput,
  DistributionMode,
  RotationScope,
} from '@/lib/rotation';

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
      distributionMode = 'SINGLE',
      rotationScope = 'CAMPAIGN',
      shuffleAudience = false,
      shuffleSeed = null,
      avoidRepeatContent = true,
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

    // Prepare & normalize variants
    let normalizedVariants: VariantInput[] = [];
    if (Array.isArray(variants) && variants.length > 0) {
      normalizedVariants = variants.map((v: any, idx: number) => ({
        position: v.position || idx + 1,
        label: v.label || `Message ${idx + 1}`,
        content: v.content || v.body || '',
        mediaType: v.mediaType || 'text',
        mediaUrl: v.mediaUrl || null,
        fileName: v.fileName || null,
        caption: v.caption || null,
        weight: v.weight ?? v.weightPercent ?? Math.floor(100 / variants.length),
        weightPercent: v.weightPercent ?? v.weight ?? Math.floor(100 / variants.length),
        contentHash: computeContentHash(v.content || v.body || ''),
      }));
    } else {
      normalizedVariants = [{
        position: 1,
        label: 'Message 1',
        content: rawTemplate || 'Hello {name}',
        mediaType: body.mediaType || 'text',
        mediaUrl: body.mediaUrl || null,
        fileName: body.fileName || null,
        caption: body.caption || null,
        weight: 100,
        weightPercent: 100,
        contentHash: computeContentHash(rawTemplate || 'Hello {name}'),
      }];
    }

    // Validate variants using CampaignRotationSchema
    const validatedRotation = CampaignRotationSchema.safeParse({
      distributionMode: (distributionMode as DistributionMode) || 'SINGLE',
      rotationScope: (rotationScope as RotationScope) || 'CAMPAIGN',
      shuffleAudience: Boolean(shuffleAudience),
      shuffleSeed: shuffleSeed ? Number(shuffleSeed) : null,
      avoidRepeatContent: Boolean(avoidRepeatContent),
      variants: normalizedVariants,
    });

    if (!validatedRotation.success) {
      const errMsg = validatedRotation.error.errors.map((e) => e.message).join('; ');
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    // Detect duplicate variants (>85% similarity)
    const duplicateWarnings = detectDuplicateVariants(normalizedVariants, 0.85);

    // Compliance Check: User must confirm opt-in consent
    if (!consentConfirmed) {
      return NextResponse.json({
        error: 'Compliance requirement: You must confirm that all contacts have opted in to receive messages.',
      }, { status: 400 });
    }

    // 1. Gather all target recipients (from selected lists or direct array)
    const targetContactsMap = new Map<string, { id?: string; contactId?: string; phone: string; name?: string; customVariables?: any; listId?: string }>();

    if (rawLists.length > 0) {
      const listContacts = await db.listContact.findMany({
        where: { listId: { in: rawLists } },
        include: { contact: true },
      });

      for (const lc of listContacts) {
        if (!lc.contact.isBlacklisted) {
          targetContactsMap.set(lc.contact.phone, {
            id: lc.contact.id,
            contactId: lc.contact.id,
            phone: lc.contact.phone,
            name: lc.contact.name || undefined,
            customVariables: lc.contact.customFields ? JSON.parse(lc.contact.customFields) : undefined,
            listId: lc.listId,
          });
        }
      }
    }

    if (Array.isArray(recipients)) {
      for (const r of recipients) {
        if (r.phone && !targetContactsMap.has(r.phone)) {
          targetContactsMap.set(r.phone, {
            id: r.id || r.contactId,
            contactId: r.contactId || r.id,
            phone: r.phone,
            name: r.name || undefined,
            customVariables: r.customVariables || undefined,
            listId: r.listId,
          });
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
        distributionMode: validatedRotation.data.distributionMode,
        rotationScope: validatedRotation.data.rotationScope,
        shuffleAudience: validatedRotation.data.shuffleAudience,
        shuffleSeed: validatedRotation.data.shuffleSeed,
        avoidRepeatContent: validatedRotation.data.avoidRepeatContent,
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

    // 4. Create Variants
    const createdVariants = [];
    for (let i = 0; i < normalizedVariants.length; i++) {
      const v = normalizedVariants[i]!;
      const createdV = await db.campaignVariant.create({
        data: {
          campaignId: campaign.id,
          index: i,
          position: v.position,
          label: v.label,
          content: v.content,
          mediaType: v.mediaType || 'text',
          mediaUrl: v.mediaUrl || null,
          fileName: v.fileName || null,
          caption: v.caption || null,
          weightPercent: v.weightPercent || 100,
          weight: v.weight,
          contentHash: v.contentHash || computeContentHash(v.content),
          similarityWarnings: duplicateWarnings.length > 0 ? JSON.stringify(duplicateWarnings) : null,
          isPaused: false,
        },
      });
      createdVariants.push({
        ...v,
        id: createdV.id,
      });
    }

    // 5. Query recent message content hashes for contacts (past 30 days) if avoidRepeatContent is true
    const previousContentHashes = new Map<string, Set<string>>();
    if (validatedRotation.data.avoidRepeatContent) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const phones = Array.from(targetContactsMap.keys());
      const pastRecipients = await db.campaignRecipient.findMany({
        where: {
          phone: { in: phones.slice(0, 1000) }, // batch
          status: { in: ['SENT', 'DELIVERED', 'READ', 'REPLIED'] },
          sentAt: { gte: thirtyDaysAgo },
          variantId: { not: null },
        },
        include: { variant: true },
      });

      for (const pr of pastRecipients) {
        if (pr.variant?.contentHash) {
          const set = previousContentHashes.get(pr.phone) || new Set<string>();
          set.add(pr.variant.contentHash);
          previousContentHashes.set(pr.phone, set);
        }
      }
    }

    // 6. Enqueue-Time Deterministic Assignment (Section 3)
    const audienceList: RecipientInput[] = Array.from(targetContactsMap.values()).map((c, idx) => ({
      id: `rec_${idx + 1}`,
      contactId: c.contactId,
      phone: c.phone,
      name: c.name,
      customVariables: c.customVariables,
      listId: c.listId,
      instanceId: instanceRecords[idx % instanceRecords.length]?.id,
    }));

    const rotationResult = assignMessageRotation({
      audience: audienceList,
      variants: createdVariants,
      distributionMode: validatedRotation.data.distributionMode,
      rotationScope: validatedRotation.data.rotationScope,
      shuffleAudience: validatedRotation.data.shuffleAudience,
      shuffleSeed: validatedRotation.data.shuffleSeed ?? undefined,
      campaignId: campaign.id,
      previousContentHashes,
      avoidRepeatContent: validatedRotation.data.avoidRepeatContent,
    });

    const recipientData = rotationResult.assignments.map((assigned) => ({
      campaignId: campaign.id,
      phone: assigned.phone,
      name: assigned.name || null,
      customVariables: assigned.customVariables ? JSON.stringify(assigned.customVariables) : null,
      variantId: assigned.variantId || null,
      variantIndex: assigned.variantIndex,
      rotationIndex: assigned.rotationIndex,
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
          recipientsCount: audienceList.length,
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
      totalRecipients: audienceList.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error creating campaign');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
