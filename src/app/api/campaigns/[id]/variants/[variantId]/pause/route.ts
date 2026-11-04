export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redistributeRemainingRecipients, DistributionMode } from '@/lib/rotation';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: campaignId, variantId } = params;

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { variants: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const targetVariant = campaign.variants.find((v) => v.id === variantId);
    if (!targetVariant) {
      return NextResponse.json({ error: 'Variant not found in this campaign' }, { status: 404 });
    }

    const activeVariants = campaign.variants.filter((v) => v.id !== variantId && !v.isPaused);
    if (activeVariants.length === 0) {
      return NextResponse.json({
        error: 'Cannot pause the only active message variant. At least one message must remain active.',
      }, { status: 400 });
    }

    // 1. Mark variant paused
    await db.campaignVariant.update({
      where: { id: variantId },
      data: { isPaused: true },
    });

    // 2. Find remaining un-sent recipients assigned to this paused variant
    const remainingRecipients = await db.campaignRecipient.findMany({
      where: {
        campaignId,
        variantId,
        status: { in: ['PENDING', 'QUEUED'] },
      },
      select: { id: true, phone: true, variantId: true, rotationIndex: true },
    });

    let redistributedCount = 0;
    if (remainingRecipients.length > 0) {
      const reassignments = redistributeRemainingRecipients({
        remainingRecipients,
        activeVariants: activeVariants.map((v) => ({
          id: v.id,
          position: v.position,
          label: v.label || `Message ${v.position}`,
          content: v.content,
          weight: v.weight,
        })),
        distributionMode: (campaign.distributionMode as DistributionMode) || 'ROTATE',
        campaignId,
      });

      // Update in transaction batches
      for (const item of reassignments) {
        await db.campaignRecipient.update({
          where: { id: item.id },
          data: {
            variantId: item.variantId,
            variantIndex: item.variantIndex,
          },
        });
      }
      redistributedCount = reassignments.length;
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'VARIANT_PAUSE',
        entity: 'CAMPAIGN_VARIANT',
        details: JSON.stringify({
          campaignId,
          variantId,
          variantLabel: targetVariant.label,
          redistributedCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Message "${targetVariant.label}" paused. ${redistributedCount} remaining recipients redistributed.`,
      redistributedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

