import { NextRequest } from 'next/server';
import { eventBus } from '@/lib/queue/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Handshake
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`));

      const listener = (payload: { event: string; data: any }) => {
        try {
          const sseMsg = `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
          controller.enqueue(encoder.encode(sseMsg));
        } catch {
          eventBus.off('sse', listener);
        }
      };

      eventBus.on('sse', listener);

      // Keep-alive ping every 15 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingInterval);
          eventBus.off('sse', listener);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        eventBus.off('sse', listener);
      });
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

