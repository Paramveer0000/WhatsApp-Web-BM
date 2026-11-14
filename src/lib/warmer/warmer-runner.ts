import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';
import { executeWarmerTurn } from './warmer-engine';

/**
 * Dedicated Background Scheduler for WhatsApp Number Warmer Sessions.
 * Continuously polls and advances active warming sessions across application restarts.
 */
class WarmerRunner {
  private inFlightSessions = new Set<string>();
  private isChecking = false;

  /**
   * Initializes the persistent in-process background interval if not already active.
   */
  ensureRunning(): void {
    if (typeof window !== 'undefined') return;

    const globalObj = globalThis as any;
    if (globalObj.__warmerRunnerActive__) {
      return;
    }

    globalObj.__warmerRunnerActive__ = true;
    logger.info('WhatsApp Number Warmer background runner daemon initialized');

    // Run poll check every 5 seconds
    setInterval(() => {
      this.checkAndRunSessions().catch((err) => {
        logger.error({ err: err.message }, 'Error in WarmerRunner interval loop');
      });
    }, 5000);

    // Initial check on boot
    setTimeout(() => {
      this.checkAndRunSessions().catch(() => {});
    }, 2000);
  }

  /**
   * Polls database for RUNNING warmer sessions and executes due dialogue turns.
   */
  async checkAndRunSessions(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      await ensureDbSchema();
      const now = new Date();

      // Find all running warmer sessions
      const runningSessions = await db.numberWarmerSession.findMany({
        where: {
          status: 'RUNNING',
        },
      });

      for (const session of runningSessions) {
        // 1. Midnight rollover: Reset daily counter if last exchange was on a previous calendar date
        if (session.lastExchangedAt) {
          const lastDate = new Date(session.lastExchangedAt);
          const isSameDay =
            lastDate.getFullYear() === now.getFullYear() &&
            lastDate.getMonth() === now.getMonth() &&
            lastDate.getDate() === now.getDate();

          if (!isSameDay && session.todayExchanges > 0) {
            await db.numberWarmerSession.update({
              where: { id: session.id },
              data: { todayExchanges: 0 },
            });
            session.todayExchanges = 0;
            logger.info({ sessionId: session.id }, 'Warmer daily exchanges counter auto-reset for new calendar day');
          }
        }

        // 2. Check if daily cap reached
        if (session.todayExchanges >= session.dailyCap) {
          await db.numberWarmerSession.update({
            where: { id: session.id },
            data: { status: 'COMPLETED' },
          });
          logger.info(
            { sessionId: session.id, todayExchanges: session.todayExchanges, cap: session.dailyCap },
            'Warmer session completed daily exchange target'
          );
          continue;
        }

        // 3. Check if due for execution
        const isDue = !session.nextScheduledAt || new Date(session.nextScheduledAt) <= now;

        if (isDue && !this.inFlightSessions.has(session.id)) {
          this.inFlightSessions.add(session.id);

          logger.info(
            {
              sessionId: session.id,
              instanceA: session.instanceA,
              instanceB: session.instanceB,
              turn: session.todayExchanges + 1,
            },
            'WarmerRunner picking up due session turn'
          );

          // Execute turn asynchronously with safety unlock
          executeWarmerTurn(session.id)
            .catch((err) => {
              logger.error({ err: err.message, sessionId: session.id }, 'WarmerRunner turn execution threw exception');
            })
            .finally(() => {
              this.inFlightSessions.delete(session.id);
            });
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed during WarmerRunner session check');
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Explicitly triggers an immediate turn when a session is activated by user.
   */
  async startSession(sessionId: string): Promise<void> {
    this.ensureRunning();

    if (!this.inFlightSessions.has(sessionId)) {
      this.inFlightSessions.add(sessionId);
      executeWarmerTurn(sessionId)
        .catch((err) => {
          logger.error({ err: err.message, sessionId }, 'Error during initial warmer turn dispatch');
        })
        .finally(() => {
          this.inFlightSessions.delete(sessionId);
        });
    }
  }
}

export const warmerRunner = new WarmerRunner();
