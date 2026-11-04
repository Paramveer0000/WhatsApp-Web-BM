import { db, ensureDbSchema } from './lib/db';
import { campaignRunner } from './lib/queue/campaign-runner';
import { logger } from './lib/logger';

console.log('=== WhatsApp Campaign Background Worker v2 Started ===');
logger.info('Background worker polling loop and reconciler initialized.');

// Ensure SQLite schema columns exist, then run startup reconciliation
ensureDbSchema()
  .then(() => campaignRunner.reconcileStartup())
  .then(() => {
    logger.info('Startup reconciliation completed successfully.');
  })
  .catch((err) => {
    logger.error({ err: err.message }, 'Failed during startup reconciliation');
  });

let isChecking = false;

async function checkAndRunScheduledCampaigns() {
  if (isChecking) return;
  isChecking = true;

  try {
    await ensureDbSchema();
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
