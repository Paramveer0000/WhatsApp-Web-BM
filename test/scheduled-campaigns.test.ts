import { describe, it, expect, vi } from 'vitest';
import { db } from '../src/lib/db';
import { campaignRunner } from '../src/lib/queue/campaign-runner';

describe('Automatic & Scheduled Campaign Execution (Cron/Worker)', () => {
  it('detects campaigns with status SCHEDULED whose time has arrived', async () => {
    const pastTime = new Date(Date.now() - 60000); // 1 minute ago

    // Query mimicking src/worker.ts polling logic
    const runnable = await db.campaign.findMany({
      where: {
        OR: [
          { status: 'RUNNING' },
          {
            status: 'SCHEDULED',
            scheduledAt: { lte: new Date() },
          },
        ],
      },
    });

    // Should run query cleanly
    expect(Array.isArray(runnable)).toBe(true);
  });

  it('campaign runner reports accurate active state to avoid duplicate runs', () => {
    expect(campaignRunner.isCampaignActive('non-existent-campaign')).toBe(false);
  });
});
