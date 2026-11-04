import { z } from 'zod';

export type DistributionMode = 'SINGLE' | 'ROTATE' | 'RANDOM' | 'WEIGHTED';
export type RotationScope = 'CAMPAIGN' | 'INSTANCE' | 'LIST';

export interface VariantInput {
  id?: string;
  position: number; // 1-based order
  label: string;
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  caption?: string | null;
  weight?: number | null; // Used in WEIGHTED mode (percentage or proportion)
  weightPercent?: number | null;
  contentHash?: string | null;
  similarityWarnings?: string | null;
  isPaused?: boolean;
}

export interface RecipientInput {
  id: string;
  contactId?: string | null;
  phone: string;
  name?: string | null;
  instanceId?: string | null;
  listId?: string | null;
  customVariables?: any;
}

export interface AssignedRecipient extends RecipientInput {
  variantIndex: number; // 0-based index in the variant array
  variantPosition: number; // 1-based position
  variantId?: string;
  variantLabel: string;
  rotationIndex: number; // 1-based global sequence number
  contentHash: string;
}

export interface RotationAssignmentResult {
  assignments: AssignedRecipient[];
  variantCounts: Record<string, number>; // variantId/label -> recipient count
  warnings: string[];
}

export interface SimilarityResult {
  pair: [number, number]; // [indexA, indexB] (0-based)
  positions: [number, number]; // [posA, posB] (1-based)
  labels: [string, string];
  similarity: number; // 0.0 - 1.0
  warning: string;
}

// -------------------------------------------------------------
// 1. Content Hashing & Tokenization (Isomorphic)
// -------------------------------------------------------------

/**
 * Normalizes text and computes a deterministic content hash.
 * Isomorphic: works seamlessly in both Node.js and browser runtimes.
 */
export function computeContentHash(text: string): string {
  if (!text) return '';
  const normalized = text
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995);
  }
  const hex1 = ('00000000' + (h1 >>> 0).toString(16)).slice(-8);
  const hex2 = ('00000000' + (h2 >>> 0).toString(16)).slice(-8);
  return `${hex1}${hex2}`;
}

/**
 * Tokenizes text into lowercase alphanumeric words for similarity analysis.
 */
export function tokenizeText(text: string): Set<string> {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return new Set(words);
}

/**
 * Calculates normalized Jaccard Similarity (0.0 to 1.0) between two message texts.
 * Jaccard = |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const normA = (textA || '').trim();
  const normB = (textB || '').trim();

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA.toLowerCase() === normB.toLowerCase()) return 1.0;

  const setA = tokenizeText(normA);
  const setB = tokenizeText(normB);

  if (setA.size === 0 && setB.size === 0) {
    return normA.toLowerCase() === normB.toLowerCase() ? 1.0 : 0.0;
  }

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionCount;
  if (unionSize === 0) return 0.0;

  return Math.round((intersectionCount / unionSize) * 1000) / 1000;
}

/**
 * Detects pairs of message variants with similarity >= threshold (default 85%).
 */
export function detectDuplicateVariants(
  variants: VariantInput[],
  threshold = 0.85
): SimilarityResult[] {
  const results: SimilarityResult[] = [];
  if (!variants || variants.length < 2) return results;

  for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const vA = variants[i]!;
      const vB = variants[j]!;
      const sim = calculateJaccardSimilarity(vA.content, vB.content);

      if (sim >= threshold) {
        const pct = Math.round(sim * 100);
        results.push({
          pair: [i, j],
          positions: [vA.position || i + 1, vB.position || j + 1],
          labels: [vA.label || `Message ${i + 1}`, vB.label || `Message ${j + 1}`],
          similarity: sim,
          warning: `"${vA.label || `Message ${i + 1}`}" and "${vB.label || `Message ${j + 1}`}" are ${pct}% similar (${threshold * 100}% threshold). Varying message wording improves anti-ban protection.`,
        });
      }
    }
  }

  return results;
}

// -------------------------------------------------------------
// 2. Deterministic Hashing & PRNG
// -------------------------------------------------------------

