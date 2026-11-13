export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/crm/columns - Retrieve all custom smart fields
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const columns = await db.crmCustomField.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      columns,
      totalColumns: columns.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/crm/columns');
    return NextResponse.json({ error: err.message || 'Failed to fetch columns' }, { status: 500 });
  }
}

// POST /api/crm/columns - Create a new custom field
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'TEXT').toUpperCase();
    const description = body.description ? String(body.description).trim() : null;
    const isVisible = body.isVisible !== undefined ? Boolean(body.isVisible) : true;
    const options = body.options ? (Array.isArray(body.options) ? JSON.stringify(body.options) : String(body.options)) : null;

    if (!name) {
      return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
    }

    // Auto-generate key from name if not provided
    const key = (body.key ? String(body.key) : name)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');

    const existing = await db.crmCustomField.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json({ error: `Field with key "${key}" already exists` }, { status: 409 });
    }

    const currentCount = await db.crmCustomField.count();

    const created = await db.crmCustomField.create({
      data: {
        name,
        key,
        type: ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN'].includes(type) ? type : 'TEXT',
        description,
        isVisible,
        order: currentCount,
        options,
      },
    });

    return NextResponse.json({
      success: true,
      column: created,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/crm/columns');
    return NextResponse.json({ error: err.message || 'Failed to create column' }, { status: 500 });
  }
}

// PUT /api/crm/columns - Update a custom field (visibility, name, description, options)
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const { id, name, description, isVisible, options, order } = body;

    if (!id) {
      return NextResponse.json({ error: 'Column ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (description !== undefined) updateData.description = String(description).trim();
    if (isVisible !== undefined) updateData.isVisible = Boolean(isVisible);
    if (options !== undefined) {
      updateData.options = Array.isArray(options) ? JSON.stringify(options) : String(options);
    }
    if (order !== undefined) updateData.order = Number(order) || 0;

    const updated = await db.crmCustomField.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      column: updated,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/crm/columns');
    return NextResponse.json({ error: err.message || 'Failed to update column' }, { status: 500 });
  }
}

// DELETE /api/crm/columns - Delete a custom field
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Column ID is required' }, { status: 400 });
    }

    await db.crmCustomField.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Custom field deleted successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/crm/columns');
    return NextResponse.json({ error: err.message || 'Failed to delete column' }, { status: 500 });
  }
}
