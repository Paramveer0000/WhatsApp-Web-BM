import pino from 'pino';
import { db } from './db';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type SystemLogLevel = 'info' | 'warn' | 'error';
export type SystemLogSource = 'worker' | 'app' | 'evolution' | 'scheduler' | 'guardrail';

/**
 * Persists a structured diagnostic log into SQLite for the in-app Diagnostics & Live Log Viewer.
 * Wrapped in fail-safe async execution so it never blocks or interrupts core business logic.
 */
export async function recordSystemLog(
  level: SystemLogLevel,
  source: SystemLogSource,
  message: string,
  details?: any
): Promise<void> {
  try {
    let detailsStr: string | null = null;
    if (details !== undefined && details !== null) {
      if (typeof details === 'string') {
        detailsStr = details;
      } else if (details instanceof Error) {
        detailsStr = JSON.stringify({
          message: details.message,
          stack: details.stack,
          name: details.name,
        });
      } else {
        try {
          detailsStr = JSON.stringify(details);
        } catch {
          detailsStr = String(details);
        }
      }
    }

    await db.systemLog.create({
      data: {
        level,
        source,
        message: (message || '').substring(0, 1000),
        details: detailsStr,
      },
    });
  } catch (err) {
    // Fail-safe: DB might be locking during burst or initial table creation
    // We do not crash callers
  }
}
