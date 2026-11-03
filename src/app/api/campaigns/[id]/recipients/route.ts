import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const campaignId = params.id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const where: any = { campaignId };

    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const [recipients, total] = await Promise.all([
      db.campaignRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      db.campaignRecipient.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      recipients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/campaigns/[id]/recipients');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

