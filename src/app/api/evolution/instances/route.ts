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
      logger.warn({ err: e.message }, 'Could not fetch instances from Evolution API');
    }

    // Sync external instances to DB
    for (const item of externalInstances) {
      const inst = item.instance || item;
      const name = inst.instanceName || inst.name;
      if (!name) continue;

      const status = (inst.state || inst.connectionStatus || 'CLOSE').toUpperCase();

      await db.instance.upsert({
        where: { name },
        update: {
          status: status === 'OPEN' || status === 'CONNECTED' ? 'OPEN' : status,
          profileName: inst.profileName || null,
          profileNumber: inst.owner ? inst.owner.split('@')[0] : null,
          profilePicUrl: inst.profilePicUrl || null,
        },
        create: {
          name,
          status: status === 'OPEN' || status === 'CONNECTED' ? 'OPEN' : status,
          profileName: inst.profileName || null,
          profileNumber: inst.owner ? inst.owner.split('@')[0] : null,
          profilePicUrl: inst.profilePicUrl || null,
        },
      });
    }

    const allInstances = await db.instance.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, instances: allInstances });
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
    const result = await client.createInstance(instanceName, true);

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
      const webhookUrl = `${protocol}://${host}/api/webhooks/evolution`;
      const secret = process.env.WEBHOOK_SECRET || 'whsec-evolution';
      await client.setWebhook(instanceName, webhookUrl, secret);
    } catch (whErr: any) {
      logger.warn({ err: whErr.message }, 'Webhook auto-setup non-fatal error');
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'INSTANCE_CREATE',
        entity: 'INSTANCE',
        details: JSON.stringify({ instanceName }),
      },
    });

    return NextResponse.json({ success: true, instance: created, raw: result });
  } catch (err: any) {
    logger.error({ err }, 'Error creating instance');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

