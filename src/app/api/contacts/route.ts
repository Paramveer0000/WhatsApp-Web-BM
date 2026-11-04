export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const listId = searchParams.get('listId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { name: { contains: search } },
      ];
    }

    if (listId) {
      where.lists = {
        some: { listId },
      };
    }

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.contact.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/contacts');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const phoneResult = normalizePhone(body.phone, body.defaultCountryCode || '91');

    if (!phoneResult.isValid) {
      return NextResponse.json({ error: phoneResult.error || 'Invalid phone number format' }, { status: 400 });
    }

    let customFieldsStr: string | null = null;
    if (body.customFields) {
      customFieldsStr = typeof body.customFields === 'string' ? body.customFields : JSON.stringify(body.customFields);
    }

    let tagsStr: string | null = null;
    if (body.tags) {
      tagsStr = typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags);
    }

    const contact = await db.contact.upsert({
      where: { phone: phoneResult.formatted },
      update: {
        name: body.name ? String(body.name).trim() : undefined,
        customFields: customFieldsStr || undefined,
        tags: tagsStr || undefined,
      },
      create: {
        phone: phoneResult.formatted,
        name: body.name ? String(body.name).trim() : null,
        customFields: customFieldsStr,
        tags: tagsStr || JSON.stringify(['manual']),
        optInStatus: true,
      },
    });

    if (body.listId) {
      await db.listContact.upsert({
        where: {
          listId_contactId: {
            listId: body.listId,
            contactId: contact.id,
          },
        },
        update: {},
        create: {
          listId: body.listId,
          contactId: contact.id,
        },
      });
    }

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    logger.error({ err }, 'Error creating contact');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
