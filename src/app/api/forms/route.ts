import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getTenantWhere } from '@/lib/tenant';
import { generateFormSlug } from '@/lib/forms';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const tenantFilter = getTenantWhere(user);

    const forms = await db.form.findMany({
      where: tenantFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    const parsedForms = forms.map((f) => {
      let fields = [];
      try {
        fields = JSON.parse(f.fields);
      } catch {
        fields = [];
      }
      return {
        ...f,
        fields,
        submissionCount: f._count?.leads || 0,
      };
    });

    return NextResponse.json({ success: true, forms: parsedForms });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list forms' },
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

    const title = (body.title || '').trim();
    if (!title) {
      return NextResponse.json({ success: false, error: 'Form title is required' }, { status: 400 });
    }

    // Default core fields if not provided
    let fields = Array.isArray(body.fields) && body.fields.length > 0
      ? body.fields
      : [
          { id: 'f_name', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter your full name', isSystem: true },
          { id: 'f_phone', label: 'WhatsApp Number', type: 'phone', required: true, placeholder: '9876543210', isSystem: true },
        ];

    // Ensure Name and Phone are always present
    const hasPhone = fields.some((f: any) => f.type === 'phone' || f.id === 'f_phone');
    if (!hasPhone) {
      fields.unshift({ id: 'f_phone', label: 'WhatsApp Number', type: 'phone', required: true, placeholder: '9876543210', isSystem: true });
    }
    const hasName = fields.some((f: any) => f.id === 'f_name' || (f.type === 'text' && f.isSystem));
    if (!hasName) {
      fields.unshift({ id: 'f_name', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter your full name', isSystem: true });
    }

    // Generate or format unique slug
    let slug = body.slug ? String(body.slug).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-') : '';
    if (!slug) {
      slug = generateFormSlug(title);
    }

    // Check slug collision
    let existing = await db.form.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const form = await db.form.create({
      data: {
        title,
        description: body.description ? String(body.description).trim() : null,
        slug,
        fields: JSON.stringify(fields),
        tag: body.tag ? String(body.tag).trim().toLowerCase() : null,
        isActive: body.isActive ?? true,
        autoReplyEnabled: Boolean(body.autoReplyEnabled),
        autoReplyInstance: body.autoReplyInstance ? String(body.autoReplyInstance).trim() : null,
        autoReplyTemplate: body.autoReplyTemplate ? String(body.autoReplyTemplate) : null,
        clientId: user.clientId || null,
        createdById: user.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      form: {
        ...form,
        fields,
        submissionCount: 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create form' },
      { status: 500 }
    );
  }
}
