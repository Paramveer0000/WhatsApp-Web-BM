import { describe, it, expect } from 'vitest';
import {
  allocateContactsToInstances,
  assignTwoLayerDistribution,
  reallocatePendingRecipients,
  MAX_VARIANTS,
} from '../src/lib/distribution';
import { VariantInput, RecipientInput } from '../src/lib/rotation';

describe('Two-Layer Distribution Engine (Contacts -> Instances -> Message Variations)', () => {
  const instances = [
    { id: 'inst_a', name: 'Instance A', capacity: 100, dailyQuota: 200, todaySent: 100 },
    { id: 'inst_b', name: 'Instance B', capacity: 100, dailyQuota: 200, todaySent: 100 },
  ];

  const variants5: VariantInput[] = [
    { position: 1, label: 'M1', content: 'Hello {name}, this is M1.' },
    { position: 2, label: 'M2', content: 'Greetings {name}, this is M2.' },
    { position: 3, label: 'M3', content: 'Hey {name}, this is M3.' },
    { position: 4, label: 'M4', content: 'Hi {name}, this is M4.' },
    { position: 5, label: 'M5', content: 'Good day {name}, this is M5.' },
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
  // Specification Section 1 & 10: Worked Example
  // -------------------------------------------------------------
  it('implements the exact worked example from specification (10 contacts, A/B, M1-M5, blockSize 5)', () => {
    const audience = generateAudience(10);

    const result = assignTwoLayerDistribution({
      contacts: audience,
      instances,
      variants: variants5,
      allocationStrategy: 'BLOCKS',
      blockSize: 5,
      distributionMode: 'ROTATE',
      rotationScope: 'INSTANCE',
      staggerVariations: false, // without stagger to test direct M1..M5
    });

    expect(result.allocations.length).toBe(10);

    // Layer 1: Contacts 1-5 -> Instance A; Contacts 6-10 -> Instance B
    const instA = result.allocations.filter((a) => a.instanceId === 'inst_a');
    const instB = result.allocations.filter((a) => a.instanceId === 'inst_b');

    expect(instA.length).toBe(5);
    expect(instB.length).toBe(5);

    expect(instA.map((a) => a.id)).toEqual(['rec_1', 'rec_2', 'rec_3', 'rec_4', 'rec_5']);
    expect(instB.map((a) => a.id)).toEqual(['rec_6', 'rec_7', 'rec_8', 'rec_9', 'rec_10']);

    // Layer 2: Each instance independently cycles M1..M5
    expect(instA.map((a) => a.variantLabel)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
    expect(instB.map((a) => a.variantLabel)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
  });

  it('correctly staggers variation offset between numbers (Instance A starts M1, Instance B starts M2)', () => {
    const audience = generateAudience(10);

    const result = assignTwoLayerDistribution({
      contacts: audience,
      instances,
      variants: variants5,
      allocationStrategy: 'BLOCKS',
      blockSize: 5,
      distributionMode: 'ROTATE',
      rotationScope: 'INSTANCE',
      staggerVariations: true, // anti-correlation enabled
    });

    const instA = result.allocations.filter((a) => a.instanceId === 'inst_a');
    const instB = result.allocations.filter((a) => a.instanceId === 'inst_b');

    // Instance A (index 0) starts at M1
    expect(instA.map((a) => a.variantLabel)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
    // Instance B (index 1) starts at M2, wrapping to M1 at the end
    expect(instB.map((a) => a.variantLabel)).toEqual(['M2', 'M3', 'M4', 'M5', 'M1']);
  });

  it('handles uneven remainders deterministically (12 contacts, 2 instances, blockSize 5)', () => {
    const audience = generateAudience(12);

    const result = assignTwoLayerDistribution({
      contacts: audience,
      instances,
      variants: variants5,
      allocationStrategy: 'BLOCKS',
      blockSize: 5,
    });

    const instA = result.allocations.filter((a) => a.instanceId === 'inst_a');
    const instB = result.allocations.filter((a) => a.instanceId === 'inst_b');

    // A gets 1-5, B gets 6-10, A gets 11-12
    expect(instA.length).toBe(7);
    expect(instB.length).toBe(5);

    expect(instA.map((a) => a.id)).toEqual(['rec_1', 'rec_2', 'rec_3', 'rec_4', 'rec_5', 'rec_11', 'rec_12']);
    expect(instB.map((a) => a.id)).toEqual(['rec_6', 'rec_7', 'rec_8', 'rec_9', 'rec_10']);
  });

  it('allocates 1-by-1 in Round-robin strategy', () => {
    const audience = generateAudience(6);

    const { allocations } = allocateContactsToInstances({
      contacts: audience,
      instances,
      strategy: 'ROUND_ROBIN',
    });

    expect(allocations.map((a) => a.instanceId)).toEqual([
      'inst_a',
      'inst_b',
      'inst_a',
      'inst_b',
      'inst_a',
      'inst_b',
    ]);
  });

  it('respects sticky conversations for contacts with previous chat history', () => {
    const audience = generateAudience(6);
    // Contact 3 previously chatted with inst_b
    const previousMap = new Map<string, string>([
      [audience[2]!.phone, 'inst_b'],
    ]);

    const { allocations } = allocateContactsToInstances({
      contacts: audience,
      instances,
      strategy: 'BLOCKS',
      blockSize: 2,
      stickyConversations: true,
      previousInstanceMap: previousMap,
    });

    // Contact 3 must be assigned to inst_b
    const contact3 = allocations.find((a) => a.phone === audience[2]!.phone);
    expect(contact3?.instanceId).toBe('inst_b');
  });

  it('redistributes pending recipients on failover without duplicates', () => {
    const audience = generateAudience(10);
    const result = assignTwoLayerDistribution({
      contacts: audience,
      instances,
      variants: variants5,
      blockSize: 5,
    });

    // Instance B drops mid-campaign
    const healthy = [{ id: 'inst_a', name: 'Instance A' }];
    const reallocated = reallocatePendingRecipients({
      pendingRecipients: result.allocations,
      failedInstanceId: 'inst_b',
      healthyInstances: healthy,
    });

    expect(reallocated.length).toBe(10);
    // All recipients should now belong to inst_a
    expect(reallocated.every((r) => r.instanceId === 'inst_a')).toBe(true);
  });

  it('produces horizontal lanes and summary statistics matching specification', () => {
    const audience = generateAudience(10);
    const result = assignTwoLayerDistribution({
      contacts: audience,
      instances,
      variants: variants5,
      blockSize: 5,
    });

    expect(Object.keys(result.lanes)).toEqual(['inst_a', 'inst_b']);
    expect(result.lanes['inst_a']?.length).toBe(5);
    expect(result.lanes['inst_b']?.length).toBe(5);

    expect(result.matrixHeatmap.length).toBe(2);
    expect(MAX_VARIANTS).toBe(20);
  });
});
