export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contact = await db.contact.findUnique({
      where: { id: params.id },
      include: {
        lists: {
          include: { list: true },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/contacts/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const existing = await db.contact.findUnique({
      where: { id: params.id },
      include: { lists: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    let formattedPhone = existing.phone;
    if (body.phone && body.phone !== existing.phone) {
      const norm = normalizePhone(body.phone, body.defaultCountryCode || '91');
      if (!norm.isValid) {
        return NextResponse.json({ error: norm.error || 'Invalid phone format' }, { status: 400 });
      }
      formattedPhone = norm.formatted;
    }

    let customFieldsStr: string | null = existing.customFields;
    if (body.customFields !== undefined) {
      customFieldsStr = typeof body.customFields === 'string'
        ? body.customFields
        : JSON.stringify(body.customFields);
    }

    let tagsStr: string | null = existing.tags;
    if (body.tags !== undefined) {
      tagsStr = typeof body.tags === 'string'
        ? body.tags
        : JSON.stringify(body.tags);
    }

    const updated = await db.contact.update({
      where: { id: params.id },
      data: {
        name: body.name !== undefined ? (body.name ? String(body.name).trim() : null) : existing.name,
        phone: formattedPhone,
        customFields: customFieldsStr,
        tags: tagsStr,
        optInStatus: body.optInStatus !== undefined ? Boolean(body.optInStatus) : existing.optInStatus,
        isBlacklisted: body.isBlacklisted !== undefined ? Boolean(body.isBlacklisted) : existing.isBlacklisted,
        blacklistReason: body.blacklistReason !== undefined ? body.blacklistReason : existing.blacklistReason,
      },
    });

    // Update list association if listId was provided
    if (body.listId !== undefined) {
      // Remove all current list associations
      await db.listContact.deleteMany({
        where: { contactId: params.id },
      });

      // If a list was selected, link to it
      if (body.listId && body.listId !== 'none' && body.listId !== '') {
        await db.listContact.upsert({
          where: {
            listId_contactId: {
              listId: body.listId,
              contactId: params.id,
            },
          },
          update: {},
          create: {
            listId: body.listId,
            contactId: params.id,
          },
        });
      }
    }

    return NextResponse.json({ success: true, contact: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/contacts/[id]');
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

    const contact = await db.contact.findUnique({
      where: { id: params.id },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Delete relationships first
    await db.listContact.deleteMany({
      where: { contactId: params.id },
    });

    // Delete contact
    await db.contact.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/contacts/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

