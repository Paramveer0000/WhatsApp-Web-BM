import { DateTime } from 'luxon';
import { db, ensureDbSchema } from '../db';
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
import { logger, recordSystemLog } from '../logger';
import {
  getEffectiveGuardrails,
  evaluateWindowRule,
  evaluateRecipientFilterRule,
  evaluateContentSafetyRule,
  calculatePacingDecision,
  logGuardrailEvent,
} from '../guardrails';

export class CampaignRunner {
  private activeCampaigns = new Set<string>();
  private cancelFlags = new Map<string, boolean>();
  private pauseFlags = new Map<string, boolean>();

  static instance = new CampaignRunner();

  isCampaignActive(id: string): boolean {
    return this.activeCampaigns.has(id);
  }

  getActiveCampaignIds(): string[] {
    return Array.from(this.activeCampaigns);
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
    await ensureDbSchema();
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
      recordSystemLog('error', 'worker', `Startup reconciler error: ${err.message}`, { stack: err.stack }).catch(() => {});
    }
  }

  async triggerCircuitBreaker(campaignId: string, reason: string) {
    logger.warn({ campaignId, reason }, 'Circuit breaker triggered');
    recordSystemLog('warn', 'guardrail', `Circuit breaker triggered for campaign ${campaignId}: ${reason}`).catch(() => {});
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
        // Fetch active guardrail configuration (resolved: campaign > instance > global > safe preset)
        const guardrailsData = await getEffectiveGuardrails({
          campaignId,
          instanceName: availableInstances[0]?.name,
        });
        const guardrails = guardrailsData.effective;

        // 1. Check Sending Window with Guardrails
        const dummyCtx = {
          recipient: { id: '', phone: '' },
          campaign,
          instance: availableInstances[0] || { id: '', name: 'default', dailyCap: 200, sentToday: 0, status: 'OPEN' },
          config: guardrails,
          consecutiveFailures,
          messagesInBatch: messagesInCurrentBatch,
          totalSentInCampaign: 0,
          todaySentInstance: 0,
        };

        const windowCheck = evaluateWindowRule(dummyCtx as any);
        if (!windowCheck.allowed) {
          eventBus.emitLog(campaignId, {
            type: 'warning',
            status: 'SEND_WINDOW_SLEEP',
            message: windowCheck.reason || 'Outside allowed window',
          });
          await logGuardrailEvent({
            campaignId,
            type: 'WINDOW_BLOCKED',
            severity: 'info',
            detail: { reason: windowCheck.reason },
          });
          const sleepMs = Math.min(windowCheck.sleepMs || 60000, 60000);
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

        // Respect Layer 1 allocated instance if set at enqueue time
        if (recipient.instanceUsed) {
          const matching = healthyInstances.find(
            (inst) => inst.name === recipient.instanceUsed || inst.id === recipient.instanceUsed
          );
          if (matching) {
            activeInstance = matching;
          }
        } else if (campaign.rotationMode === 'LEAST_USED') {
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

        // 4b. Guardrail Recipient Filtering Check
        const recipientRuleCtx = {
          recipient: {
            id: recipient.id,
            phone: recipient.phone,
            name: recipient.name,
            customVariables: recipient.customVariables,
          },
          campaign,
          instance: activeInstance,
          config: guardrails,
          consecutiveFailures,
          messagesInBatch: messagesInCurrentBatch,
          totalSentInCampaign: 0,
          todaySentInstance: activeInstance.sentToday,
        };

        const filterCheck = await evaluateRecipientFilterRule(recipientRuleCtx as any);
        if (!filterCheck.allowed) {
          await transitionMessage(recipient.id, ['PENDING', 'QUEUED'], 'FAILED', {
            lastError: filterCheck.reason || 'Blocked by Guardrail Recipient Filter',
            failedAt: new Date(),
          });
          await logGuardrailEvent({
            campaignId,
            instanceId: activeInstance.id,
            type: 'RECIPIENT_FILTERED',
            severity: 'warning',
            detail: { phone: recipient.phone, reason: filterCheck.reason },
          });
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
          (recipient.variantId ? campaign.variants.find((v) => v.id === recipient.variantId) : null) ||
          campaign.variants[recipient.variantIndex % campaign.variants.length] ||
          { content: 'Hello {{name}}', mediaType: 'text', mediaUrl: null, fileName: null, caption: null };

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

        // Guardrail Content Safety Check
        const contentCheck = evaluateContentSafetyRule(recipientRuleCtx as any, finalMessage);
        if (!contentCheck.allowed) {
          if (guardrails.contentSafety.blockingMode === 'block_launch') {
            await this.triggerCircuitBreaker(campaignId, `Content Guardrail Triggered: ${contentCheck.reason}`);
            await logGuardrailEvent({
              campaignId,
              instanceId: activeInstance.id,
              type: 'CONTENT_BLOCKED',
              severity: 'critical',
              detail: { reason: contentCheck.reason, phone: recipient.phone },
            });
            break;
          } else {
            eventBus.emitLog(campaignId, {
              type: 'warning',
              status: 'CONTENT_WARNING',
              message: `Guardrail Content Warning: ${contentCheck.reason}`,
            });
          }
        }

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

            // User requirement: "if message fail , it(same msg) will auto asign to second contact"
            // Reassign the exact failed variant to the next pending contact so this message is delivered!
            try {
              if (variant && (recipient.variantId || variant.id)) {
                const nextPending = await db.campaignRecipient.findFirst({
                  where: {
                    campaignId,
                    status: 'PENDING',
                    id: { not: recipient.id },
                  },
                  orderBy: { rotationIndex: 'asc' },
                });

                if (nextPending) {
                  await db.campaignRecipient.update({
                    where: { id: nextPending.id },
                    data: {
                      variantId: variant.id || recipient.variantId,
                      variantIndex: recipient.variantIndex,
                    },
                  });
                  eventBus.emitLog(campaignId, {
                    type: 'info',
                    status: 'VARIANT_REASSIGNED',
                    message: `Undelivered message variant (${variant.label || `M${variant.position || ''}`}) auto-reassigned to next contact (${nextPending.phone}).`,
                    recipientId: nextPending.id,
                    phone: nextPending.phone,
                  });
                }
              }
            } catch (reassignErr: any) {
              logger.warn({ reassignErr: reassignErr.message }, 'Failed to reassign failed variant to next contact');
            }
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

        // 10. Anti-Ban Guardrails Pacing, Cooldown & Human Pause
        messagesInCurrentBatch++;
        const pacingDecision = calculatePacingDecision(recipientRuleCtx as any);

        if (pacingDecision.isBatchCooldown) {
          messagesInCurrentBatch = 0;
          eventBus.emitLog(campaignId, {
            type: 'info',
            status: 'BATCH_BREAK',
            message: `Guardrail batch cooldown triggered. Pausing for ${(pacingDecision.delayMs / 1000).toFixed(0)}s...`,
          });
        } else if (pacingDecision.isHumanPause) {
          eventBus.emitLog(campaignId, {
            type: 'info',
            status: 'HUMAN_PAUSE',
            message: `Guardrail human jitter pause: ${(pacingDecision.delayMs / 1000).toFixed(0)}s pause...`,
          });
        }

        const delaySecs = Math.max(1, Math.round(pacingDecision.delayMs / 1000));
        eventBus.emitJitter(campaignId, delaySecs, delaySecs);
        await new Promise((r) => setTimeout(r, pacingDecision.delayMs));

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
