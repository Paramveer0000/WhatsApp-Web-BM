import { db } from '../db';
import { EvolutionClient } from '../evolution';
import { renderMessage } from '../spintax';
import { eventBus } from './events';
import { calculateJitterDelay, isWithinSendingWindow } from './pacing';
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

      // Check instances state
      const availableInstances = campaign.instances.map((ci) => ci.instance);
      let instanceIndex = 0;
      let consecutiveFailures = 0;
      let messagesInCurrentBatch = 0;

      while (!this.cancelFlags.get(campaignId) && !this.pauseFlags.get(campaignId)) {
        // 1. Check Sending Window
        const windowCheck = isWithinSendingWindow(
          campaign.sendWindowStart,
          campaign.sendWindowEnd,
          campaign.timezone
        );

        if (!windowCheck.isInsideWindow) {
          eventBus.emitLog(campaignId, {
            type: 'warning',
            status: 'SEND_WINDOW_SLEEP',
            message: `Current time (${windowCheck.currentHourStr}) is outside sending window (${campaign.sendWindowStart} - ${campaign.sendWindowEnd}). Sleeping 60s...`,
          });
          await new Promise((r) => setTimeout(r, 60000));
          continue;
        }

        // 2. Fetch next PENDING recipient (Idempotent DB lock)
        const recipient = await db.campaignRecipient.findFirst({
          where: { campaignId, status: 'PENDING' },
          orderBy: { id: 'asc' },
        });

        if (!recipient) {
          // All recipients processed! Complete campaign
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

        // 3. Instance Rotation (ROUND_ROBIN or LEAST_USED)
        let activeInstance = availableInstances[instanceIndex % availableInstances.length];
        if (campaign.rotationMode === 'LEAST_USED') {
          const sorted = [...availableInstances].sort((a, b) => a.sentToday - b.sentToday);
          activeInstance = sorted[0];
        }
        instanceIndex++;

        // 4. Mark recipient as SENDING
        await db.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SENDING', attempts: { increment: 1 } },
        });

        // 5. Select Variant (A/B Testing)
        const variant = campaign.variants.length > 0
          ? campaign.variants[recipient.variantIndex % campaign.variants.length]
          : { content: 'Hello {name}', mediaType: 'text', mediaUrl: null, fileName: null, caption: null };

        // 6. Render Message with Fallback syntax & Spintax
        const finalMessage = renderMessage(variant.content, {
          name: recipient.name,
          phone: recipient.phone,
          custom_variables: recipient.customVariables,
        });

        // 7. Human Presence Simulation
        if (campaign.simulateTyping) {
          try {
            await evolution.sendPresence(activeInstance.name, recipient.phone, 'composing', 1500);
            await new Promise((r) => setTimeout(r, 1200));
          } catch {}
        }

        // 8. Dispatch Message
        let sendSuccess = false;
        let errorMessage = '';
        let messageId = '';

        try {
          let dispatchRes: any;
          if (variant.mediaType && variant.mediaType !== 'text' && variant.mediaUrl) {
            dispatchRes = await evolution.sendMedia(activeInstance.name, recipient.phone, {
              mediaType: variant.mediaType as any,
              mimetype: variant.mediaType === 'image' ? 'image/jpeg' : (variant.mediaType === 'video' ? 'video/mp4' : 'application/pdf'),
              caption: variant.caption ? renderMessage(variant.caption, { name: recipient.name }) : finalMessage,
              media: variant.mediaUrl,
              fileName: variant.fileName || 'document',
            });
          } else {
            dispatchRes = await evolution.sendText(activeInstance.name, recipient.phone, finalMessage);
          }

          sendSuccess = true;
          messageId = dispatchRes?.key?.id || dispatchRes?.id || `MSG_${Date.now()}`;
        } catch (err: any) {
          errorMessage = err.message || 'Dispatch error';

          // Circuit breaker check
          if (EvolutionClient.isCircuitBreakerError(err)) {
            await db.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: 'FAILED', lastError: errorMessage },
            });
            await this.triggerCircuitBreaker(campaignId, errorMessage);
            return;
          }
        }

        // 9. Update Recipient Record
        if (sendSuccess) {
          consecutiveFailures = 0;
          await db.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              messageId,
              renderedMessage: finalMessage,
              instanceUsed: activeInstance.name,
            },
          });

          await db.instance.update({
            where: { id: activeInstance.id },
            data: { sentToday: { increment: 1 } },
          });

          eventBus.emitLog(campaignId, {
            type: 'success',
            status: 'SENT',
            phone: recipient.phone,
            recipientName: recipient.name,
            instance: activeInstance.name,
            message: finalMessage.length > 50 ? finalMessage.substring(0, 47) + '...' : finalMessage,
          });
        } else {
          consecutiveFailures++;
          await db.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              lastError: errorMessage,
              instanceUsed: activeInstance.name,
            },
          });

          eventBus.emitLog(campaignId, {
            type: 'error',
            status: 'FAILED',
            phone: recipient.phone,
            recipientName: recipient.name,
            instance: activeInstance.name,
            error: errorMessage,
          });

          // Check consecutive failure limit
          if (consecutiveFailures >= 3) {
            await this.triggerCircuitBreaker(campaignId, `${consecutiveFailures} consecutive dispatches failed.`);
            return;
          }
        }

        messagesInCurrentBatch++;

        // 10. Batch Break check
        if (messagesInCurrentBatch >= campaign.batchBreakSize) {
          messagesInCurrentBatch = 0;
          const breakSeconds = campaign.batchBreakDuration * 60;
          eventBus.emitLog(campaignId, {
            type: 'info',
            status: 'BATCH_COOLDOWN',
            message: `Batch break active: resting for ${campaign.batchBreakDuration} minutes to prevent rate limiting...`,
          });
          await new Promise((r) => setTimeout(r, breakSeconds * 1000));
        } else {
          // 11. Anti-Ban Pacing Jitter Delay
          const jitterDelay = calculateJitterDelay(campaign.minDelay, campaign.maxDelay);
          eventBus.emitJitter(campaignId, jitterDelay, jitterDelay, recipient.phone);

          for (let s = jitterDelay; s > 0; s--) {
            if (this.cancelFlags.get(campaignId) || this.pauseFlags.get(campaignId)) break;
            eventBus.emitJitter(campaignId, s, jitterDelay, recipient.phone);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    } catch (fatal: any) {
      logger.error({ fatal, campaignId }, 'Fatal campaign execution error');
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED', haltReason: fatal.message },
      });
    } finally {
      this.activeCampaigns.delete(campaignId);
      this.cancelFlags.delete(campaignId);
      this.pauseFlags.delete(campaignId);
    }
  }
}

export const campaignRunner = CampaignRunner.instance;

