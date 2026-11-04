export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import {
  assignTwoLayerDistribution,
  AllocationStrategy,
  InstanceAllocationInput,
} from '@/lib/distribution';
import { VariantInput, RecipientInput, DistributionMode, RotationScope } from '@/lib/rotation';

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const rawInstances: string[] = body.instances || body.instanceIds || [];
  const rawVariants: any[] = body.variants || [];
  const audienceCount: number = body.audienceCount || (Array.isArray(body.recipients) ? body.recipients.length : 10);
  const strategy: AllocationStrategy = body.allocationStrategy || body.strategy || 'BLOCKS';
  const blockSize: number = Number(body.blockSize) || rawVariants.length || 5;
  const blockSizeMax: number | undefined = body.blockSizeMax ? Number(body.blockSizeMax) : undefined;
  const distributionMode: DistributionMode = body.distributionMode || 'ROTATE';
  const rotationScope: RotationScope = body.rotationScope || (rawInstances.length > 1 ? 'INSTANCE' : 'CAMPAIGN');
  const staggerVariations: boolean = body.staggerVariations ?? true;
  const allocationSeed: number = body.allocationSeed ? Number(body.allocationSeed) : 42;
  const stickyConversations: boolean = body.stickyConversations ?? true;
  const page: number = Number(body.page) || 1;
  const limit: number = Number(body.limit) || 20;

  // 1. Resolve instances from DB or create fallback records
  let instanceRecords: InstanceAllocationInput[] = [];
  if (rawInstances.length > 0) {
    const dbInstances = await db.instance.findMany({
      where: {
        OR: [
          { id: { in: rawInstances } },
          { name: { in: rawInstances } },
        ],
      },
    });

    instanceRecords = dbInstances.map((inst) => {
      const isConn = inst.status?.toUpperCase() === 'OPEN';
      const quota = inst.dailyCap || 200;
      const sent = inst.sentToday || 0;
      return {
        id: inst.id,
        name: inst.name,
        phone: inst.profileNumber,
        dailyQuota: quota,
        todaySent: sent,
        capacity: Math.max(0, quota - sent),
        healthy: isConn,
      };
    });
  }

  // Fallback if no db instances selected
  if (instanceRecords.length === 0) {
    instanceRecords = (rawInstances.length > 0 ? rawInstances : ['Default Number']).map((name, idx) => ({
      id: `inst_${idx + 1}`,
      name,
      dailyQuota: 200,
      todaySent: 0,
      capacity: 200,
      healthy: true,
    }));
  }

  // 2. Prepare sample or provided audience
  let audience: RecipientInput[] = [];
  if (Array.isArray(body.recipients) && body.recipients.length > 0) {
    audience = body.recipients.map((r: any, idx: number) => ({
      id: r.id || `rec_${idx + 1}`,
      contactId: r.contactId || r.id,
      phone: r.phone || `9198000000${String(idx + 1).padStart(2, '0')}`,
      name: r.name || `Contact ${idx + 1}`,
    }));
  } else {
    // Generate representative sample audience
    const count = Math.max(1, Math.min(500, audienceCount));
    audience = Array.from({ length: count }, (_, idx) => ({
      id: `rec_${idx + 1}`,
      contactId: `cnt_${idx + 1}`,
      phone: `9198000000${String(idx + 1).padStart(2, '0')}`,
      name: `Recipient ${idx + 1}`,
    }));
  }

  // 3. Prepare variants
  const variants: VariantInput[] = rawVariants.map((v: any, idx: number) => ({
    id: v.id || `var_${idx + 1}`,
    position: v.position || idx + 1,
    label: v.label || `Message ${idx + 1}`,
    content: v.content || `Hello {name}, this is message ${idx + 1}`,
    mediaType: v.mediaType || 'text',
    mediaUrl: v.mediaUrl || null,
    weight: v.weight ?? v.weightPercent ?? Math.floor(100 / (rawVariants.length || 1)),
  }));

  if (variants.length === 0) {
    variants.push({
      position: 1,
      label: 'Message 1',
      content: body.template || 'Hello {name}',
      weight: 100,
    });
  }

  // 4. Run Two-Layer Distribution Engine
  const result = assignTwoLayerDistribution({
    contacts: audience,
    instances: instanceRecords,
    variants,
    allocationStrategy: strategy,
    blockSize,
    blockSizeMax,
    distributionMode,
    rotationScope,
    staggerVariations,
    allocationSeed,
    stickyConversations,
  });

  // Pagination for the matrix table view
  const startIndex = (page - 1) * limit;
  const paginatedAllocations = result.allocations.slice(startIndex, startIndex + limit);

  return NextResponse.json({
    success: true,
    totalAssignments: result.allocations.length,
    page,
    limit,
    totalPages: Math.ceil(result.allocations.length / limit),
    assignments: paginatedAllocations,
    lanes: result.lanes,
    instanceStats: result.instanceStats,
    matrixHeatmap: result.matrixHeatmap,
    variationTotals: result.variationTotals,
    warnings: result.warnings,
    maxParallelDurationSec: result.maxParallelDurationSec,
  });
});
