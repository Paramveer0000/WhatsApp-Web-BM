export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EvolutionClient } from '@/lib/evolution';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api-wrapper';
import { isTenantScoped } from '@/lib/tenant';

export const GET = withApi(async function () {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const isClient = isTenantScoped(user);
  const client = await EvolutionClient.fromDatabase();
  let externalInstances: any[] = [];
  try {
    externalInstances = await client.fetchInstances();
  } catch (e: any) {
    logger.warn({ err: e.message, apiUrl: client.getApiUrl() }, 'Could not fetch instances list from Evolution API');
  }

  // Sync external instances to DB (preserving any existing tenant clientId)
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
        clientId: null,
      },
    });
  }

  // Tenant Isolation: strictly filter instances by tenant/client when scoped
  const instanceWhere: any = isClient ? { clientId: user.clientId } : {};

  const allInstances = await db.instance.findMany({
    where: instanceWhere,
    orderBy: { createdAt: 'desc' },
  });

  // Verify connection state directly for each instance if still recorded as CLOSE
  const mappedInstances = await Promise.all(
    allInstances.map(async (inst) => {
      let isConnected = inst.status?.toUpperCase() === 'OPEN';

      // If recorded as CLOSE or null, actively probe Evolution connectionState
      if (!isConnected) {
        try {
          const liveState = await client.getConnectionState(inst.name);
          if (liveState?.toUpperCase() === 'OPEN' || liveState?.toUpperCase() === 'CONNECTED') {
            isConnected = true;
            await db.instance.update({
              where: { id: inst.id },
              data: { status: 'OPEN' }
            }).catch(() => {});
          }
        } catch {
          // Probe failed, retain stored status
        }
      }

      return {
        ...inst,
        status: isConnected ? 'OPEN' : inst.status,
        connectionStatus: isConnected ? 'open' : 'close',
        phone: inst.profileNumber || '',
        isOpen: isConnected,
      };
    })
  );

  return NextResponse.json({ success: true, instances: mappedInstances });
});

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Enforce Tenant Quota if Client
  if (isTenantScoped(user)) {
    const currentCount = await db.instance.count({
      where: { clientId: user.clientId },
    });
    const maxAllowed = user.maxInstances || 1;
    if (currentCount >= maxAllowed) {
      return NextResponse.json({
        success: false,
        error: `Instance limit reached (${currentCount}/${maxAllowed}). Your current plan allows up to ${maxAllowed} number(s). Please upgrade to add more.`,
      }, { status: 403 });
    }
  }

  const body = await req.json();
  const rawName = (body.instanceName || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');

  if (!rawName) {
    return NextResponse.json({ success: false, error: 'Valid instanceName is required' }, { status: 400 });
  }

  // To prevent instance name collisions across different tenants on the shared Evolution API server:
  // Prefix client instances with their clientId if not already prefixed
  let instanceName = rawName;
  if (isTenantScoped(user)) {
    const prefix = `c_${user.clientId?.slice(0, 8)}_`;
    if (!instanceName.startsWith(prefix)) {
      instanceName = `${prefix}${instanceName}`;
    }
  }

  const client = await EvolutionClient.fromDatabase();
  try {
    await client.createInstance(instanceName, true);
  } catch (err: any) {
    logger.error({ err, apiUrl: client.getApiUrl() }, 'Evolution API createInstance failed');
    const statusCode = err.status || 502;
    return NextResponse.json({
      success: false,
      error: `Could not connect to Evolution API (${client.getApiUrl()}): ${err.message}. If Dokploy is still deploying or restarting the container, please wait a moment.`,
    }, { status: statusCode });
  }

  const inst = await db.instance.upsert({
    where: { name: instanceName },
    update: {
      status: 'CONNECTING',
      clientId: user.clientId || undefined,
    },
    create: {
      name: instanceName,
      status: 'CONNECTING',
      clientId: user.clientId || null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ success: true, instance: inst });
});
