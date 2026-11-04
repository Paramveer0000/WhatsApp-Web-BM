import { z } from 'zod';
import {
  computeContentHash,
  hashString,
  createMulberry32PRNG,
  deterministicShuffle,
  detectDuplicateVariants,
  VariantInput,
  RecipientInput,
  DistributionMode,
  RotationScope,
} from './rotation';

export const MAX_VARIANTS = 20;

export type AllocationStrategy =
  | 'BLOCKS'
  | 'ROUND_ROBIN'
  | 'PROPORTIONAL'
  | 'WEIGHTED'
  | 'FILL_THEN_SPILL';

export interface InstanceAllocationInput {
  id: string;
  name: string;
  phone?: string | null;
  dailyQuota?: number;
  todaySent?: number;
  capacity?: number; // remaining capacity = max(0, dailyQuota - todaySent)
  weight?: number; // 0 - 100 percentage for WEIGHTED strategy
  healthy?: boolean;
  position?: number;
}

export interface AllocatedContact extends RecipientInput {
  instanceId: string;
  instanceName: string;
  allocationIndex: number; // 0-based global index in campaign audience
  instanceSeq: number; // 0-based sequence index within this specific instance
  blockIndex?: number;
}

export interface AllocateContactsParams {
  contacts: RecipientInput[];
  instances: InstanceAllocationInput[];
  strategy?: AllocationStrategy;
  blockSize?: number;
  blockSizeMax?: number; // If set, jitter block size between blockSize and blockSizeMax
  seed?: number;
  stickyConversations?: boolean;
  previousInstanceMap?: Map<string, string>; // phone/contactId -> instanceId or instanceName
}

export interface TwoLayerAssignmentResult {
  allocations: TwoLayerAssignedRecipient[];
  lanes: Record<string, TwoLayerAssignedRecipient[]>; // instanceId -> recipient list
  instanceStats: Record<
    string,
    {
      instanceId: string;
      instanceName: string;
      allocatedCount: number;
      variantDistribution: Record<string, number>;
      estimatedDurationSec: number;
      remainingCapacity: number;
      capacityWarning?: string;
    }
  >;
  variationTotals: Record<string, number>;
  matrixHeatmap: {
    instanceName: string;
    counts: Record<string, number>; // variantLabel -> count
  }[];
  warnings: string[];
  maxParallelDurationSec: number;
}

export interface TwoLayerAssignedRecipient extends AllocatedContact {
  variantIndex: number;
  variantPosition: number;
  variantId?: string;
  variantLabel: string;
  variantContent: string;
  contentHash: string;
  renderedPreview?: string;
}

export interface AssignTwoLayerParams {
  contacts: RecipientInput[];
  instances: InstanceAllocationInput[];
  variants: VariantInput[];
  allocationStrategy?: AllocationStrategy;
  blockSize?: number;
  blockSizeMax?: number;
  distributionMode?: DistributionMode;
  rotationScope?: RotationScope;
  staggerVariations?: boolean;
  allocationSeed?: number;
  stickyConversations?: boolean;
  previousInstanceMap?: Map<string, string>;
  previousContentHashes?: Map<string, Set<string>>;
  avoidRepeatContent?: boolean;
  pacingAvgDelaySec?: number;
  perInstanceSubsets?: Record<string, string[]>; // instanceId -> allowed variantIds
}

// ----------------------------------------------------------------------
// 1. Layer 1: Contact -> Instance Allocation
// ----------------------------------------------------------------------

