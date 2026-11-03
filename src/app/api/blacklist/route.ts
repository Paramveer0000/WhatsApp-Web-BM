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

    const where = search ? { phone: { contains: search } } : {};
    const blacklist = await db.blacklist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ success: true, blacklist });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/blacklist');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const phones = Array.isArray(body.phones) ? body.phones : [body.phone];
    const reason = body.reason || 'Manual addition';

    let added = 0;
    for (const raw of phones) {
      const norm = normalizePhone(raw);
      if (norm.isValid) {
        await db.blacklist.upsert({
          where: { phone: norm.formatted },
          update: { reason },
          create: {
            phone: norm.formatted,
            reason,
            source: 'MANUAL',
          },
        });

        await db.contact.updateMany({
          where: { phone: norm.formatted },
          data: { isBlacklisted: true, blacklistReason: reason },
        });

        added++;
      }
    }

    return NextResponse.json({ success: true, added });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/blacklist');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    if (!phone) return NextResponse.json({ error: 'Phone parameter required' }, { status: 400 });

    await db.blacklist.deleteMany({ where: { phone } });
    await db.contact.updateMany({
      where: { phone },
      data: { isBlacklisted: false, blacklistReason: null },
    });

    return NextResponse.json({ success: true, message: `Removed ${phone} from blacklist` });
  } catch (err: any) {
    logger.error({ err }, 'Error deleting from blacklist');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

