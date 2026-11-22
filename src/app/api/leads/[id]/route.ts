import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getTenantWhere } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const tenantFilter = getTenantWhere(user);

    const existing = await db.lead.findFirst({
      where: {
        id: params.id,
        ...tenantFilter,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.status !== undefined) {
      const allowed = ['new', 'contacted', 'qualified', 'closed'];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 });
      }
      updateData.status = body.status;
    }
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.email !== undefined) updateData.email = body.email ? String(body.email).trim() : null;
    if (body.tag !== undefined) updateData.tag = body.tag ? String(body.tag).trim().toLowerCase() : null;
    if (body.customFields !== undefined) updateData.customFields = JSON.stringify(body.customFields);

    const updated = await db.lead.update({
      where: { id: params.id },
      data: updateData,
      include: {
        form: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    let customFields = {};
    try {
      customFields = JSON.parse(updated.customFields || '{}');
    } catch {
      customFields = {};
    }

    return NextResponse.json({
      success: true,
      lead: {
        ...updated,
        customFields,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const tenantFilter = getTenantWhere(user);

    const existing = await db.lead.findFirst({
      where: {
        id: params.id,
        ...tenantFilter,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    await db.lead.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
