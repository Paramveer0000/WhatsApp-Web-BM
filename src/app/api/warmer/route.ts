export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { isTenantScoped, getTenantAllowedInstanceNames } from '@/lib/tenant';
import { warmerRunner } from '@/lib/warmer/warmer-runner';

// GET /api/warmer - List sessions and available instances
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();
    warmerRunner.ensureRunning();

    const where: any = {};
    if (isTenantScoped(user)) {
      where.clientId = user.clientId;
    }

    const allowedInstances = await getTenantAllowedInstanceNames(user);

    let instancesRaw: any[] = [];
    try {
      const evo = await EvolutionClient.fromDatabase();
      instancesRaw = await evo.fetchInstances();
    } catch {}

    const sessions = await db.numberWarmerSession.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
    });

    const instances = (instancesRaw || [])
      .filter((i: any) => {
        if (allowedInstances === null) return true;
        return allowedInstances.includes(i.name);
      })
      .map((i: any) => ({
        name: i.name,
        status: i.status || i.connectionStatus || 'close',
        phone: i.ownerJid?.replace(/[^0-9]/g, '') || i.number || null,
        profileName: i.profileName || i.name,
      }));

    return NextResponse.json({
      success: true,
      sessions,
      instances,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/warmer');
    return NextResponse.json({ error: err.message || 'Failed to fetch warmer sessions' }, { status: 500 });
  }
}

// POST /api/warmer - Create or update a warmer session
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const {
      instanceA,
      instanceB,
      phoneA,
      phoneB,
      topic = 'casual',
      dailyCap = 25,
      minDelaySeconds = 45,
      maxDelaySeconds = 90,
      useAi = false,
      aiPrompt,
    } = body;

    if (!instanceA || !instanceB) {
      return NextResponse.json({ error: 'Both Instance A and Instance B are required' }, { status: 400 });
    }

    if (instanceA === instanceB) {
      return NextResponse.json({ error: 'Instance A and Instance B must be different WhatsApp numbers' }, { status: 400 });
    }

    const allowedInstances = await getTenantAllowedInstanceNames(user);
    if (allowedInstances !== null) {
      if (!allowedInstances.includes(instanceA) || !allowedInstances.includes(instanceB)) {
        return NextResponse.json({ error: 'You can only warm WhatsApp instances owned by your account' }, { status: 403 });
      }
    }

    // Check if an existing session between these two instances exists
    const existing = await db.numberWarmerSession.findFirst({
      where: {
        OR: [
          { instanceA, instanceB },
          { instanceA: instanceB, instanceB: instanceA },
        ],
      },
    });

    let session;
    if (existing) {
      session = await db.numberWarmerSession.update({
        where: { id: existing.id },
        data: {
          phoneA: phoneA || existing.phoneA,
          phoneB: phoneB || existing.phoneB,
          topic,
          dailyCap: Math.max(5, Math.min(100, Number(dailyCap) || 25)),
          minDelaySeconds: Math.max(20, Number(minDelaySeconds) || 45),
          maxDelaySeconds: Math.max(30, Number(maxDelaySeconds) || 90),
          useAi: Boolean(useAi),
          aiPrompt: aiPrompt || null,
        },
      });
    } else {
      session = await db.numberWarmerSession.create({
        data: {
          instanceA,
          instanceB,
          phoneA: phoneA || null,
          phoneB: phoneB || null,
          status: 'IDLE',
          topic,
          dailyCap: Math.max(5, Math.min(100, Number(dailyCap) || 25)),
          minDelaySeconds: Math.max(20, Number(minDelaySeconds) || 45),
          maxDelaySeconds: Math.max(30, Number(maxDelaySeconds) || 90),
          useAi: Boolean(useAi),
          aiPrompt: aiPrompt || null,
          clientId: user.clientId || null,
        },
      });
    }

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/warmer');
    return NextResponse.json({ error: err.message || 'Failed to save warmer session' }, { status: 500 });
  }
}
