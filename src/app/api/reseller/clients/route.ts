export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';

// Helper to generate slug from company name
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// GET /api/reseller/clients - Retrieve clients list with search, filter, and KPI stats
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'ALL' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED'
    const plan = searchParams.get('plan');
    const search = searchParams.get('search')?.trim();

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (plan && plan !== 'ALL') {
      where.planName = plan;
    }
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { ownerName: { contains: search } },
        { ownerEmail: { contains: search } },
        { ownerPhone: { contains: search } },
        { planName: { contains: search } },
      ];
    }

    const [clients, allClients] = await Promise.all([
      db.resellerClient.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          companyName: true,
          slug: true,
          ownerName: true,
          ownerEmail: true,
          ownerPhone: true,
          planName: true,
          status: true,
          billingCycle: true,
          price: true,
          currency: true,
          renewalDate: true,
          maxInstances: true,
          maxContacts: true,
          monthlyMsgCap: true,
          walletBalance: true,
          hasCrmPipeline: true,
          hasChatbot: true,
          hasMultiWarmup: true,
          hasDamMedia: true,
          hasAiResponder: true,
          customDomain: true,
          brandColor: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.resellerClient.findMany({
        select: {
          status: true,
          price: true,
          maxInstances: true,
          walletBalance: true,
        },
      }),
    ]);

    // KPI Metrics calculation
    const metrics = {
      totalClients: allClients.length,
      activeClients: allClients.filter((c) => c.status === 'ACTIVE').length,
      trialClients: allClients.filter((c) => c.status === 'TRIAL').length,
      suspendedClients: allClients.filter((c) => c.status === 'SUSPENDED').length,
      mrrTotal: allClients
        .filter((c) => c.status === 'ACTIVE')
        .reduce((sum, c) => sum + (c.price || 0), 0),
      totalInstancesAllocated: allClients.reduce((sum, c) => sum + (c.maxInstances || 1), 0),
      totalWalletBalance: allClients.reduce((sum, c) => sum + (c.walletBalance || 0), 0),
    };

    return NextResponse.json({
      success: true,
      clients,
      metrics,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/reseller/clients');
    return NextResponse.json({ error: err.message || 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST /api/reseller/clients - Onboard a new tenant client
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    let {
      companyName,
      ownerName,
      ownerEmail,
      ownerPhone,
      password,
      planName = 'Starter',
      billingCycle = 'MONTHLY',
      price = 1499,
      currency = 'INR',
      maxInstances = 1,
      maxContacts = 5000,
      monthlyMsgCap = 10000,
      walletBalance = 0,
      hasCrmPipeline = true,
      hasChatbot = true,
      hasMultiWarmup = true,
      hasDamMedia = true,
      hasAiResponder = false,
      customDomain,
      brandColor = '#0c57e4',
    } = body;

    if (!companyName || !ownerName || !ownerEmail) {
      return NextResponse.json(
        { error: 'Company Name, Owner Name, and Owner Email are required' },
        { status: 400 }
      );
    }

    ownerEmail = ownerEmail.toLowerCase().trim();
    const existing = await db.resellerClient.findUnique({
      where: { ownerEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Client with email "${ownerEmail}" already exists` },
        { status: 409 }
      );
    }

    // Generate unique slug
    let baseSlug = generateSlug(companyName);
    if (!baseSlug) baseSlug = 'client';
    let slug = baseSlug;
    let counter = 1;
    while (await db.resellerClient.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const defaultPassword = password && password.trim() ? password.trim() : 'Client@123';
    const passwordHash = await hashPassword(defaultPassword);

    // Calculate renewal date (30 days default for monthly, 365 for annual)
    const daysToAdd = billingCycle === 'ANNUAL' ? 365 : 30;
    const renewalDate = new Date(Date.now() + 3600000 * 24 * daysToAdd);

    const client = await db.resellerClient.create({
      data: {
        companyName: companyName.trim(),
        slug,
        ownerName: ownerName.trim(),
        ownerEmail,
        ownerPhone: ownerPhone ? String(ownerPhone).replace(/[^0-9+]/g, '') : null,
        passwordHash,
        planName,
        status: 'ACTIVE',
        billingCycle,
        price: Number(price) || 0,
        currency,
        renewalDate,
        maxInstances: Math.max(1, parseInt(String(maxInstances), 10) || 1),
        maxContacts: Math.max(100, parseInt(String(maxContacts), 10) || 5000),
        monthlyMsgCap: Math.max(1000, parseInt(String(monthlyMsgCap), 10) || 10000),
        walletBalance: Math.max(0, parseFloat(String(walletBalance)) || 0),
        hasCrmPipeline: Boolean(hasCrmPipeline),
        hasChatbot: Boolean(hasChatbot),
        hasMultiWarmup: Boolean(hasMultiWarmup),
        hasDamMedia: Boolean(hasDamMedia),
        hasAiResponder: Boolean(hasAiResponder),
        customDomain: customDomain ? String(customDomain).trim() : null,
        brandColor: brandColor ? String(brandColor).trim() : '#0c57e4',
      },
    });

    return NextResponse.json({ success: true, client }, { status: 201 });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/reseller/clients');
    return NextResponse.json({ error: err.message || 'Failed to create client' }, { status: 500 });
  }
}

// PUT /api/reseller/clients - Update client plan, limits, status, or wallet
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const existing = await db.resellerClient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const data: any = {};
    if (updates.companyName !== undefined) data.companyName = String(updates.companyName).trim();
    if (updates.ownerName !== undefined) data.ownerName = String(updates.ownerName).trim();
    if (updates.ownerPhone !== undefined) data.ownerPhone = updates.ownerPhone ? String(updates.ownerPhone).replace(/[^0-9+]/g, '') : null;
    if (updates.planName !== undefined) data.planName = String(updates.planName).trim();
    if (updates.status !== undefined) data.status = String(updates.status).trim();
    if (updates.billingCycle !== undefined) data.billingCycle = String(updates.billingCycle).trim();
    if (updates.price !== undefined) data.price = Number(updates.price) || 0;
    if (updates.maxInstances !== undefined) data.maxInstances = Math.max(1, parseInt(String(updates.maxInstances), 10) || 1);
    if (updates.maxContacts !== undefined) data.maxContacts = Math.max(100, parseInt(String(updates.maxContacts), 10) || 5000);
    if (updates.monthlyMsgCap !== undefined) data.monthlyMsgCap = Math.max(1000, parseInt(String(updates.monthlyMsgCap), 10) || 10000);
    if (updates.walletBalance !== undefined) data.walletBalance = Math.max(0, parseFloat(String(updates.walletBalance)) || 0);
    if (updates.hasCrmPipeline !== undefined) data.hasCrmPipeline = Boolean(updates.hasCrmPipeline);
    if (updates.hasChatbot !== undefined) data.hasChatbot = Boolean(updates.hasChatbot);
    if (updates.hasMultiWarmup !== undefined) data.hasMultiWarmup = Boolean(updates.hasMultiWarmup);
    if (updates.hasDamMedia !== undefined) data.hasDamMedia = Boolean(updates.hasDamMedia);
    if (updates.hasAiResponder !== undefined) data.hasAiResponder = Boolean(updates.hasAiResponder);
    if (updates.customDomain !== undefined) data.customDomain = updates.customDomain ? String(updates.customDomain).trim() : null;
    if (updates.brandColor !== undefined) data.brandColor = updates.brandColor ? String(updates.brandColor).trim() : '#0c57e4';

    if (updates.renewalDate !== undefined) {
      const d = new Date(updates.renewalDate);
      if (!isNaN(d.getTime())) data.renewalDate = d;
    }

    if (updates.password && String(updates.password).trim().length >= 6) {
      data.passwordHash = await hashPassword(String(updates.password).trim());
    }

    const updated = await db.resellerClient.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, client: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/reseller/clients');
    return NextResponse.json({ error: err.message || 'Failed to update client' }, { status: 500 });
  }
}

// DELETE /api/reseller/clients - Delete tenant client
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    await db.resellerClient.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Client removed successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/reseller/clients');
    return NextResponse.json({ error: err.message || 'Failed to delete client' }, { status: 500 });
  }
}

