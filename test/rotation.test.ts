import { describe, it, expect } from 'vitest';
import {
  computeContentHash,
  calculateJaccardSimilarity,
  detectDuplicateVariants,
  deterministicShuffle,
  hashString,
  assignMessageRotation,
  redistributeRemainingRecipients,
  CampaignRotationSchema,
  VariantInput,
  RecipientInput
} from '../src/lib/rotation';

describe('Message Rotation & Multi-Message Campaigns', () => {
  const sampleVariants: VariantInput[] = [
    { position: 1, label: 'Message 1', content: 'Hello! Check out our new products today.' },
    { position: 2, label: 'Message 2', content: 'Hey there! We have exciting special offers for you.' },
    { position: 3, label: 'Message 3', content: 'Greetings! Don’t miss our latest exclusive catalogue.' },
    { position: 4, label: 'Message 4', content: 'Hi! Quick update on your exclusive member discounts.' },
  ];

  const generateAudience = (count: number): RecipientInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `rec_${i + 1}`,
      contactId: `cnt_${i + 1}`,
      phone: `9198000000${String(i + 1).padStart(2, '0')}`,
      name: `User ${i + 1}`,
    }));
  };

  // -------------------------------------------------------------
  // 1. Content Hash & Similarity Detector
  // -------------------------------------------------------------
  describe('Content Hash & Similarity Detector', () => {
    it('computes deterministic normalized content hash', () => {
      const hash1 = computeContentHash('Hello  World! \n');
      const hash2 = computeContentHash('hello world!');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThanOrEqual(16);
    });

    it('calculates Jaccard similarity between texts correctly', () => {
      const identical = calculateJaccardSimilarity('Hello world how are you', 'Hello world how are you');
      expect(identical).toBe(1.0);

      const disjoint = calculateJaccardSimilarity('Apple banana orange', 'Car airplane motorcycle');
      expect(disjoint).toBe(0.0);

      const similar = calculateJaccardSimilarity(
        'Special offer for our loyal customers today only',
        'Special offer for our valued customers today only'
      );
      expect(similar).toBeGreaterThan(0.7);
    });

    it('detects duplicate variants with >85% similarity', () => {
      const variants: VariantInput[] = [
        { position: 1, label: 'Variant A', content: 'Exclusive VIP offer: buy one get one free at our store.' },
        { position: 2, label: 'Variant B', content: 'Exclusive VIP offer: buy one get one free at our store today.' }, // near identical
        { position: 3, label: 'Variant C', content: 'Completely different announcement regarding new store hours.' },
      ];

      const duplicates = detectDuplicateVariants(variants, 0.85);
      expect(duplicates.length).toBe(1);
      expect(duplicates[0]!.labels).toEqual(['Variant A', 'Variant B']);
      expect(duplicates[0]!.similarity).toBeGreaterThanOrEqual(0.85);
    });
  });

  // -------------------------------------------------------------
  // 2. Strict Round-Robin Sequence (1, 2, 3, 4, 1...)
  // -------------------------------------------------------------
  describe('Strict Round-Robin Rotation', () => {
    it('assigns recipients in strict 1, 2, 3, 4, 1, 2... sequence', () => {
      const audience = generateAudience(10);
      const res = assignMessageRotation({
        audience,
        variants: sampleVariants,
        distributionMode: 'ROTATE',
        campaignId: 'camp_test_1',
      });

      expect(res.assignments.length).toBe(10);
      const positions = res.assignments.map((a) => a.variantPosition);
      expect(positions).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2]);

      const rotationIndices = res.assignments.map((a) => a.rotationIndex);
      expect(rotationIndices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('distributes remainders evenly across variants', () => {
      // 10 recipients over 4 variants => 3, 3, 2, 2
      const audience = generateAudience(10);
      const res = assignMessageRotation({
        audience,
        variants: sampleVariants,
        distributionMode: 'ROTATE',
        campaignId: 'camp_test_remainders',
      });

      const counts = [
        res.assignments.filter((a) => a.variantPosition === 1).length,
        res.assignments.filter((a) => a.variantPosition === 2).length,
        res.assignments.filter((a) => a.variantPosition === 3).length,
        res.assignments.filter((a) => a.variantPosition === 4).length,
      ];

      expect(counts).toEqual([3, 3, 2, 2]);
    });

    it('respects follow-up campaign message offset', () => {
      const audience = generateAudience(4);
      const res = assignMessageRotation({
        audience,
        variants: sampleVariants,
        distributionMode: 'ROTATE',
        campaignId: 'camp_test_offset',
        previousCampaignMessageOffset: 1, // shift by 1
      });

      const positions = res.assignments.map((a) => a.variantPosition);
      expect(positions).toEqual([2, 3, 4, 1]);
    });
  });

  // -------------------------------------------------------------
  // 3. Shuffle Determinism & Seed
  // -------------------------------------------------------------
  describe('Shuffle Determinism', () => {
    it('produces identical shuffle orders with the same seed', () => {
      const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const shuffle1 = deterministicShuffle(items, 42);
      const shuffle2 = deterministicShuffle(items, 42);
      const shuffle3 = deterministicShuffle(items, 999);

      expect(shuffle1).toEqual(shuffle2);
      expect(shuffle1).not.toEqual(items); // Shuffled
      expect(shuffle1).not.toEqual(shuffle3); // Different seed
    });
  });

  // -------------------------------------------------------------
  // 4. Weighted Split Mode
  // -------------------------------------------------------------
  describe('Weighted Split Mode', () => {
    it('assigns messages in proportion to their weights deterministically', () => {
      const audience = generateAudience(1000);
      const weightedVariants: VariantInput[] = [
        { position: 1, label: 'Message A (70%)', content: 'Offer A', weight: 70 },
        { position: 2, label: 'Message B (30%)', content: 'Offer B', weight: 30 },
      ];

      const res1 = assignMessageRotation({
        audience,
        variants: weightedVariants,
        distributionMode: 'WEIGHTED',
        campaignId: 'camp_test_weighted',
      });

      const countA = res1.assignments.filter((a) => a.variantPosition === 1).length;
      const countB = res1.assignments.filter((a) => a.variantPosition === 2).length;

      // 70% ± 5% tolerance for 1,000 recipients
      expect(countA).toBeGreaterThanOrEqual(650);
      expect(countA).toBeLessThanOrEqual(750);
      expect(countA + countB).toBe(1000);

      // Re-running with same campaignId and audience gives exact identical assignment
      const res2 = assignMessageRotation({
        audience,
        variants: weightedVariants,
        distributionMode: 'WEIGHTED',
        campaignId: 'camp_test_weighted',
      });

      expect(res1.assignments.map((a) => a.variantPosition)).toEqual(
        res2.assignments.map((a) => a.variantPosition)
      );
    });
  });

  // -------------------------------------------------------------
  // 5. Per-Instance Rotation Scope
  // -------------------------------------------------------------
  describe('Per-Instance Scope', () => {
    it('runs independent 1,2,3,4 rotation cycles per sending instance', () => {
      const audience: RecipientInput[] = [
        { id: '1', phone: '111', instanceId: 'inst_A' },
        { id: '2', phone: '222', instanceId: 'inst_A' },
        { id: '3', phone: '333', instanceId: 'inst_A' },
        { id: '4', phone: '444', instanceId: 'inst_B' },
        { id: '5', phone: '555', instanceId: 'inst_B' },
      ];

      const res = assignMessageRotation({
        audience,
        variants: sampleVariants,
        distributionMode: 'ROTATE',
        rotationScope: 'INSTANCE',
        campaignId: 'camp_test_instances',
      });

      const instA = res.assignments.filter((a) => a.instanceId === 'inst_A');
      const instB = res.assignments.filter((a) => a.instanceId === 'inst_B');

      expect(instA.map((a) => a.variantPosition)).toEqual([1, 2, 3]);
      expect(instB.map((a) => a.variantPosition)).toEqual([1, 2]);
    });
  });

  // -------------------------------------------------------------
  // 6. Cross-Campaign Diversity Fallback
  // -------------------------------------------------------------
  describe('Cross-Campaign Content Diversity', () => {
    it('avoids repeating recently sent message content when alternative exists', () => {
      const audience = generateAudience(2);
      const hashMsg1 = computeContentHash(sampleVariants[0]!.content);

      // Recipient 1 previously received Message 1
      const previousHashes = new Map<string, Set<string>>();
      previousHashes.set(audience[0]!.phone, new Set([hashMsg1]));

      const res = assignMessageRotation({
        audience,
        variants: sampleVariants,
        distributionMode: 'ROTATE',
        campaignId: 'camp_test_diversity',
        previousContentHashes: previousHashes,
        avoidRepeatContent: true,
      });

      // Recipient 1 would normally get Message 1, but shifts to Message 2 to avoid repeat!
      expect(res.assignments[0]!.variantPosition).toBe(2);
      // Recipient 2 receives Message 2 as normal
      expect(res.assignments[1]!.variantPosition).toBe(2);
    });
  });

  // -------------------------------------------------------------
  // 7. Mid-Campaign Redistribution (Pause / Delete)
  // -------------------------------------------------------------
  describe('Mid-Campaign Redistribution', () => {
    it('redistributes remaining un-sent recipients across active variants', () => {
      const remainingRecipients = [
        { id: 'r1', phone: '111', variantId: 'v3' },
        { id: 'r2', phone: '222', variantId: 'v3' },
        { id: 'r3', phone: '333', variantId: 'v3' },
      ];

      // Variant 3 was paused, remaining active: Variant 1, 2, 4
      const activeVariants: VariantInput[] = [
        sampleVariants[0]!,
        sampleVariants[1]!,
        sampleVariants[3]!,
      ];

      const redistributed = redistributeRemainingRecipients({
        remainingRecipients,
        activeVariants,
        distributionMode: 'ROTATE',
        campaignId: 'camp_redist_test',
      });

      expect(redistributed.length).toBe(3);
      expect(redistributed[0]!.variantPosition).toBe(1);
      expect(redistributed[1]!.variantPosition).toBe(2);
      expect(redistributed[2]!.variantPosition).toBe(4);
    });
  });

  // -------------------------------------------------------------
  // 8. Property & Validation Testing
  // -------------------------------------------------------------
  describe('Property & Validation Invariants', () => {
    it('guarantees every recipient gets exactly 1 message and counts differ by at most 1 in ROTATE', () => {
      const countsToTest = [1, 2, 3, 4, 7, 10, 33, 100, 255];
      for (const count of countsToTest) {
        const audience = generateAudience(count);
        const res = assignMessageRotation({
          audience,
          variants: sampleVariants,
          distributionMode: 'ROTATE',
          campaignId: `camp_prop_${count}`,
        });

        expect(res.assignments.length).toBe(count);

        const variantCounts = [1, 2, 3, 4].map(
          (pos) => res.assignments.filter((a) => a.variantPosition === pos).length
        );
        const max = Math.max(...variantCounts);
        const min = Math.min(...variantCounts);
        expect(max - min).toBeLessThanOrEqual(1);
      }
    });

    it('enforces Zod refinements: 2-8 variants for multi-modes, 100% weight sum', () => {
      // 1 variant in ROTATE mode fails
      const invalidSingleRotate = CampaignRotationSchema.safeParse({
        distributionMode: 'ROTATE',
        variants: [{ position: 1, label: 'M1', content: 'Test' }],
      });
      expect(invalidSingleRotate.success).toBe(false);

      // 2 variants in ROTATE mode succeeds
      const validRotate = CampaignRotationSchema.safeParse({
        distributionMode: 'ROTATE',
        variants: [
          { position: 1, label: 'M1', content: 'Test 1' },
          { position: 2, label: 'M2', content: 'Test 2' },
        ],
      });
      expect(validRotate.success).toBe(true);

      // WEIGHTED sum not 100% fails
      const invalidWeighted = CampaignRotationSchema.safeParse({
        distributionMode: 'WEIGHTED',
        variants: [
          { position: 1, label: 'M1', content: 'Test 1', weight: 40 },
          { position: 2, label: 'M2', content: 'Test 2', weight: 40 },
        ],
      });
      expect(invalidWeighted.success).toBe(false);

      // WEIGHTED sum 100% succeeds
      const validWeighted = CampaignRotationSchema.safeParse({
        distributionMode: 'WEIGHTED',
        variants: [
          { position: 1, label: 'M1', content: 'Test 1', weight: 50 },
          { position: 2, label: 'M2', content: 'Test 2', weight: 50 },
        ],
      });
      expect(validWeighted.success).toBe(true);
    });
  });
});
