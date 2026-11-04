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

    const blacklist = await db.blacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, blacklist });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/contacts/blacklist');
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

    const norm = normalizePhone(body.phone);
    if (!norm.isValid) {
      return NextResponse.json({ error: norm.error || 'Invalid phone' }, { status: 400 });
    }

    const item = await db.blacklist.upsert({
      where: { phone: norm.formatted },
      update: {
        reason: body.reason || 'Manually added to blacklist',
      },
      create: {
        phone: norm.formatted,
        reason: body.reason || 'Manually added to blacklist',
      },
    });

    // Mark contact as blacklisted if present
    await db.contact.updateMany({
      where: { phone: norm.formatted },
      data: { isBlacklisted: true, blacklistReason: body.reason || 'Manually added' },
    });

    return NextResponse.json({ success: true, item });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/contacts/blacklist');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const phone = searchParams.get('phone');

    if (!id && !phone) {
      return NextResponse.json({ error: 'id or phone parameter is required' }, { status: 400 });
    }

    let item;
    if (id) {
      item = await db.blacklist.findUnique({ where: { id } });
      if (item) {
        await db.blacklist.delete({ where: { id } });
        await db.contact.updateMany({
          where: { phone: item.phone },
          data: { isBlacklisted: false, blacklistReason: null },
        });
      }
    } else if (phone) {
      const norm = normalizePhone(phone);
      const targetPhone = norm.isValid ? norm.formatted : phone;
      await db.blacklist.deleteMany({ where: { phone: targetPhone } });
      await db.contact.updateMany({
        where: { phone: targetPhone },
        data: { isBlacklisted: false, blacklistReason: null },
      });
    }

    return NextResponse.json({ success: true, message: 'Removed from blacklist' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/contacts/blacklist');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
