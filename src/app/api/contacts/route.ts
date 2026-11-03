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
    const phoneResult = normalizePhone(body.phone);

    if (!phoneResult.isValid) {
      return NextResponse.json({ error: phoneResult.error || 'Invalid phone' }, { status: 400 });
    }

    const contact = await db.contact.upsert({
      where: { phone: phoneResult.formatted },
      update: {
        name: body.name || undefined,
        customFields: body.customFields ? JSON.stringify(body.customFields) : undefined,
        tags: body.tags ? JSON.stringify(body.tags) : undefined,
      },
      create: {
        phone: phoneResult.formatted,
        name: body.name || null,
        customFields: body.customFields ? JSON.stringify(body.customFields) : null,
        tags: body.tags ? JSON.stringify(body.tags) : JSON.stringify(['manual']),
        optInStatus: true,
      },
    });

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    logger.error({ err }, 'Error creating contact');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

