import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (phone) {
      // Get conversation history with this contact
      const messages = await db.incomingMessage.findMany({
        where: { phone },
        orderBy: { receivedAt: 'asc' },
      });

      const recipientHistory = await db.campaignRecipient.findMany({
        where: { phone },
        select: {
          id: true,
          renderedMessage: true,
          sentAt: true,
          status: true,
          instanceUsed: true,
        },
        orderBy: { sentAt: 'asc' },
      });

      return NextResponse.json({ success: true, messages, recipientHistory });
    }

    // Get list of all conversations
    const recentMessages = await db.incomingMessage.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });

    const contactMap = new Map<string, any>();
    for (const msg of recentMessages) {
      if (!contactMap.has(msg.phone)) {
        contactMap.set(msg.phone, {
          phone: msg.phone,
          pushName: msg.pushName,
          instanceName: msg.instanceName,
          lastMessage: msg.body,
          lastReceivedAt: msg.receivedAt,
          status: msg.status,
          isOptOut: msg.isOptOut,
        });
      }
    }

    return NextResponse.json({ success: true, conversations: Array.from(contactMap.values()) });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/replies');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone, text, instanceName } = body;

    if (!phone || !text || !instanceName) {
      return NextResponse.json({ error: 'phone, text, and instanceName are required' }, { status: 400 });
    }

    const client = await EvolutionClient.fromDatabase();
    const result = await client.sendText(instanceName, phone, text);

    // Mark messages as HANDLED
    await db.incomingMessage.updateMany({
      where: { phone },
      data: { status: 'HANDLED' },
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    logger.error({ err }, 'Error sending manual reply');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

