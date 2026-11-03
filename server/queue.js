import { db, getSettings } from './db.js';
import { EvolutionClient } from './evolution.js';
import { renderMessage } from './spintax.js';
import { evaluateTaskQuality, evaluateWhatsAppNumber } from './quality.js';
import { EventEmitter } from 'node:events';

class CampaignQueueManager extends EventEmitter {
  constructor() {
    super();
    this.activeRunners = new Map(); // campaignId -> runner state
    this.sseClients = new Set();
  }

  // SSE client registration
  registerClient(res) {
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  emitLog(campaignId, logItem) {
    this.broadcast('log', { campaignId, ...logItem, timestamp: new Date().toISOString() });
  }

  emitProgress(campaignId) {
    const stats = this.getCampaignStats(campaignId);
    this.broadcast('progress', { campaignId, ...stats });
  }

  emitState(campaignId, status, reason = null) {
    this.broadcast('state', { campaignId, status, reason });
  }

  emitJitter(campaignId, countdown, totalWait, nextRecipient) {
    this.broadcast('jitter', {
      campaignId,
      countdown,
      totalWait,
      nextRecipient: nextRecipient ? {
        id: nextRecipient.id,
        phone: nextRecipient.phone,
        name: nextRecipient.name
      } : null
    });
  }

  getCampaignStats(campaignId) {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) return null;

    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) as sending,
        AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score ELSE 100 END) as avg_quality,
        SUM(CASE WHEN evaluation_status = 'quality_passed' OR evaluation_status = 'verified_wa' THEN 1 ELSE 0 END) as quality_passed
      FROM recipients
      WHERE campaign_id = ?
    `).get(campaignId);

    const total = counts.total || 0;
    const sent = counts.sent || 0;
    const failed = counts.failed || 0;
    const skipped = counts.skipped || 0;

    return {
      campaignId,
      status: campaign.status,
      total,
      sent,
      failed,
      skipped,
      pending: (counts.pending || 0) + (counts.sending || 0),
      qualityPassed: counts.quality_passed || 0,
      qualityScore: Math.round(counts.avg_quality || 100),
      percentage: total > 0 ? Math.round(((sent + failed + skipped) / total) * 100) : 0,
      haltReason: campaign.halt_reason
    };
  }

  async startCampaign(campaignId) {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    if (this.activeRunners.has(campaignId)) {
      const runner = this.activeRunners.get(campaignId);
      if (runner.state === 'running') {
        return { message: 'Campaign is already running' };
      }
    }

    // Reset pending state if was sending before
    db.prepare(`UPDATE recipients SET status = 'pending' WHERE campaign_id = ? AND status = 'sending'`).run(campaignId);

    // Update campaign state
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE campaigns 
      SET status = 'running', started_at = COALESCE(started_at, ?), halt_reason = NULL 
      WHERE id = ?
    `).run(now, campaignId);

    const runner = {
      campaignId,
      state: 'running',
      abortRequested: false,
      pauseRequested: false,
      delayResolver: null
    };

    this.activeRunners.set(campaignId, runner);
    this.emitState(campaignId, 'running');
    this.emitLog(campaignId, {
      type: 'info',
      status: 'Info',
      message: `Campaign "${campaign.name}" started with instance "${campaign.instance_name}"`
    });

    // Run in background without blocking API request
    this.runLoop(campaignId, runner).catch((err) => {
      console.error(`Error in campaign loop ${campaignId}:`, err);
    });

    return { message: 'Campaign started successfully' };
  }

  async pauseCampaign(campaignId) {
    const runner = this.activeRunners.get(campaignId);
    if (runner) {
      runner.pauseRequested = true;
      if (runner.delayResolver) {
        runner.delayResolver('pause');
      }
    }

    db.prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`).run(campaignId);
    this.emitState(campaignId, 'paused');
    this.emitLog(campaignId, {
      type: 'warning',
      status: 'Paused',
      message: 'Campaign execution paused by user'
    });

    return { message: 'Campaign paused' };
  }

  async resumeCampaign(campaignId) {
    return this.startCampaign(campaignId);
  }

  async abortCampaign(campaignId) {
    const runner = this.activeRunners.get(campaignId);
    if (runner) {
      runner.abortRequested = true;
      if (runner.delayResolver) {
        runner.delayResolver('abort');
      }
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE campaigns 
      SET status = 'aborted', completed_at = ? 
      WHERE id = ?
    `).run(now, campaignId);

    this.activeRunners.delete(campaignId);
    this.emitState(campaignId, 'aborted');
    this.emitLog(campaignId, {
      type: 'danger',
      status: 'Aborted',
      message: 'Campaign aborted by user'
    });

    return { message: 'Campaign aborted' };
  }

  interruptWithCircuitBreaker(campaignId, reason) {
    const runner = this.activeRunners.get(campaignId);
    if (runner) {
      runner.pauseRequested = true;
      if (runner.delayResolver) {
        runner.delayResolver('circuit_break');
      }
    }

    db.prepare(`
      UPDATE campaigns 
      SET status = 'paused', halt_reason = ? 
      WHERE id = ?
    `).run(`Circuit Breaker Tripped: ${reason}`, campaignId);

    this.emitState(campaignId, 'paused', reason);
    this.emitLog(campaignId, {
      type: 'danger',
      status: 'Circuit Breaker',
      message: `CIRCUIT BREAKER TRIGGERED: ${reason}. Campaign automatically halted for safety.`
    });
    this.broadcast('circuit_breaker', { campaignId, reason });
  }

  async waitWithCancellation(runner, seconds, campaignId, nextRecipient) {
    const totalMs = seconds * 1000;
    const startTime = Date.now();

    return new Promise((resolve) => {
      let intervalId = null;

      const finish = (result) => {
        if (intervalId) clearInterval(intervalId);
        runner.delayResolver = null;
        resolve(result);
      };

      runner.delayResolver = finish;

      // Broadcast remaining seconds every 1000ms
      intervalId = setInterval(() => {
        if (runner.abortRequested) return finish('abort');
        if (runner.pauseRequested) return finish('pause');

        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        this.emitJitter(campaignId, remaining, seconds, nextRecipient);

        if (elapsed >= totalMs) {
          finish('done');
        }
      }, 1000);
    });
  }

  async runLoop(campaignId, runner) {
    try {
      const settings = getSettings();
      const evolution = new EvolutionClient(settings.evolution_api_url, settings.global_api_key);

      // Verify instance status before starting
      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      if (!campaign) return;

      try {
        const stateRes = await evolution.getConnectionState(campaign.instance_name);
        const state = (stateRes?.instance?.state || '').toLowerCase();
        if (state !== 'open' && state !== 'connected') {
          this.interruptWithCircuitBreaker(
            campaignId,
            `Instance "${campaign.instance_name}" is not open/connected (current state: ${state || 'unknown'}). Please reconnect instance.`
          );
          return;
        }
      } catch (err) {
        this.interruptWithCircuitBreaker(
          campaignId,
          `Could not reach Evolution API or verify instance "${campaign.instance_name}": ${err.message}`
        );
        return;
      }

      // Fetch pending recipients
      let consecutiveFailures = 0;

      while (runner.state === 'running') {
        if (runner.abortRequested) break;
        if (runner.pauseRequested) break;

        const recipient = db.prepare(`
          SELECT * FROM recipients 
          WHERE campaign_id = ? AND status = 'pending' 
          ORDER BY id ASC 
          LIMIT 1
        `).get(campaignId);

        if (!recipient) {
          // No more pending recipients! Campaign completed
          const now = new Date().toISOString();
          db.prepare(`
            UPDATE campaigns 
            SET status = 'completed', completed_at = ? 
            WHERE id = ?
          `).run(now, campaignId);

          this.emitState(campaignId, 'completed');
          this.emitLog(campaignId, {
            type: 'success',
            status: 'Completed',
            message: `Campaign "${campaign.name}" completed successfully! All queued messages processed.`
          });
          this.emitProgress(campaignId);
          this.activeRunners.delete(campaignId);
          return;
        }

        // Mark recipient as 'sending'
        db.prepare(`UPDATE recipients SET status = 'sending' WHERE id = ?`).run(recipient.id);
        this.emitProgress(campaignId);

        // ========================================================
        // EVALUATION & QUALITY LAYER: Pre-flight Task Evaluation
        // ========================================================
        const qualitySettings = getSettings();
        const evalResult = evaluateTaskQuality(campaign.message_template, recipient, qualitySettings);

        // Pre-check WhatsApp Number Existence via Evolution API
        if (qualitySettings.enable_number_validation === '1' || qualitySettings.enable_number_validation === true) {
          this.emitLog(campaignId, {
            type: 'info',
            status: 'Quality Checking',
            recipientName: recipient.name || '',
            phone: recipient.phone,
            message: `[Quality Layer] Verifying WhatsApp account existence for ${recipient.phone}...`
          });

          const numCheck = await evaluateWhatsAppNumber(evolution, campaign.instance_name, recipient.phone);

          if (numCheck.evaluated && !numCheck.exists) {
            // Number does NOT exist on WhatsApp!
            if (qualitySettings.validation_action === 'skip') {
              const now = new Date().toISOString();
              db.prepare(`
                UPDATE recipients 
                SET status = 'skipped', 
                    evaluation_status = 'not_wa', 
                    quality_score = 0, 
                    quality_notes = ?,
                    sent_at = ?
                WHERE id = ?
              `).run(
                'Quality Gate Alert: Number not registered on WhatsApp. Auto-skipped to protect account reputation.',
                now,
                recipient.id
              );

              try {
                db.prepare(`UPDATE campaigns SET skipped_count = COALESCE(skipped_count, 0) + 1 WHERE id = ?`).run(campaignId);
              } catch {}

              this.emitLog(campaignId, {
                type: 'warning',
                status: 'Quality Skipped',
                recipientName: recipient.name || '',
                phone: recipient.phone,
                message: `[Quality Layer] Skipped: ${recipient.phone} has no active WhatsApp account.`
              });

              this.emitProgress(campaignId);
              continue; // Move to next recipient immediately without incurring delays or risking ban!
            } else {
              evalResult.notes += ' [Quality Warning: Number may not be on WhatsApp]';
            }
          }
        }

        // Render message with personalized variables, safe fallbacks & Spintax
        const fallbackName = qualitySettings.missing_variable_fallback || 'Valued Customer';
        const finalMessage = renderMessage(campaign.message_template, recipient, fallbackName);
        db.prepare(`
          UPDATE recipients 
          SET rendered_message = ?, 
              quality_score = ?, 
              quality_notes = ? 
          WHERE id = ?
        `).run(finalMessage, evalResult.qualityScore, evalResult.notes, recipient.id);

        let sendSuccess = false;
        let errorMessage = null;
        let responseJson = null;

        try {
          // Optional typing presence simulation
          if (campaign.simulate_typing) {
            try {
              await evolution.sendPresence(campaign.instance_name, recipient.phone, 'composing', 1500);
              // Small typing delay before dispatch
              await new Promise(r => setTimeout(r, 1200));
            } catch (presErr) {
              console.warn('Presence simulation warning:', presErr.message);
            }
          }

          // Send message
          const dispatchRes = await evolution.sendText(
            campaign.instance_name,
            recipient.phone,
            finalMessage,
            { delay: 1200, presence: campaign.simulate_typing ? 'composing' : 'available' }
          );

          sendSuccess = true;
          responseJson = JSON.stringify(dispatchRes);
        } catch (dispatchErr) {
          errorMessage = dispatchErr.message || 'Dispatch failed';
          responseJson = dispatchErr.data ? JSON.stringify(dispatchErr.data) : null;

          // Check if circuit breaker tripped
          if (EvolutionClient.isCircuitBreakerError(dispatchErr)) {
            const now = new Date().toISOString();
            db.prepare(`
              UPDATE recipients 
              SET status = 'failed', 
                  evaluation_status = 'circuit_failed',
                  sent_at = ?, 
                  error = ?, 
                  response_data = ? 
              WHERE id = ?
            `).run(now, errorMessage, responseJson, recipient.id);

            db.prepare(`UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?`).run(campaignId);
            this.emitProgress(campaignId);

            this.interruptWithCircuitBreaker(campaignId, errorMessage);
            return;
          }
        }

        const now = new Date().toISOString();
        if (sendSuccess) {
          consecutiveFailures = 0; // Reset consecutive failures counter on success
          const evalStatus = evalResult.hasSpamRisk ? 'spam_flagged' : 'quality_passed';

          db.prepare(`
            UPDATE recipients 
            SET status = 'sent', 
                evaluation_status = ?,
                sent_at = ?, 
                response_data = ? 
            WHERE id = ?
          `).run(evalStatus, now, responseJson, recipient.id);

          db.prepare(`UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?`).run(campaignId);

          this.emitLog(campaignId, {
            type: 'success',
            status: 'Sent [Quality OK]',
            recipientName: recipient.name || '',
            phone: recipient.phone,
            message: finalMessage.length > 60 ? finalMessage.substring(0, 57) + '...' : finalMessage
          });
        } else {
          consecutiveFailures++;

          db.prepare(`
            UPDATE recipients 
            SET status = 'failed', 
                evaluation_status = 'eval_failed',
                sent_at = ?, 
                error = ?, 
                response_data = ? 
            WHERE id = ?
          `).run(now, errorMessage, responseJson, recipient.id);

          db.prepare(`UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?`).run(campaignId);

          this.emitLog(campaignId, {
            type: 'error',
            status: 'Failed',
            recipientName: recipient.name || '',
            phone: recipient.phone,
            error: errorMessage,
            message: finalMessage.length > 60 ? finalMessage.substring(0, 57) + '...' : finalMessage
          });

          // ========================================================
          // QUALITY CIRCUIT-BREAKER: Consecutive Failures Guard
          // ========================================================
          const maxConsecutive = parseInt(qualitySettings.max_consecutive_failures, 10) || 3;
          if (consecutiveFailures >= maxConsecutive) {
            this.interruptWithCircuitBreaker(
              campaignId,
              `Quality Circuit Breaker: Reached ${consecutiveFailures} consecutive delivery failures. Queue auto-halted to preserve WhatsApp sender account reputation.`
            );
            return;
          }

          // Dynamic Error Rate Quality Check after 10+ messages
          const currentStats = this.getCampaignStats(campaignId);
          const totalProcessed = (currentStats.sent || 0) + (currentStats.failed || 0);
          const maxFailRate = parseFloat(qualitySettings.max_failure_rate_percent) || 20;

          if (totalProcessed >= 10) {
            const failRate = ((currentStats.failed || 0) / totalProcessed) * 100;
            if (failRate > maxFailRate) {
              this.interruptWithCircuitBreaker(
                campaignId,
                `Quality Circuit Breaker: Campaign error rate reached ${failRate.toFixed(1)}% (exceeded threshold of ${maxFailRate}%). Halting campaign for inspection.`
              );
              return;
            }
          }
        }

        this.emitProgress(campaignId);

        // Check if there are more pending recipients
        const nextPending = db.prepare(`
          SELECT * FROM recipients 
          WHERE campaign_id = ? AND status = 'pending' 
          ORDER BY id ASC 
          LIMIT 1
        `).get(campaignId);

        if (!nextPending) {
          // Finished!
          db.prepare(`
            UPDATE campaigns 
            SET status = 'completed', completed_at = ? 
            WHERE id = ?
          `).run(new Date().toISOString(), campaignId);

          this.emitState(campaignId, 'completed');
          this.emitLog(campaignId, {
            type: 'success',
            status: 'Completed',
            message: `Campaign "${campaign.name}" completed successfully!`
          });
          this.emitProgress(campaignId);
          this.activeRunners.delete(campaignId);
          return;
        }

        // Anti-ban Pacing delay with random jitter between min_delay and max_delay
        const minD = Math.max(1, campaign.min_delay || 12);
        const maxD = Math.max(minD, campaign.max_delay || 25);
        const delaySeconds = Math.floor(Math.random() * (maxD - minD + 1)) + minD;

        this.emitLog(campaignId, {
          type: 'info',
          status: 'Pacing Jitter',
          message: `Anti-ban pacing: sleeping for ${delaySeconds} seconds before sending to ${nextPending.phone}`
        });

        const cancelResult = await this.waitWithCancellation(runner, delaySeconds, campaignId, nextPending);
        if (cancelResult === 'abort') {
          break;
        }
        if (cancelResult === 'pause' || cancelResult === 'circuit_break') {
          break;
        }
      }
    } catch (fatalErr) {
      console.error(`Fatal campaign execution error:`, fatalErr);
      this.emitLog(campaignId, {
        type: 'danger',
        status: 'Error',
        message: `Campaign encountered an unexpected error: ${fatalErr.message}`
      });
    } finally {
      const runner = this.activeRunners.get(campaignId);
      if (runner && (runner.pauseRequested || runner.abortRequested)) {
        this.activeRunners.delete(campaignId);
      }
    }
  }
}

export const queueManager = new CampaignQueueManager();

