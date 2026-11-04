export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { eventBus } from '@/lib/queue/events';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Fetch initial campaign state and recipient counts
      try {
        const campaign = await db.campaign.findUnique({
          where: { id: campaignId },
          include: {
            variants: true,
          },
        });

        const total = await db.campaignRecipient.count({ where: { campaignId } });
        const sent = await db.campaignRecipient.count({
          where: { campaignId, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
        });
        const delivered = await db.campaignRecipient.count({
          where: { campaignId, status: { in: ['DELIVERED', 'READ'] } },
        });
        const read = await db.campaignRecipient.count({
          where: { campaignId, status: 'READ' },
        });
        const failed = await db.campaignRecipient.count({
          where: { campaignId, status: 'FAILED' },
        });

        const initPayload = {
          type: 'INIT',
          campaign: {
            id: campaign?.id,
            name: campaign?.name,
            status: campaign?.status,
            haltReason: campaign?.haltReason,
          },
          stats: {
            total,
            sent,
            delivered,
            read,
            failed,
          },
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initPayload)}\n\n`));
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'INIT', error: err.message })}\n\n`)
        );
      }

      // Event listeners for this specific campaign
      const logListener = (cId: string, logData: any) => {
        if (cId !== campaignId) return;
        try {
          const sseMsg = `data: ${JSON.stringify({
            type: 'LOG',
            log: {
              timestamp: Date.now(),
              level: logData.type || 'info',
              message: logData.message,
              status: logData.status,
            },
          })}\n\n`;
          controller.enqueue(encoder.encode(sseMsg));
        } catch {
          cleanup();
        }
      };

      const jitterListener = (cId: string, data: any) => {
        if (cId !== campaignId) return;
        try {
          const sseMsg = `data: ${JSON.stringify({
            type: 'JITTER',
            ...data,
          })}\n\n`;
          controller.enqueue(encoder.encode(sseMsg));
        } catch {
          cleanup();
        }
      };

      const circuitListener = (cId: string, reason: string) => {
        if (cId !== campaignId) return;
        try {
          const sseMsg = `data: ${JSON.stringify({
            type: 'STATUS_CHANGE',
            campaign: { status: 'PAUSED', haltReason: `Circuit Breaker: ${reason}` },
          })}\n\n`;
          controller.enqueue(encoder.encode(sseMsg));
        } catch {
          cleanup();
        }
      };

      eventBus.on('log', logListener);
      eventBus.on('jitter', jitterListener);
      eventBus.on('circuit_breaker', circuitListener);

      // Periodic heartbeat and stats refresh every 10 seconds
      const interval = setInterval(async () => {
        try {
          const campaign = await db.campaign.findUnique({
            where: { id: campaignId },
            select: { status: true, haltReason: true },
          });

          const total = await db.campaignRecipient.count({ where: { campaignId } });
          const sent = await db.campaignRecipient.count({
            where: { campaignId, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
          });
          const delivered = await db.campaignRecipient.count({
            where: { campaignId, status: { in: ['DELIVERED', 'READ'] } },
          });
          const read = await db.campaignRecipient.count({
            where: { campaignId, status: 'READ' },
          });
          const failed = await db.campaignRecipient.count({
            where: { campaignId, status: 'FAILED' },
          });

          const hbMsg = `data: ${JSON.stringify({
            type: 'HEARTBEAT',
            campaign: {
              status: campaign?.status,
              haltReason: campaign?.haltReason,
            },
            stats: { total, sent, delivered, read, failed },
          })}\n\n`;
          controller.enqueue(encoder.encode(hbMsg));
        } catch {
          cleanup();
        }
      }, 10000);

      const cleanup = () => {
        clearInterval(interval);
        eventBus.off('log', logListener);
        eventBus.off('jitter', jitterListener);
        eventBus.off('circuit_breaker', circuitListener);
      };

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
