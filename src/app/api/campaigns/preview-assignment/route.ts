export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import {
  assignMessageRotation,
  computeContentHash,
  detectDuplicateVariants,
  VariantInput,
  RecipientInput,
  DistributionMode,
  RotationScope,
} from '@/lib/rotation';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      variants = [],
      distributionMode = 'SINGLE',
      rotationScope = 'CAMPAIGN',
      shuffleAudience = false,
      shuffleSeed,
      audienceCount = 20,
      sampleContacts = [],
      campaignId = 'preview_sim',
    } = body;

    if (!Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ error: 'At least one variant is required' }, { status: 400 });
    }

    const normalizedVariants: VariantInput[] = variants.map((v: any, idx: number) => ({
      id: v.id || `v_${idx + 1}`,
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
      isPaused: Boolean(v.isPaused),
    }));

    // Generate sample audience if none provided
    const audienceList: RecipientInput[] =
      Array.isArray(sampleContacts) && sampleContacts.length > 0
        ? sampleContacts.slice(0, 50).map((c: any, idx: number) => ({
            id: c.id || `sample_${idx + 1}`,
            phone: c.phone || `+1555000${String(idx + 1).padStart(4, '0')}`,
            name: c.name || `Recipient ${idx + 1}`,
            instanceId: c.instanceId,
            listId: c.listId,
          }))
        : Array.from({ length: Math.min(50, Math.max(4, audienceCount)) }, (_, idx) => ({
            id: `sample_${idx + 1}`,
            phone: `+1555000${String(idx + 1).padStart(4, '0')}`,
            name: `Recipient ${idx + 1}`,
            instanceId: `inst_${(idx % 2) + 1}`,
          }));

    const result = assignMessageRotation({
      audience: audienceList,
      variants: normalizedVariants,
      distributionMode: distributionMode as DistributionMode,
      rotationScope: rotationScope as RotationScope,
      shuffleAudience: Boolean(shuffleAudience),
      shuffleSeed: typeof shuffleSeed === 'number' ? shuffleSeed : undefined,
      campaignId,
    });

    const duplicateWarnings = detectDuplicateVariants(normalizedVariants, 0.85);

    return NextResponse.json({
      success: true,
      sampleAssignments: result.assignments.slice(0, 24),
      variantCounts: result.variantCounts,
      warnings: [...result.warnings, ...duplicateWarnings.map((dw) => dw.warning)],
      duplicates: duplicateWarnings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
