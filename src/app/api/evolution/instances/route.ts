export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EvolutionClient } from '@/lib/evolution';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await EvolutionClient.fromDatabase();
    let externalInstances: any[] = [];
    try {
      externalInstances = await client.fetchInstances();
    } catch (e: any) {
      logger.warn({ err: e.message, apiUrl: client.getApiUrl() }, 'Could not fetch instances from Evolution API');
    }

    // Sync external instances to DB
    for (const item of externalInstances) {
      const inst = item.instance || item;
      const name = inst.instanceName || inst.name;
      if (!name) continue;

      // Check all possible status properties from various Evolution API v2 payloads
      const rawStatus = (
        inst.status ||
        inst.state ||
        inst.connectionStatus ||
        item.status ||
        item.connectionStatus ||
        item.state ||
        'CLOSE'
      ).toString().toUpperCase();

      const isOpen = rawStatus === 'OPEN' || rawStatus === 'CONNECTED';
      const status = isOpen ? 'OPEN' : (rawStatus === 'CONNECTING' ? 'CONNECTING' : 'CLOSE');

      // Extract phone number from owner, number, or profile
      let ownerNumber: string | null = null;
      const rawOwner = inst.owner || inst.number || inst.profileNumber || item.owner;
      if (rawOwner) {
        ownerNumber = String(rawOwner).split('@')[0].replace(/[^\d]/g, '');
      }

      const profileName = inst.profileName || inst.name || null;
      const profilePicUrl = inst.profilePicUrl || inst.profilePictureUrl || null;

      await db.instance.upsert({
        where: { name },
        update: {
          status,
          profileName: profileName || undefined,
          profileNumber: ownerNumber || undefined,
          profilePicUrl: profilePicUrl || undefined,
        },
        create: {
          name,
          status,
          profileName,
          profileNumber: ownerNumber,
          profilePicUrl,
        },
      });
    }

    const allInstances = await db.instance.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Augment with backward-compatible aliases for connectionStatus and phone
    const mappedInstances = allInstances.map((inst) => {
      const isConnected = inst.status?.toUpperCase() === 'OPEN';
      return {
        ...inst,
        connectionStatus: isConnected ? 'open' : 'close',
        phone: inst.profileNumber || '',
        isOpen: isConnected,
      };
    });

    return NextResponse.json({ success: true, instances: mappedInstances });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/evolution/instances');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const instanceName = (body.instanceName || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');

    if (!instanceName) {
      return NextResponse.json({ error: 'Valid instanceName is required' }, { status: 400 });
    }

    const client = await EvolutionClient.fromDatabase();
    try {
      await client.createInstance(instanceName, true);
    } catch (err: any) {
      logger.error({ err, apiUrl: client.getApiUrl() }, 'Evolution API createInstance failed');
      const statusCode = err.status || 502;
      return NextResponse.json({
        error: `Could not connect to Evolution API (${client.getApiUrl()}): ${err.message}. If Dokploy is still deploying or restarting the container, please wait a moment.`,
      }, { status: statusCode });
    }

    // Save instance to DB
    const created = await db.instance.upsert({
      where: { name: instanceName },
      update: { status: 'CONNECTING' },
      create: { name: instanceName, status: 'CONNECTING' },
    });

    // Auto-setup webhook
    try {
      const host = req.headers.get('host') || 'localhost:3000';
      const protocol = req.headers.get('x-forwarded-proto') || 'http';
      const webhookUrl = `${protocol}://${host}/api/webhooks/evolution/${encodeURIComponent(instanceName)}`;
      const secret = process.env.WEBHOOK_SECRET || 'whsec-evolution-shared-secret';
      await client.setWebhook(instanceName, webhookUrl, secret);
    } catch (whErr: any) {
      logger.warn({ instanceName, err: whErr.message }, 'Webhook auto-setup non-fatal error');
    }

    return NextResponse.json({
      success: true,
      instance: {
        ...created,
        connectionStatus: 'connecting',
        phone: created.profileNumber || '',
        isOpen: false,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/evolution/instances');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
