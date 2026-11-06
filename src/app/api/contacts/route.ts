export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { withApi } from '@/lib/api-wrapper';

export const GET = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const listId = searchParams.get('listId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '1000', 10);
  const skip = (page - 1) * limit;

  const where: any = {};

  if (search) {
    where.OR = [
      { phone: { contains: search } },
      { name: { contains: search } },
    ];
  }

  if (listId && listId !== 'ALL') {
    where.lists = {
      some: { listId },
    };
  }

  const [rawContacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        lists: {
          include: {
            list: true,
          },
        },
      },
    }),
    db.contact.count({ where }),
  ]);

  const contacts = rawContacts.map((c) => ({
    ...c,
    listNames: c.lists?.map((l) => l.list.name) || [],
    listIds: c.lists?.map((l) => l.list.id) || [],
  }));

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
});

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.phone) {
    return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
  }

  const phoneResult = normalizePhone(body.phone, body.defaultCountryCode || '91');

  if (!phoneResult.isValid) {
    return NextResponse.json({ success: false, error: phoneResult.error || 'Invalid phone number format' }, { status: 400 });
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
});

export const DELETE = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unassigned = searchParams.get('unassigned') === 'true';

  if (unassigned) {
    // Find contacts not assigned to any list
    const unassignedContacts = await db.contact.findMany({
      where: {
        lists: {
          none: {},
        },
      },
      select: { id: true },
    });
    const ids = unassignedContacts.map((c) => c.id);
    if (ids.length > 0) {
      await db.contact.deleteMany({
        where: { id: { in: ids } },
      });
    }
    return NextResponse.json({
      success: true,
      count: ids.length,
      message: `Deleted ${ids.length} unassigned contact(s)`,
    });
  }

  const body = await req.json().catch(() => ({}));
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db.listContact.deleteMany({
      where: { contactId: { in: body.ids } },
    });
    const deleted = await db.contact.deleteMany({
      where: { id: { in: body.ids } },
    });
    return NextResponse.json({
      success: true,
      count: deleted.count,
      message: `Deleted ${deleted.count} contact(s)`,
    });
  }

  return NextResponse.json({ success: false, error: 'No contacts specified to delete' }, { status: 400 });
});
