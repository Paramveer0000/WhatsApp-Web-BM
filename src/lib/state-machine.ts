import { db } from './db';
import { logger } from './logger';

export type MessageStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'REPLIED'
  | 'FAILED'
  | 'RETRY_WAIT'
  | 'UNCERTAIN'
  | 'CANCELLED'
  | 'SKIPPED';

// Monotonic ranks: Higher rank = more advanced state
export const STATUS_RANKS: Record<MessageStatus, number> = {
  PENDING: 10,
  SKIPPED: 15,
  CANCELLED: 15,
  QUEUED: 20,
  SENDING: 30,
  RETRY_WAIT: 35,
  UNCERTAIN: 38,
  FAILED: 40,
  SENT: 50,
  DELIVERED: 60,
  READ: 70,
  REPLIED: 80,
};

export interface TransitionPatch {
  evolutionMessageId?: string;
  remoteJid?: string;
  renderedMessage?: string;
  instanceUsed?: string;
  errorCode?: string;
  lastError?: string;
  evaluationStatus?: string;
  attempts?: number;
  queuedAt?: Date;
  sendingAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  repliedAt?: Date;
}

export interface TransitionResult {
  success: boolean;
  previousStatus?: MessageStatus;
  currentStatus: MessageStatus;
  messageId: string;
}

/**
 * Validates whether transition from `from` to `to` is legally allowed by domain rules.
 */
export function isValidTransition(from: MessageStatus, to: MessageStatus): boolean {
  if (from === to) return true;

  // Once terminal failed or cancelled, do not mutate unless explicitly allowed
  if (from === 'CANCELLED' || from === 'SKIPPED') return false;
  if (from === 'READ') return false; // highest monotonic terminal

  // Monotonic delivery progression
  if (from === 'SENT' && (to === 'DELIVERED' || to === 'READ')) return true;
  if (from === 'DELIVERED' && to === 'READ') return true;

  // If already at DELIVERED, never downgrade to SENT or lower
  if (from === 'DELIVERED' && STATUS_RANKS[to] < STATUS_RANKS[from]) {
    return false;
  }

  // Allowed forward paths
  switch (from) {
    case 'PENDING':
      return to === 'QUEUED' || to === 'CANCELLED' || to === 'SKIPPED';
    case 'QUEUED':
      return to === 'SENDING' || to === 'CANCELLED' || to === 'SKIPPED';
    case 'SENDING':
      return to === 'SENT' || to === 'FAILED' || to === 'RETRY_WAIT' || to === 'UNCERTAIN' || to === 'SKIPPED';
    case 'RETRY_WAIT':
      return to === 'QUEUED' || to === 'CANCELLED' || to === 'FAILED' || to === 'SKIPPED';
    case 'UNCERTAIN':
      return to === 'SENT' || to === 'DELIVERED' || to === 'READ' || to === 'FAILED' || to === 'QUEUED';
    case 'FAILED':
      return to === 'QUEUED'; // Manual retry allowed
    default:
      return false;
  }
}

/**
 * Transitions a message state atomically using conditional update.
 * If 0 rows are affected (status was already changed by concurrent process), aborts gracefully.
 */
export async function transitionMessage(
  messageId: string,
  from: MessageStatus | MessageStatus[],
  to: MessageStatus,
  patch: TransitionPatch = {}
): Promise<TransitionResult> {
  const allowedFrom = Array.isArray(from) ? from : [from];

  const current = await db.campaignRecipient.findUnique({
    where: { id: messageId },
    select: { id: true, status: true, sentAt: true, deliveredAt: true, readAt: true },
  });

  if (!current) {
    return { success: false, currentStatus: 'FAILED', messageId };
  }

  const currentStatus = current.status as MessageStatus;

  // Handle out-of-order delivery updates monotonically
  // e.g. READ arrives when current is SENT: update to READ, and ensure deliveredAt is filled
  if (STATUS_RANKS[to] > STATUS_RANKS[currentStatus]) {
    if (to === 'DELIVERED' && !patch.deliveredAt) {
      patch.deliveredAt = new Date();
    }
    if (to === 'READ') {
      if (!patch.readAt) patch.readAt = new Date();
      if (!current.deliveredAt && !patch.deliveredAt) {
        patch.deliveredAt = patch.readAt; // fill missing delivery timestamp
      }
    }
  } else if (STATUS_RANKS[to] <= STATUS_RANKS[currentStatus] && (to === 'SENT' || to === 'DELIVERED')) {
    // Monotonic guard: do not downgrade higher state
    logger.debug({ messageId, currentStatus, attempted: to }, 'Ignored lower rank status transition (monotonic rule)');
    return { success: false, previousStatus: currentStatus, currentStatus, messageId };
  }

  // Atomic conditional update
  try {
    const updateData: any = {
      status: to,
      ...patch,
    };

    // Ensure state-specific timestamps
    if (to === 'SENDING' && !updateData.sendingAt) updateData.sendingAt = new Date();
    if (to === 'SENT' && !updateData.sentAt) updateData.sentAt = new Date();
    if (to === 'FAILED' && !updateData.failedAt) updateData.failedAt = new Date();
    if (to === 'QUEUED' && !updateData.queuedAt) updateData.queuedAt = new Date();

    const result = await db.campaignRecipient.updateMany({
      where: {
        id: messageId,
        status: { in: allowedFrom },
      },
      data: updateData,
    });

    if (result.count === 0) {
      logger.warn({ messageId, from, to, actualStatus: currentStatus }, 'Conditional update matched 0 rows');
      return { success: false, previousStatus: currentStatus, currentStatus, messageId };
    }

    logger.debug({ messageId, from, to }, 'Message transitioned successfully');
    return { success: true, previousStatus: currentStatus, currentStatus: to, messageId };
  } catch (err: any) {
    logger.error({ err: err.message, messageId, to }, 'Transition error');
    return { success: false, previousStatus: currentStatus, currentStatus, messageId };
  }
}