export function allocateContactsToInstances(
  params: AllocateContactsParams
): { allocations: AllocatedContact[]; warnings: string[] } {
  const {
    contacts,
    instances,
    strategy = 'BLOCKS',
    blockSize = 5,
    blockSizeMax,
    seed = 42,
    stickyConversations = true,
    previousInstanceMap,
  } = params;

  const warnings: string[] = [];

  if (!contacts || contacts.length === 0) {
    return { allocations: [], warnings };
  }

  // Filter only healthy/open instances (fallback to all if none marked healthy)
  let activeInstances = instances.filter((i) => i.healthy !== false);
  if (activeInstances.length === 0) {
    activeInstances = [...instances];
    if (instances.length > 0) {
      warnings.push('All instances are offline or unhealthy. Using all available instances as fallback.');
    }
  }

  if (activeInstances.length === 0) {
    throw new Error('At least one WhatsApp instance is required for broadcast allocation.');
  }

  // Pre-calculate remaining capacities
  const instanceCapacities = new Map<string, number>();
  let totalCapacity = 0;
  for (const inst of activeInstances) {
    const quota = inst.dailyQuota ?? 200;
    const sent = inst.todaySent ?? 0;
    const remaining = inst.capacity ?? Math.max(0, quota - sent);
    instanceCapacities.set(inst.id, remaining);
    totalCapacity += remaining;
  }

  if (totalCapacity < contacts.length) {
    warnings.push(
      `Total remaining capacity across numbers (${totalCapacity}) is less than audience size (${contacts.length}). The campaign may span multiple daily windows.`
    );
  }

  const assigned: AllocatedContact[] = [];
  const unassignedContacts: RecipientInput[] = [];
  const instanceAssignedCounts = new Map<string, number>();
  for (const inst of activeInstances) {
    instanceAssignedCounts.set(inst.id, 0);
  }

  // Sticky conversations pass: if enabled, contacts with prior chat history stick to that instance
  if (stickyConversations && previousInstanceMap && previousInstanceMap.size > 0) {
    for (const c of contacts) {
      const priorIdOrName = previousInstanceMap.get(c.phone) || (c.contactId ? previousInstanceMap.get(c.contactId) : undefined);
      const matchInst = activeInstances.find(
        (i) => i.id === priorIdOrName || i.name === priorIdOrName
      );

      if (matchInst) {
        const seq = instanceAssignedCounts.get(matchInst.id)!;
        instanceAssignedCounts.set(matchInst.id, seq + 1);
        assigned.push({
          ...c,
          instanceId: matchInst.id,
          instanceName: matchInst.name,
          allocationIndex: 0, // will re-index
          instanceSeq: seq,
        });
      } else {
        unassignedContacts.push(c);
      }
    }
  } else {
    unassignedContacts.push(...contacts);
  }

  // Core partitioning for unassigned contacts
  const rng = createMulberry32PRNG(seed);
  const effectiveBlockSize = Math.max(1, Math.min(500, Math.floor(blockSize)));

  if (strategy === 'BLOCKS') {
    let currentInstIdx = 0;
    let currentBlockRemaining = effectiveBlockSize;
    let blockCounter = 0;

    for (let i = 0; i < unassignedContacts.length; i++) {
      const c = unassignedContacts[i]!;
      const inst = activeInstances[currentInstIdx % activeInstances.length]!;
      const seq = instanceAssignedCounts.get(inst.id)!;
      instanceAssignedCounts.set(inst.id, seq + 1);

      assigned.push({
        ...c,
        instanceId: inst.id,
        instanceName: inst.name,
        allocationIndex: 0,
        instanceSeq: seq,
        blockIndex: blockCounter,
      });

      currentBlockRemaining--;
      if (currentBlockRemaining <= 0) {
        currentInstIdx++;
        blockCounter++;
        // Apply optional jitter if blockSizeMax is provided
        if (blockSizeMax && blockSizeMax > effectiveBlockSize) {
          const jitterSpan = blockSizeMax - effectiveBlockSize + 1;
          currentBlockRemaining = effectiveBlockSize + Math.floor(rng() * jitterSpan);
        } else {
          currentBlockRemaining = effectiveBlockSize;
        }
      }
    }
  } else if (strategy === 'ROUND_ROBIN') {
    for (let i = 0; i < unassignedContacts.length; i++) {
      const c = unassignedContacts[i]!;
      const inst = activeInstances[i % activeInstances.length]!;
      const seq = instanceAssignedCounts.get(inst.id)!;
      instanceAssignedCounts.set(inst.id, seq + 1);

      assigned.push({
        ...c,
        instanceId: inst.id,
        instanceName: inst.name,
        allocationIndex: 0,
        instanceSeq: seq,
      });
    }
  } else if (strategy === 'PROPORTIONAL') {
    // Proportional to remaining daily budget
    const weights = activeInstances.map((inst) => {
      const cap = instanceCapacities.get(inst.id) || 1;
      return Math.max(1, cap);
    });
    const sumWeights = weights.reduce((a, b) => a + b, 0);

    let cumulative = 0;
    const thresholds = weights.map((w) => {
      cumulative += (w / sumWeights) * 10000;
      return cumulative;
    });

    for (let i = 0; i < unassignedContacts.length; i++) {
      const c = unassignedContacts[i]!;
      const hashVal = hashString(`${seed}_prop_${c.phone || c.id || i}`);
      const bucket = hashVal % 10000;

      let pickedIdx = 0;
      for (let t = 0; t < thresholds.length; t++) {
        if (bucket < thresholds[t]!) {
          pickedIdx = t;
          break;
        }
      }
      const inst = activeInstances[pickedIdx] || activeInstances[0]!;
      const seq = instanceAssignedCounts.get(inst.id)!;
      instanceAssignedCounts.set(inst.id, seq + 1);

      assigned.push({
        ...c,
        instanceId: inst.id,
        instanceName: inst.name,
        allocationIndex: 0,
        instanceSeq: seq,
      });
    }
  } else if (strategy === 'WEIGHTED') {
    // Manual percentage weights
    let totalWeight = activeInstances.reduce((sum, inst) => sum + (inst.weight ?? (100 / activeInstances.length)), 0);
    if (totalWeight <= 0) totalWeight = 100;

    let cumulative = 0;
    const thresholds = activeInstances.map((inst) => {
      const w = inst.weight ?? (100 / activeInstances.length);
      cumulative += (w / totalWeight) * 10000;
      return cumulative;
    });

    for (let i = 0; i < unassignedContacts.length; i++) {
      const c = unassignedContacts[i]!;
      const hashVal = hashString(`${seed}_weight_${c.phone || c.id || i}`);
      const bucket = hashVal % 10000;

      let pickedIdx = 0;
      for (let t = 0; t < thresholds.length; t++) {
        if (bucket < thresholds[t]!) {
          pickedIdx = t;
          break;
        }
      }
      const inst = activeInstances[pickedIdx] || activeInstances[0]!;
      const seq = instanceAssignedCounts.get(inst.id)!;
      instanceAssignedCounts.set(inst.id, seq + 1);

      assigned.push({
        ...c,
        instanceId: inst.id,
        instanceName: inst.name,
        allocationIndex: 0,
        instanceSeq: seq,
      });
    }
  } else if (strategy === 'FILL_THEN_SPILL') {
    let currentInstIdx = 0;
    let currentCap = instanceCapacities.get(activeInstances[currentInstIdx]?.id || '') || 200;

    for (let i = 0; i < unassignedContacts.length; i++) {
      const c = unassignedContacts[i]!;
      while (
        currentCap <= 0 &&
        currentInstIdx < activeInstances.length - 1
      ) {
        currentInstIdx++;
        currentCap = instanceCapacities.get(activeInstances[currentInstIdx]?.id || '') || 200;
      }
      const inst = activeInstances[currentInstIdx]!;
      const seq = instanceAssignedCounts.get(inst.id)!;
      instanceAssignedCounts.set(inst.id, seq + 1);
      currentCap--;

      assigned.push({
        ...c,
        instanceId: inst.id,
        instanceName: inst.name,
        allocationIndex: 0,
        instanceSeq: seq,
      });
    }
  }

  // Ensure deterministic global allocation indices
  assigned.forEach((item, idx) => {
    item.allocationIndex = idx;
  });

  return { allocations: assigned, warnings };
}

