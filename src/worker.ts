import { db } from './lib/db';
import { campaignRunner } from './lib/queue/campaign-runner';
import { logger } from './lib/logger';

console.log('=== WhatsApp Campaign Background Worker Started ===');
logger.info('Background worker polling loop initialized.');

let isChecking = false;

async function checkAndRunScheduledCampaigns() {
  if (isChecking) return;
  isChecking = true;

  try {
    const now = new Date();

    // Look for running campaigns that might have been interrupted by restart, or scheduled campaigns ready to run
    const activeOrScheduled = await db.campaign.findMany({
      where: {
        OR: [
          { status: 'RUNNING' },
          {
            status: 'SCHEDULED',
            scheduledAt: { lte: now },
          },
        ],
      },
    });

    for (const camp of activeOrScheduled) {
      if (!campaignRunner.isCampaignActive(camp.id)) {
        logger.info({ campaignId: camp.id, name: camp.name }, 'Worker picking up campaign');
        // Run in background without blocking polling loop
        campaignRunner.runCampaign(camp.id).catch((err) => {
          logger.error({ err, campaignId: camp.id }, 'Error running campaign from worker');
        });
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message }, 'Worker poll check error');
  } finally {
    isChecking = false;
  }
}

// Poll every 5 seconds
setInterval(checkAndRunScheduledCampaigns, 5000);
checkAndRunScheduledCampaigns();

