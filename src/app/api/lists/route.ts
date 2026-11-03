export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lists = await db.contactList.findMany({
      include: {
        _count: {
          select: { contacts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, lists });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/lists');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = (body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'List name is required' }, { status: 400 });
    }

    const list = await db.contactList.create({
      data: {
        name,
        description: body.description || null,
      },
    });

    return NextResponse.json({ success: true, list });
  } catch (err: any) {
    logger.error({ err }, 'Error creating list');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

