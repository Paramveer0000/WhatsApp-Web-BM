export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lists = await db.contactList.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    return NextResponse.json({ success: true, lists });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/contacts/lists');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'List name is required' }, { status: 400 });
    }

    const list = await db.contactList.upsert({
      where: { name: body.name.trim() },
      update: {
        description: body.description || undefined,
      },
      create: {
        name: body.name.trim(),
        description: body.description || null,
      },
    });

    return NextResponse.json({ success: true, list });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/contacts/lists');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

