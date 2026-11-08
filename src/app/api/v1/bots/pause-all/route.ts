export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const resume = body.resume === true;

  if (resume) {
    const updated = await db.flow.updateMany({
      where: { status: 'paused', liveVersionId: { not: null } },
      data: { status: 'live' },
    });
    return NextResponse.json({ success: true, message: `Resumed ${updated.count} bot(s)` });
  } else {
    const updated = await db.flow.updateMany({
      where: { status: 'live' },
      data: { status: 'paused' },
    });
    return NextResponse.json({ success: true, message: `Paused ${updated.count} live bot(s)` });
  }
});

