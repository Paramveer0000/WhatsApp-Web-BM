export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EvolutionClient } from '@/lib/evolution';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const instanceName = decodeURIComponent(params.name);
    const client = await EvolutionClient.fromDatabase();

    const fetchQr = req.nextUrl.searchParams.get('qr') === 'true';

    // 1. Fetch current connection state from Evolution API without regenerating pairing keys
    const rawState = await client.getConnectionState(instanceName);
    const isOpen = rawState?.toLowerCase() === 'open' || rawState?.toLowerCase() === 'connected';
    const isConnecting = rawState?.toLowerCase() === 'connecting';
    const status = isOpen ? 'OPEN' : (isConnecting ? 'CONNECTING' : 'CLOSE');

    let qr: any = null;

    // 2. Only generate/fetch QR code when explicitly requested (?qr=true) and not yet connected
    // This prevents poll requests from constantly resetting the Baileys pairing handshake!
    if (fetchQr && !isOpen) {
      try {
        qr = await client.getConnectQR(instanceName);
      } catch (qrErr: any) {
        // If instance was not created in Evolution API yet, auto-create it now
        if (
          qrErr?.name === 'InstanceNotFoundError' ||
          qrErr?.code === 'INSTANCE_NOT_FOUND' ||
          qrErr?.status === 404
        ) {
          try {
            await client.createInstance(instanceName, true);
            const webhookBase = process.env.INTERNAL_BASE_URL || 'http://app:3000';
            const webhookSecret = process.env.WEBHOOK_SECRET || 'whsec-evolution';
            const webhookUrl = `${webhookBase}/api/webhooks/evolution/${encodeURIComponent(instanceName)}`;
            await client.setWebhook(instanceName, webhookUrl, webhookSecret).catch(() => {});
            qr = await client.getConnectQR(instanceName);
          } catch (createErr: any) {
            logger.warn({ err: createErr.message, instanceName }, 'Failed to auto-create instance for QR');
          }
        } else {
          logger.debug({ err: qrErr.message, instanceName }, 'QR fetch warning');
        }
      }
    }

    // 3. Update DB status
    await db.instance.updateMany({
      where: { name: instanceName },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      instanceName,
      state: status,
      qr,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/evolution/instances/[name]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { name: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const instanceName = decodeURIComponent(params.name);
    const body = await req.json();
    const action = body.action; // 'restart' | 'logout'

    const client = await EvolutionClient.fromDatabase();

    if (action === 'restart') {
      await client.restartInstance(instanceName);
      return NextResponse.json({ success: true, message: `Instance ${instanceName} restarted` });
    } else if (action === 'logout') {
      await client.logoutInstance(instanceName);
      await db.instance.updateMany({
        where: { name: instanceName },
        data: { status: 'CLOSE' },
      });
      return NextResponse.json({ success: true, message: `Instance ${instanceName} logged out` });
    }

    return NextResponse.json({ error: 'Invalid action. Supported: restart, logout' }, { status: 400 });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/evolution/instances/[name]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const instanceName = decodeURIComponent(params.name);
    const client = await EvolutionClient.fromDatabase();

    try {
      await client.deleteInstance(instanceName);
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Failed to delete instance on Evolution API, removing from DB anyway');
    }

    await db.instance.deleteMany({ where: { name: instanceName } });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'INSTANCE_DELETE',
        entity: 'INSTANCE',
        details: JSON.stringify({ instanceName }),
      },
    });

    return NextResponse.json({ success: true, message: `Instance ${instanceName} deleted` });
  } catch (err: any) {
    logger.error({ err }, 'Error deleting instance');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
