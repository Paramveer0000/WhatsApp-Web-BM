export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const existing = await db.contactList.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact list not found' }, { status: 404 });
    }

    const updated = await db.contactList.update({
      where: { id: params.id },
      data: {
        name: body.name ? body.name.trim() : existing.name,
        description: body.description !== undefined ? body.description : existing.description,
      },
    });

    return NextResponse.json({ success: true, list: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/contacts/lists/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await db.contactList.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact list not found' }, { status: 404 });
    }

    // Delete associations first
    await db.listContact.deleteMany({
      where: { listId: params.id },
    });

    // Delete list
    await db.contactList.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Contact list deleted successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/contacts/lists/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