// ----------------------------------------------------------------------
// 2. Layer 2: Message Variation Assignment & Pacing Matrix
// ----------------------------------------------------------------------

export function assignTwoLayerDistribution(
  params: AssignTwoLayerParams
): TwoLayerAssignmentResult {
  const {
    contacts,
    instances,
    variants,
    allocationStrategy = 'BLOCKS',
    blockSize = variants?.length || 5,
    blockSizeMax,
    distributionMode = 'ROTATE',
    rotationScope = instances.length > 1 ? 'INSTANCE' : 'CAMPAIGN',
    staggerVariations = true,
    allocationSeed = 42,
    stickyConversations = true,
    previousInstanceMap,
    previousContentHashes,
    avoidRepeatContent = true,
    pacingAvgDelaySec = 15,
    perInstanceSubsets,
  } = params;

  if (!variants || variants.length === 0) {
    throw new Error('At least one message variation is required.');
  }

  // Active variants
  let activeVariants = variants.filter((v) => !v.isPaused);
  if (activeVariants.length === 0) {
    activeVariants = [...variants];
  }

  // Content hashes
  for (const v of variants) {
    if (!v.contentHash) {
      v.contentHash = computeContentHash(v.content);
    }
  }

  // 1. Run Layer 1: Partition Contacts -> Instances
  const { allocations, warnings } = allocateContactsToInstances({
    contacts,
    instances,
    strategy: allocationStrategy,
    blockSize,
    blockSizeMax,
    seed: allocationSeed,
    stickyConversations,
    previousInstanceMap,
  });

  // Map instances to their index for anti-correlation staggering
  const instanceIndexMap = new Map<string, number>();
  instances.forEach((inst, idx) => instanceIndexMap.set(inst.id, idx));

  const lanes: Record<string, TwoLayerAssignedRecipient[]> = {};
  const instanceStats: TwoLayerAssignmentResult['instanceStats'] = {};
  const variationTotals: Record<string, number> = {};

  for (const v of variants) {
    const key = v.id || v.label || `Message ${v.position}`;
    variationTotals[key] = 0;
  }

  for (const inst of instances) {
    lanes[inst.id] = [];
    instanceStats[inst.id] = {
      instanceId: inst.id,
      instanceName: inst.name,
      allocatedCount: 0,
      variantDistribution: {},
      estimatedDurationSec: 0,
      remainingCapacity: inst.capacity ?? Math.max(0, (inst.dailyQuota ?? 200) - (inst.todaySent ?? 0)),
    };
  }

  // 2. Run Layer 2: Assign variations within each instance
  const fullAssignments: TwoLayerAssignedRecipient[] = [];

  for (const item of allocations) {
    const instId = item.instanceId;
    const instIdx = instanceIndexMap.get(instId) ?? 0;
    const instanceSeq = item.instanceSeq;

    // Determine eligible variants for this instance
    let candidateVariants = activeVariants;
    if (perInstanceSubsets && perInstanceSubsets[instId] && perInstanceSubsets[instId]!.length > 0) {
      const allowedIds = new Set(perInstanceSubsets[instId]);
      const subset = activeVariants.filter((v) => allowedIds.has(v.id || '') || allowedIds.has(v.label));
      if (subset.length > 0) candidateVariants = subset;
    }

    let chosenVariant: VariantInput;
    let chosenIndex = 0;

    if (distributionMode === 'SINGLE' || candidateVariants.length === 1) {
      chosenVariant = candidateVariants[0]!;
      chosenIndex = variants.indexOf(chosenVariant);
    } else if (distributionMode === 'ROTATE') {
      // Rotation sequence
      let sequenceNum: number;
      if (rotationScope === 'INSTANCE') {
        // Stagger per-number offset: Instance 0 starts at 0, Instance 1 starts at 1, etc.
        const staggerOffset = staggerVariations ? instIdx % candidateVariants.length : 0;
        sequenceNum = (instanceSeq + staggerOffset) % candidateVariants.length;
      } else {
        // Global whole-campaign rotation
        sequenceNum = item.allocationIndex % candidateVariants.length;
      }

      chosenVariant = candidateVariants[sequenceNum]!;
      chosenIndex = variants.indexOf(chosenVariant);

      // Cross-campaign diversity protection: if recipient saw this hash recently from this instance, shift
      if (avoidRepeatContent && previousContentHashes) {
        const pastHashes =
          (item.contactId ? previousContentHashes.get(item.contactId) : undefined) ||
          previousContentHashes.get(item.phone);
        if (pastHashes && chosenVariant.contentHash && pastHashes.has(chosenVariant.contentHash)) {
          for (let step = 1; step < candidateVariants.length; step++) {
            const altIdx = (sequenceNum + step) % candidateVariants.length;
            const altCandidate = candidateVariants[altIdx]!;
            if (altCandidate.contentHash && !pastHashes.has(altCandidate.contentHash)) {
              chosenVariant = altCandidate;
              chosenIndex = variants.indexOf(altCandidate);
              break;
            }
          }
        }
      }
    } else if (distributionMode === 'RANDOM') {
      const seedKey = `${allocationSeed}_${instId}_${item.contactId || item.phone}`;
      const hashVal = hashString(seedKey);
      const rawIdx = hashVal % candidateVariants.length;
      chosenVariant = candidateVariants[rawIdx]!;
      chosenIndex = variants.indexOf(chosenVariant);
    } else if (distributionMode === 'WEIGHTED') {
      let totalWeight = 0;
      const weights = candidateVariants.map((v) => {
        const w = Math.max(1, v.weight ?? v.weightPercent ?? 100);
        totalWeight += w;
        return w;
      });
      let cumulative = 0;
      const boundaries = weights.map((w) => {
        cumulative += (w / totalWeight) * 10000;
        return cumulative;
      });
      const seedKey = `${allocationSeed}_w_${instId}_${item.contactId || item.phone}`;
      const hashVal = hashString(seedKey);
      const bucket = hashVal % 10000;
      let picked = 0;
      for (let b = 0; b < boundaries.length; b++) {
        if (bucket < boundaries[b]!) {
          picked = b;
          break;
        }
      }
      chosenVariant = candidateVariants[picked] || candidateVariants[0]!;
      chosenIndex = variants.indexOf(chosenVariant);
    } else {
      chosenVariant = candidateVariants[0]!;
      chosenIndex = 0;
    }

    const vKey = chosenVariant.id || chosenVariant.label || `Message ${chosenVariant.position || chosenIndex + 1}`;
    variationTotals[vKey] = (variationTotals[vKey] || 0) + 1;

    // Render lightweight preview with recipient replacement
    let renderedText = chosenVariant.content;
    const nameVal = item.name || 'Friend';
    renderedText = renderedText.replace(/\{name\|?[^}]*\}/gi, nameVal);

    const assignedRecipient: TwoLayerAssignedRecipient = {
      ...item,
      variantIndex: chosenIndex >= 0 ? chosenIndex : 0,
      variantPosition: chosenVariant.position || chosenIndex + 1,
      variantId: chosenVariant.id,
      variantLabel: chosenVariant.label || `Message ${chosenVariant.position || chosenIndex + 1}`,
      variantContent: chosenVariant.content,
      contentHash: chosenVariant.contentHash || computeContentHash(chosenVariant.content),
      renderedPreview: renderedText,
    };

    fullAssignments.push(assignedRecipient);
    if (!lanes[instId]) lanes[instId] = [];
    lanes[instId]!.push(assignedRecipient);

    // Update instance stats
    if (instanceStats[instId]) {
      instanceStats[instId]!.allocatedCount++;
      const currentCount = instanceStats[instId]!.variantDistribution[vKey] || 0;
      instanceStats[instId]!.variantDistribution[vKey] = currentCount + 1;
    }
  }

  // 3. Post-calculation of estimated durations & capacity warnings
  let maxParallelDuration = 0;
  for (const instId of Object.keys(instanceStats)) {
    const stats = instanceStats[instId]!;
    stats.estimatedDurationSec = stats.allocatedCount * pacingAvgDelaySec;
    if (stats.estimatedDurationSec > maxParallelDuration) {
      maxParallelDuration = stats.estimatedDurationSec;
    }
    if (stats.allocatedCount > stats.remainingCapacity) {
      stats.capacityWarning = `Allocated ${stats.allocatedCount} messages, which exceeds today's remaining cap of ${stats.remainingCapacity}.`;
      warnings.push(`Instance "${stats.instanceName}": ${stats.capacityWarning}`);
    }
  }

  // 4. Matrix heatmap (instances x variations)
  const matrixHeatmap = instances.map((inst) => {
    const counts: Record<string, number> = {};
    for (const v of variants) {
      const vKey = v.id || v.label || `Message ${v.position}`;
      counts[vKey] = instanceStats[inst.id]?.variantDistribution[vKey] || 0;
    }
    return {
      instanceName: inst.name,
      counts,
    };
  });

  // Duplicate similarity checks across provided variants
  const simWarnings = detectDuplicateVariants(variants, 0.85);
  for (const sw of simWarnings) {
    warnings.push(sw.warning);
  }

  return {
    allocations: fullAssignments,
    lanes,
    instanceStats,
    variationTotals,
    matrixHeatmap,
    warnings,
    maxParallelDurationSec: maxParallelDuration,
  };
}

