import { DateTime } from 'luxon';
import { db } from '../db';
import { EvolutionClient, CircuitBreaker } from '../evolution';
import { renderMessage } from '../spintax';
import { eventBus } from './events';
import {
  calculateJitterDelay,
  isWithinSendingWindow,
  getEffectiveWarmupCap,
} from './pacing';
import { transitionMessage } from '../state-machine';
import { messagesCounter, sendDurationHistogram, queueDepthGauge } from '../metrics';
import { logger } from '../logger';

export class CampaignRunner {
  private activeCampaigns = new Set<string>();
  private cancelFlags = new Map<string, boolean>();
  private pauseFlags = new Map<string, boolean>();

  static instance = new CampaignRunner();

  isCampaignActive(id: string): boolean {
    return this.activeCampaigns.has(id);
  }

  requestPause(campaignId: string) {
    this.pauseFlags.set(campaignId, true);
  }

  requestAbort(campaignId: string) {
    this.cancelFlags.set(campaignId, true);
  }

  /**
   * Startup Reconciler (Section 14)
   * Resolves interrupted SENDING messages into UNCERTAIN on restart
   * Recovers scheduled and running campaigns
   */
  async reconcileStartup() {
    logger.info('Running startup campaign reconciler...');
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      // 1. Mark stale SENDING recipients as UNCERTAIN
      const staleSending = await db.campaignRecipient.updateMany({
        where: {
          status: 'SENDING',
          sendingAt: { lte: twoMinutesAgo },
        },
        data: {
          status: 'UNCERTAIN',
          lastError: 'Worker restarted while dispatch was in-flight (unverified downstream ACK)',
        },
      });

      if (staleSending.count > 0) {
        logger.warn(
          { count: staleSending.count },
          'Marked orphaned SENDING messages as UNCERTAIN to prevent duplicate sends'
        );
      }

      // 2. Re-register webhooks for all connected instances
      const connectedInstances = await db.instance.findMany({
        where: { status: 'OPEN' },
      });

      const client = await EvolutionClient.fromDatabase();
      const webhookBase = process.env.PUBLIC_BASE_URL || process.env.INTERNAL_BASE_URL || 'http://app:3000';
      const webhookSecret = process.env.WEBHOOK_SECRET || 'whsec-evolution';

      for (const inst of connectedInstances) {
        try {
          const webhookUrl = `${webhookBase}/api/webhooks/evolution/${encodeURIComponent(inst.name)}`;
          await client.setWebhook(inst.name, webhookUrl, webhookSecret);
          logger.info({ instance: inst.name }, 'Verified and refreshed instance webhook registration');
        } catch (whErr: any) {
          logger.warn({ instance: inst.name, err: whErr.message }, 'Failed to refresh webhook registration');
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Startup reconciler encountered error');
    }
  }

  async triggerCircuitBreaker(campaignId: string, reason: string) {
    logger.warn({ campaignId, reason }, 'Circuit breaker triggered');
    this.requestPause(campaignId);

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'PAUSED',
        haltReason: `Circuit Breaker: ${reason}`,
      },
    });

    eventBus.emitCircuitBreaker(campaignId, reason);
    eventBus.emitLog(campaignId, {
      type: 'danger',
      status: 'CIRCUIT_BREAKER',
      message: `Emergency Circuit Breaker Triggered: ${reason}. Campaign automatically halted.`,
    });
  }

  async runCampaign(campaignId: string) {
    if (this.activeCampaigns.has(campaignId)) {
      logger.info({ campaignId }, 'Campaign is already running');
      return;
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        instances: { include: { instance: true } },
        variants: true,
      },
    });

    if (!campaign || campaign.instances.length === 0) {
      logger.error({ campaignId }, 'Campaign not found or has no instances assigned');
      return;
    }

    this.activeCampaigns.add(campaignId);
    this.cancelFlags.set(campaignId, false);
    this.pauseFlags.set(campaignId, false);

    await db.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', startedAt: new Date(), haltReason: null },
    });

    eventBus.emitLog(campaignId, {
      type: 'info',
      status: 'STARTED',
      message: `Campaign "${campaign.name}" started with ${campaign.instances.length} instance(s)`,
    });

    try {
      const evolution = await EvolutionClient.fromDatabase();
      const availableInstances = campaign.instances.map((ci) => ci.instance);
      let instanceIndex = 0;
      let consecutiveFailures = 0;
      let messagesInCurrentBatch = 0;

      while (!this.cancelFlags.get(campaignId) && !this.pauseFlags.get(campaignId)) {
        // 1. Check Sending Window with Luxon
        const windowCheck = isWithinSendingWindow(
          campaign.sendWindowStart,
          campaign.sendWindowEnd,
          campaign.timezone
        );

        if (!windowCheck.isInsideWindow) {
          eventBus.emitLog(campaignId, {
            type: 'warning',
            status: 'SEND_WINDOW_SLEEP',
            message: `Current local time (${windowCheck.currentHourStr}) is outside allowed window (${campaign.sendWindowStart} - ${campaign.sendWindowEnd}). Sleeping until window opens...`,
          });
          const sleepMs = Math.min(windowCheck.msUntilWindowStart || 60000, 60000);
          await new Promise((r) => setTimeout(r, sleepMs));
          continue;
        }

        // 2. Fetch next PENDING/QUEUED recipient
        const recipient = await db.campaignRecipient.findFirst({
          where: { campaignId, status: { in: ['PENDING', 'QUEUED'] } },
          orderBy: { id: 'asc' },
        });

        if (!recipient) {
          // Check if any RETRY_WAIT or UNCERTAIN remain
          const pendingRemaining = await db.campaignRecipient.count({
            where: { campaignId, status: { in: ['PENDING', 'QUEUED', 'RETRY_WAIT'] } },
          });

          if (pendingRemaining === 0) {
            await db.campaign.update({
              where: { id: campaignId },
              data: { status: 'COMPLETED', completedAt: new Date() },
            });

            eventBus.emitLog(campaignId, {
              type: 'success',
              status: 'COMPLETED',
              message: `Campaign "${campaign.name}" completed successfully!`,
            });
            break;
          }

          // Wait 5s for retries
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        // 3. Instance Pool Selection & Circuit Filter
        const healthyInstances = availableInstances.filter(
          (inst) => CircuitBreaker.getState(inst.name) !== 'open'
        );

        if (healthyInstances.length === 0) {
          await this.triggerCircuitBreaker(campaignId, 'All assigned instances have open circuit breakers');
          break;
        }

        let activeInstance = healthyInstances[instanceIndex % healthyInstances.length]!;
        if (campaign.rotationMode === 'LEAST_USED') {
          const sorted = [...healthyInstances].sort((a, b) => a.sentToday - b.sentToday);
          activeInstance = sorted[0]!;
        }
        instanceIndex++;

        // 4. Daily Cap & Counter Check (local timezone)
        const localDate = DateTime.now().setZone(campaign.timezone).toFormat('yyyy-MM-dd');
        const effectiveCap = campaign.warmUpMode
          ? getEffectiveWarmupCap(activeInstance.warmUpDay, activeInstance.dailyCap)
          : activeInstance.dailyCap;

        const counter = await db.dailyInstanceCounter.upsert({
          where: { instanceId_localDate: { instanceId: activeInstance.id, localDate } },
          update: {},
          create: { instanceId: activeInstance.id, localDate, sent: 0 },
        });

        if (counter.sent >= effectiveCap) {
          eventBus.emitLog(campaignId, {
            type: 'warning',
            status: 'DAILY_CAP_REACHED',
            message: `Instance "${activeInstance.name}" reached daily cap (${counter.sent}/${effectiveCap}).`,
          });
          // Try other instances or wait
          if (healthyInstances.length <= 1) {
            await new Promise((r) => setTimeout(r, 60000));
          }
          continue;
        }

        // 5. Atomic State Transition: PENDING/QUEUED -> SENDING
        const transitionToSending = await transitionMessage(
          recipient.id,
          ['PENDING', 'QUEUED'],
          'SENDING',
          {
            instanceUsed: activeInstance.name,
            sendingAt: new Date(),
            attempts: recipient.attempts + 1,
          }
        );

        if (!transitionToSending.success) {
          // Another process grabbed it or status mutated
          continue;
        }

        // 6. Select Variant & Render Message
        const variant =
          campaign.variants.length > 0
            ? campaign.variants[recipient.variantIndex % campaign.variants.length]!
            : { content: 'Hello {{name}}', mediaType: 'text', mediaUrl: null, fileName: null, caption: null };

        const seedKey = `${campaignId}_${recipient.id}_${recipient.phone}`;
        const finalMessage = renderMessage(
          variant.content,
          {
            name: recipient.name,
            phone: recipient.phone,
            customVariables: recipient.customVariables,
          },
          { seedKey }
        );

        // 7. Human Presence Simulation
        if (campaign.simulateTyping) {
          try {
            await evolution.sendPresence(activeInstance.name, recipient.phone, 'composing', 1500);
            await new Promise((r) => setTimeout(r, 1200));
          } catch {}
        }

        // 8. Dispatch to Evolution API
        let sendSuccess = false;
        let errorMessage = '';
        let messageId = '';
        const startTime = Date.now();

        try {
          let dispatchRes: any;
          if (variant.mediaType && variant.mediaType !== 'text' && variant.mediaUrl) {
            dispatchRes = await evolution.sendMedia(activeInstance.name, recipient.phone, {
              mediaType: variant.mediaType as any,
              mimetype:
                variant.mediaType === 'image'
                  ? 'image/jpeg'
                  : variant.mediaType === 'video'
                  ? 'video/mp4'
                  : 'application/pdf',
              caption: variant.caption
                ? renderMessage(variant.caption, { name: recipient.name }, { seedKey })
                : finalMessage,
              media: variant.mediaUrl,
              fileName: variant.fileName || 'document',
            });
          } else {
            dispatchRes = await evolution.sendText(activeInstance.name, recipient.phone, finalMessage);
          }

          sendSuccess = true;
          messageId = dispatchRes?.key?.id || dispatchRes?.id || `MSG_${Date.now()}`;
          CircuitBreaker.recordSuccess(activeInstance.name);
          sendDurationHistogram.observe({ instance: activeInstance.name, result: 'success' }, (Date.now() - startTime) / 1000);
        } catch (err: any) {
          errorMessage = err.message || 'Dispatch error';
          CircuitBreaker.recordFailure(activeInstance.name, EvolutionClient.isCircuitBreakerError(err));
          sendDurationHistogram.observe({ instance: activeInstance.name, result: 'error' }, (Date.now() - startTime) / 1000);

          if (EvolutionClient.isCircuitBreakerError(err)) {
            await transitionMessage(recipient.id, 'SENDING', 'FAILED', { lastError: errorMessage });
            await this.triggerCircuitBreaker(campaignId, errorMessage);
            return;
          }
        }

        // 9. Post-Send State Machine Update
        if (sendSuccess) {
          consecutiveFailures = 0;
          await transitionMessage(recipient.id, 'SENDING', 'SENT', {
            evolutionMessageId: messageId,
            remoteJid: `${recipient.phone}@s.whatsapp.net`,
            renderedMessage: finalMessage,
            instanceUsed: activeInstance.name,
            sentAt: new Date(),
          });

          // Atomic increment on DailyInstanceCounter
          await db.dailyInstanceCounter.update({
            where: { instanceId_localDate: { instanceId: activeInstance.id, localDate } },
            data: { sent: { increment: 1 } },
          });

          await db.instance.update({
            where: { id: activeInstance.id },
            data: { sentToday: { increment: 1 } },
          });

          try {
            messagesCounter.inc({ status: 'SENT', instance: activeInstance.name });
          } catch {}

          eventBus.emitLog(campaignId, {
            type: 'success',
            status: 'SENT',
            message: `Message sent to ${recipient.phone} via "${activeInstance.name}"`,
            recipientId: recipient.id,
            phone: recipient.phone,
            messageId,
          });
        } else {
          consecutiveFailures++;
          try {
            messagesCounter.inc({ status: 'FAILED', instance: activeInstance.name });
          } catch {}

          if (recipient.attempts < recipient.maxAttempts) {
            await transitionMessage(recipient.id, 'SENDING', 'RETRY_WAIT', {
              lastError: errorMessage,
            });
          } else {
            await transitionMessage(recipient.id, 'SENDING', 'FAILED', {
              lastError: errorMessage,
              failedAt: new Date(),
            });
          }

          eventBus.emitLog(campaignId, {
            type: 'danger',
            status: 'FAILED',
            message: `Send failed to ${recipient.phone}: ${errorMessage}`,
            recipientId: recipient.id,
            phone: recipient.phone,
          });

          if (consecutiveFailures >= 5) {
            await this.triggerCircuitBreaker(
              campaignId,
              `5 consecutive failures on instance "${activeInstance.name}"`
            );
            return;
          }
        }

        // 10. Anti-Ban Pacing & Human Pause Jitter
        messagesInCurrentBatch++;
        if (messagesInCurrentBatch >= campaign.batchBreakSize) {
          messagesInCurrentBatch = 0;
          const breakSecs = campaign.batchBreakDuration * 60;
          eventBus.emitLog(campaignId, {
            type: 'info',
            status: 'BATCH_BREAK',
            message: `Batch break reached (${campaign.batchBreakSize} messages). Taking a ${campaign.batchBreakDuration} min cooldown...`,
          });
          await new Promise((r) => setTimeout(r, breakSecs * 1000));
        } else {
          const delaySecs = calculateJitterDelay(campaign.minDelay, campaign.maxDelay, true, 0.04);
          eventBus.emitJitter(campaignId, delaySecs, delaySecs);
          await new Promise((r) => setTimeout(r, delaySecs * 1000));
        }

        // Update queue depth gauge
        const remainingQueued = await db.campaignRecipient.count({
          where: { campaignId, status: { in: ['PENDING', 'QUEUED'] } },
        });
        try {
          queueDepthGauge.set({ instance: activeInstance.name }, remainingQueued);
        } catch {}
      }
    } finally {
      this.activeCampaigns.delete(campaignId);
      this.cancelFlags.delete(campaignId);
      this.pauseFlags.delete(campaignId);
    }
  }
}

export const campaignRunner = CampaignRunner.instance;
