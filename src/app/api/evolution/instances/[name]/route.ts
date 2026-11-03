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

    const state = await client.getConnectionState(instanceName);
    let qr: any = null;

    if (state !== 'OPEN' && state !== 'open') {
      try {
        qr = await client.getConnectQR(instanceName);
      } catch (qrErr: any) {
        logger.debug({ err: qrErr.message }, 'QR fetch warning');
      }
    }

    // Update DB status
    const status = (state === 'open' || state === 'OPEN') ? 'OPEN' : (state === 'connecting' ? 'CONNECTING' : 'CLOSE');
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

