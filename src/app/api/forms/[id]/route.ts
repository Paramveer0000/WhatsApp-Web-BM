import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getTenantWhere } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const form = await db.form.findFirst({
      where: {
        id: params.id,
        ...tenantFilter,
      },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    let fields = [];
    try {
      fields = JSON.parse(form.fields);
    } catch {
      fields = [];
    }

    return NextResponse.json({
      success: true,
      form: {
        ...form,
        fields,
        submissionCount: form._count?.leads || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get form' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const existing = await db.form.findFirst({
      where: {
        id: params.id,
        ...tenantFilter,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    const body = await req.json();

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
    if (body.fields !== undefined) updateData.fields = JSON.stringify(body.fields);
    if (body.tag !== undefined) updateData.tag = body.tag ? String(body.tag).trim().toLowerCase() : null;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.autoReplyEnabled !== undefined) updateData.autoReplyEnabled = Boolean(body.autoReplyEnabled);
    if (body.autoReplyInstance !== undefined) updateData.autoReplyInstance = body.autoReplyInstance ? String(body.autoReplyInstance).trim() : null;
    if (body.autoReplyTemplate !== undefined) updateData.autoReplyTemplate = body.autoReplyTemplate ? String(body.autoReplyTemplate) : null;

    if (body.slug && body.slug !== existing.slug) {
      const cleanSlug = String(body.slug).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-');
      const collision = await db.form.findFirst({
        where: { slug: cleanSlug, id: { not: params.id } },
      });
      if (collision) {
        return NextResponse.json({ success: false, error: 'Slug is already in use by another form' }, { status: 400 });
      }
      updateData.slug = cleanSlug;
    }

    const updated = await db.form.update({
      where: { id: params.id },
      data: updateData,
    });

    let fields = [];
    try {
      fields = JSON.parse(updated.fields);
    } catch {
      fields = [];
    }

    return NextResponse.json({
      success: true,
      form: {
        ...updated,
        fields,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update form' },
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

    const existing = await db.form.findFirst({
      where: {
        id: params.id,
        ...tenantFilter,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Form not found' }, { status: 404 });
    }

    await db.form.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Form deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete form' },
      { status: 500 }
    );
  }
}
