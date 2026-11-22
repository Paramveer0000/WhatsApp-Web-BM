import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getTenantWhere } from '@/lib/tenant';
import { normalizeLeadPhone } from '@/lib/forms';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const tenantFilter = getTenantWhere(user);

    const { searchParams } = new URL(req.url);
    const formId = searchParams.get('form_id') || searchParams.get('formId');
    const tag = searchParams.get('tag');
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const skip = (page - 1) * limit;

    const where: any = {
      ...tenantFilter,
    };

    if (formId && formId !== 'all') {
      where.formId = formId;
    }
    if (tag && tag !== 'all') {
      where.tag = tag;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [leads, total, countsByStatus] = await Promise.all([
      db.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          form: {
            select: { id: true, title: true, slug: true },
          },
        },
      }),
      db.lead.count({ where }),
      db.lead.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      closed: 0,
    };
    countsByStatus.forEach((c) => {
      if (c.status) statusCounts[c.status] = c._count._all;
    });

    const parsedLeads = leads.map((l) => {
      let customFields = {};
      try {
        customFields = JSON.parse(l.customFields || '{}');
      } catch {
        customFields = {};
      }
      return {
        ...l,
        customFields,
      };
    });

    return NextResponse.json({
      success: true,
      leads: parsedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list leads' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const body = await req.json();

    const name = (body.name || '').trim();
    const rawPhone = (body.phone || '').trim();
    if (!name || !rawPhone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }

    const phone = normalizeLeadPhone(rawPhone);
    if (!phone || phone.length < 10) {
      return NextResponse.json({ success: false, error: 'Invalid phone number format' }, { status: 400 });
    }

    const lead = await db.lead.create({
      data: {
        formId: body.formId || null,
        name,
        phone,
        email: body.email ? String(body.email).trim() : null,
        customFields: JSON.stringify(body.customFields || {}),
        tag: body.tag ? String(body.tag).trim().toLowerCase() : null,
        status: body.status || 'new',
        clientId: user.clientId || null,
        createdById: user.id || null,
      },
      include: {
        form: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      lead: {
        ...lead,
        customFields: body.customFields || {},
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const tenantFilter = getTenantWhere(user);

    const body = await req.json();
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No lead IDs provided for deletion' }, { status: 400 });
    }

    const deleted = await db.lead.deleteMany({
      where: {
        id: { in: ids },
        ...tenantFilter,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      message: `Deleted ${deleted.count} leads successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to bulk delete leads' },
      { status: 500 }
    );
  }
}