// ----------------------------------------------------------------------
// 3. Failover / Mid-Campaign Reallocation
// ----------------------------------------------------------------------

export interface FailoverReallocateParams {
  pendingRecipients: TwoLayerAssignedRecipient[];
  failedInstanceId: string;
  healthyInstances: InstanceAllocationInput[];
  strategy?: AllocationStrategy;
}

export function reallocatePendingRecipients(
  params: FailoverReallocateParams
): TwoLayerAssignedRecipient[] {
  const { pendingRecipients, failedInstanceId, healthyInstances, strategy = 'BLOCKS' } = params;

  if (healthyInstances.length === 0) {
    throw new Error('Cannot failover: no healthy instances available to take over.');
  }

  const affected = pendingRecipients.filter((r) => r.instanceId === failedInstanceId);
  const unaffected = pendingRecipients.filter((r) => r.instanceId !== failedInstanceId);

  // Redistribute affected contacts among healthy instances
  const { allocations } = allocateContactsToInstances({
    contacts: affected,
    instances: healthyInstances,
    strategy,
  });

  const updatedAffected = affected.map((r, i) => {
    const newAlloc = allocations[i]!;
    return {
      ...r,
      instanceId: newAlloc.instanceId,
      instanceName: newAlloc.instanceName,
      instanceSeq: newAlloc.instanceSeq,
    };
  });

  return [...unaffected, ...updatedAffected];
}

// ----------------------------------------------------------------------
// 4. Validation Schema
// ----------------------------------------------------------------------

export const TwoLayerDistributionSchema = z.object({
  allocationStrategy: z
    .enum(['BLOCKS', 'ROUND_ROBIN', 'PROPORTIONAL', 'WEIGHTED', 'FILL_THEN_SPILL'])
    .default('BLOCKS'),
  blockSize: z.number().int().min(1).max(500).default(5),
  blockSizeMax: z.number().int().min(1).max(500).nullable().optional(),
  staggerVariations: z.boolean().default(true),
  failoverEnabled: z.boolean().default(true),
  stickyConversations: z.boolean().default(true),
  allocationSeed: z.number().int().default(42),
});
