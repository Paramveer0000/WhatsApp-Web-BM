export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: campaignId, variantId } = params;

    const variant = await db.campaignVariant.findFirst({
      where: { id: variantId, campaignId },
    });

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    await db.campaignVariant.update({
      where: { id: variantId },
      data: { isPaused: false },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'VARIANT_RESUME',
        entity: 'CAMPAIGN_VARIANT',
        details: JSON.stringify({
          campaignId,
          variantId,
          variantLabel: variant.label,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Message "${variant.label}" resumed.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
