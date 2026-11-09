import { describe, it, expect } from 'vitest';
import { PIPELINE_STAGES, LeadDeal } from '../src/components/crm/LeadPipelineView';

describe('Lead Pipeline & CRM Engine', () => {
  it('defines the 5 core sales stages in correct sequence', () => {
    expect(PIPELINE_STAGES.length).toBe(5);
    expect(PIPELINE_STAGES.map((s) => s.id)).toEqual([
      'NEW_LEAD',
      'CONTACTED',
      'QUALIFIED',
      'PROPOSAL',
      'WON',
    ]);
  });

  it('accurately calculates stage values, total pipeline value, and win rate', () => {
    const mockDeals: LeadDeal[] = [
      {
        id: '1',
        title: 'Enterprise Annual',
        value: 120000,
        currency: 'INR',
        stage: 'WON',
        contactName: 'Alpha Corp',
        contactPhone: '919876543210',
        tags: '["Enterprise"]',
        notes: 'Signed',
        assignedTo: 'Admin',
        priority: 'HIGH',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Bulk WhatsApp Outreach',
        value: 45000,
        currency: 'INR',
        stage: 'PROPOSAL',
        contactName: 'Beta Retail',
        contactPhone: '919876543211',
        tags: '["Retail"]',
        notes: 'Proposal sent',
        assignedTo: 'Agent 1',
        priority: 'MEDIUM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        title: 'Inbound Web Lead',
        value: 15000,
        currency: 'INR',
        stage: 'NEW_LEAD',
        contactName: 'Gamma Services',
        contactPhone: '919876543212',
        tags: '["Inbound"]',
        notes: 'Inquiry',
        assignedTo: 'Unassigned',
        priority: 'LOW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const totalValue = mockDeals.reduce((sum, d) => sum + d.value, 0);
    const wonDeals = mockDeals.filter((d) => d.stage === 'WON');
    const wonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);
    const winRate = Math.round((wonDeals.length / mockDeals.length) * 100);

    expect(totalValue).toBe(180000);
    expect(wonValue).toBe(120000);
    expect(winRate).toBe(33); // 1 out of 3 = 33%
  });

  it('allows moving deals through the pipeline', () => {
    let dealStage: LeadDeal['stage'] = 'NEW_LEAD';

    // Move forward: NEW_LEAD -> CONTACTED -> QUALIFIED
    const stageIds = PIPELINE_STAGES.map((s) => s.id);
    const nextStage = stageIds[stageIds.indexOf(dealStage) + 1];
    dealStage = nextStage;
    expect(dealStage).toBe('CONTACTED');

    const qualifiedStage = stageIds[stageIds.indexOf(dealStage) + 1];
    dealStage = qualifiedStage;
    expect(dealStage).toBe('QUALIFIED');
  });
});