/**
 * Deterministic 32-bit integer hash (Murmur3-like) from string.
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0); // Unsigned 32-bit integer
}

/**
 * Mulberry32 PRNG generator for deterministic pseudo-random sequences.
 */
export function createMulberry32PRNG(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic array shuffle using Fisher-Yates with a seeded PRNG.
 */
export function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const rng = createMulberry32PRNG(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

// -------------------------------------------------------------
// 3. Core Assignment Engine (Deterministic & Crash-Safe)
// -------------------------------------------------------------

export interface AssignMessageRotationParams {
  audience: RecipientInput[];
  variants: VariantInput[];
  distributionMode: DistributionMode;
  rotationScope?: RotationScope;
  shuffleAudience?: boolean;
  shuffleSeed?: number;
  campaignId: string;
  previousContentHashes?: Map<string, Set<string>>; // phone/contactId -> Set of content hashes sent in last 30d
  avoidRepeatContent?: boolean;
  previousCampaignMessageOffset?: number; // e.g. for follow-up shift
}

/**
 * Assigns each recipient to a message variant deterministically at enqueue time.
 * Enforces strict round-robin sequence (1,2,3,4,1,2,3,4...), deterministic random, or weighted split.
 */
export function assignMessageRotation(
  params: AssignMessageRotationParams
): RotationAssignmentResult {
  const {
    audience,
    variants,
    distributionMode = 'SINGLE',
    rotationScope = 'CAMPAIGN',
    shuffleAudience = false,
    shuffleSeed,
    campaignId,
    previousContentHashes,
    avoidRepeatContent = true,
    previousCampaignMessageOffset = 0,
  } = params;

  const warnings: string[] = [];
  const variantCounts: Record<string, number> = {};

  if (!variants || variants.length === 0) {
    throw new Error('At least one message variant is required for rotation assignment.');
  }

  // Active variants (exclude paused ones unless all are paused)
  let activeVariants = variants.filter((v) => !v.isPaused);
  if (activeVariants.length === 0) {
    warnings.push('All message variants are paused. Using all variants as fallback.');
    activeVariants = [...variants];
  }

  // Ensure contentHash is computed
  for (const v of variants) {
    if (!v.contentHash) {
      v.contentHash = computeContentHash(v.content);
    }
  }

  // Initialize counts
  for (const v of variants) {
    const key = v.id || v.label || `Message ${v.position}`;
    variantCounts[key] = 0;
  }

  if (!audience || audience.length === 0) {
    return { assignments: [], variantCounts, warnings };
  }

  // Audience ordering: apply deterministic shuffle if enabled
  let orderedAudience = [...audience];
  if (shuffleAudience && typeof shuffleSeed === 'number') {
    orderedAudience = deterministicShuffle(orderedAudience, shuffleSeed);
  }

  const assignments: AssignedRecipient[] = [];

  // Helper to assign a single item given its index in the sequence
  const assignSingleRecipient = (
    recipient: RecipientInput,
    sequenceIndex: number
  ): AssignedRecipient => {
    let chosenVariant: VariantInput;
    let chosenIndex = 0;

    if (distributionMode === 'SINGLE' || activeVariants.length === 1) {
      chosenVariant = activeVariants[0]!;
      chosenIndex = variants.indexOf(chosenVariant);
    } else if (distributionMode === 'ROTATE') {
      // Strict sequence: 0, 1, 2, ..., N-1, 0, 1...
      const rawIndex = (sequenceIndex + previousCampaignMessageOffset) % activeVariants.length;
      chosenVariant = activeVariants[rawIndex]!;
      chosenIndex = variants.indexOf(chosenVariant);

      // Cross-campaign diversity check
      if (avoidRepeatContent && previousContentHashes) {
        const pastHashes =
          (recipient.contactId ? previousContentHashes.get(recipient.contactId) : undefined) ||
          (recipient.phone ? previousContentHashes.get(recipient.phone) : undefined);
        if (pastHashes && chosenVariant.contentHash && pastHashes.has(chosenVariant.contentHash)) {
          // Attempt to find another variant in active cycle that wasn't used recently
          for (let step = 1; step < activeVariants.length; step++) {
            const altIndex = (rawIndex + step) % activeVariants.length;
            const candidate = activeVariants[altIndex]!;
            if (candidate.contentHash && !pastHashes.has(candidate.contentHash)) {
              chosenVariant = candidate;
              chosenIndex = variants.indexOf(candidate);
              break;
            }
          }
        }
      }
    } else if (distributionMode === 'RANDOM') {
      // Deterministic pseudo-random pick by hashing (campaignId + contact identifier)
      const seedKey = `${campaignId}_${recipient.contactId || recipient.phone}`;
      const hashVal = hashString(seedKey);
      const rawIndex = hashVal % activeVariants.length;
      chosenVariant = activeVariants[rawIndex]!;
      chosenIndex = variants.indexOf(chosenVariant);
    } else if (distributionMode === 'WEIGHTED') {
      // Deterministic bucket by hash mod 10000 mapped to cumulative weights
      let totalWeight = 0;
      const weightList = activeVariants.map((v) => {
        const w = Math.max(1, v.weight ?? v.weightPercent ?? 100);
        totalWeight += w;
        return w;
      });

      // Cumulative boundaries scaled to 10000
      let cumulative = 0;
      const boundaries = weightList.map((w) => {
        cumulative += (w / totalWeight) * 10000;
        return cumulative;
      });

      const seedKey = `${campaignId}_${recipient.contactId || recipient.phone}`;
      const hashVal = hashString(seedKey);
      const bucket = hashVal % 10000;

      let picked = 0;
      for (let b = 0; b < boundaries.length; b++) {
        if (bucket < boundaries[b]!) {
          picked = b;
          break;
        }
      }
      chosenVariant = activeVariants[picked] || activeVariants[0]!;
      chosenIndex = variants.indexOf(chosenVariant);
    } else {
      chosenVariant = activeVariants[0]!;
      chosenIndex = 0;
    }

    const rotationIndex = sequenceIndex + 1; // 1-based sequence
    const countKey = chosenVariant.id || chosenVariant.label || `Message ${chosenVariant.position}`;
    variantCounts[countKey] = (variantCounts[countKey] || 0) + 1;

    return {
      ...recipient,
      variantIndex: chosenIndex >= 0 ? chosenIndex : 0,
      variantPosition: chosenVariant.position || chosenIndex + 1,
      variantId: chosenVariant.id,
      variantLabel: chosenVariant.label || `Message ${chosenVariant.position || chosenIndex + 1}`,
      rotationIndex,
      contentHash: chosenVariant.contentHash || computeContentHash(chosenVariant.content),
    };
  };

  // Rotation Scope Handling
  if (rotationScope === 'INSTANCE') {
    // Group by instanceId and cycle independently per instance
    const instanceGroups = new Map<string, RecipientInput[]>();
    for (const r of orderedAudience) {
      const instKey = r.instanceId || 'default';
      const grp = instanceGroups.get(instKey) || [];
      grp.push(r);
      instanceGroups.set(instKey, grp);
    }

    for (const [, group] of instanceGroups) {
      group.forEach((recipient, idx) => {
        assignments.push(assignSingleRecipient(recipient, idx));
      });
    }
  } else if (rotationScope === 'LIST') {
    // Group by listId and cycle independently per list
    const listGroups = new Map<string, RecipientInput[]>();
    for (const r of orderedAudience) {
      const listKey = r.listId || 'default';
      const grp = listGroups.get(listKey) || [];
      grp.push(r);
      listGroups.set(listKey, grp);
    }

    for (const [, group] of listGroups) {
      group.forEach((recipient, idx) => {
        assignments.push(assignSingleRecipient(recipient, idx));
      });
    }
  } else {
    // Default: Across whole campaign
    orderedAudience.forEach((recipient, idx) => {
      assignments.push(assignSingleRecipient(recipient, idx));
    });
  }

  // Duplicate similarity checks across provided variants
  const simWarnings = detectDuplicateVariants(variants, 0.85);
  for (const sw of simWarnings) {
    warnings.push(sw.warning);
  }

  return { assignments, variantCounts, warnings };
}

// -------------------------------------------------------------
// 4. Mid-Campaign Redistribution (Pause / Delete Message)
// -------------------------------------------------------------

export interface RedistributeParams {
  remainingRecipients: { id: string; phone?: string; variantId?: string | null; rotationIndex?: number | null }[];
  activeVariants: VariantInput[];
  distributionMode: DistributionMode;
  campaignId: string;
}

/**
 * Redistributes remaining un-sent (PENDING/QUEUED) recipients across remaining active variants.
 */
export function redistributeRemainingRecipients(
  params: RedistributeParams
): { id: string; variantId?: string; variantIndex: number; variantPosition: number; variantLabel: string }[] {
  const { remainingRecipients, activeVariants, distributionMode, campaignId } = params;

  if (!activeVariants || activeVariants.length === 0) {
    throw new Error('Cannot redistribute: no active variants available.');
  }

  return remainingRecipients.map((r, idx) => {
    let chosenVariant: VariantInput;
    let chosenIdx = 0;

    if (distributionMode === 'ROTATE') {
      chosenIdx = idx % activeVariants.length;
      chosenVariant = activeVariants[chosenIdx]!;
    } else if (distributionMode === 'RANDOM' || distributionMode === 'WEIGHTED') {
      const seedKey = `${campaignId}_redist_${r.phone || r.id}`;
      const hashVal = hashString(seedKey);
      chosenIdx = hashVal % activeVariants.length;
      chosenVariant = activeVariants[chosenIdx]!;
    } else {
      chosenIdx = 0;
      chosenVariant = activeVariants[0]!;
    }

    return {
      id: r.id,
      variantId: chosenVariant.id,
      variantIndex: chosenIdx,
      variantPosition: chosenVariant.position || chosenIdx + 1,
      variantLabel: chosenVariant.label || `Message ${chosenVariant.position || chosenIdx + 1}`,
    };
  });
}

// -------------------------------------------------------------
// 5. Zod Schema Validation
// -------------------------------------------------------------

export const VariantInputSchema = z.object({
  id: z.string().optional(),
  position: z.number().int().min(1).max(8),
  label: z.string().min(1).max(50),
  content: z.string().min(1, 'Message text is required'),
  mediaType: z.string().nullable().optional(),
  mediaUrl: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  weight: z.number().int().min(1).max(100).nullable().optional(),
  weightPercent: z.number().int().min(1).max(100).nullable().optional(),
  isPaused: z.boolean().optional(),
});

export const CampaignRotationSchema = z
  .object({
    distributionMode: z.enum(['SINGLE', 'ROTATE', 'RANDOM', 'WEIGHTED']).default('SINGLE'),
    rotationScope: z.enum(['CAMPAIGN', 'INSTANCE', 'LIST']).default('CAMPAIGN'),
    shuffleAudience: z.boolean().default(false),
    shuffleSeed: z.number().int().nullable().optional(),
    avoidRepeatContent: z.boolean().default(true),
    variants: z.array(VariantInputSchema).min(1, 'At least 1 message variant is required'),
  })
  .refine(
    (data) => {
      if (data.distributionMode !== 'SINGLE') {
        return data.variants.length >= 2 && data.variants.length <= 8;
      }
      return data.variants.length >= 1;
    },
    {
      message: 'Multi-message distribution modes (Rotate, Random, Weighted) require between 2 and 8 message variants.',
      path: ['variants'],
    }
  )
  .refine(
    (data) => {
      if (data.distributionMode === 'WEIGHTED') {
        const sum = data.variants.reduce((acc, v) => acc + (v.weight ?? v.weightPercent ?? 0), 0);
        return sum === 100;
      }
      return true;
    },
    {
      message: 'In Weighted mode, variant weights must sum to exactly 100%.',
      path: ['variants'],
    }
  );
