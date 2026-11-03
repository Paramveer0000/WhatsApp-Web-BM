export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const templates = await db.messageTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/templates');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = (body.name || '').trim();
    const content = body.content || '';

    if (!name || !content) {
      return NextResponse.json({ error: 'Template name and content are required' }, { status: 400 });
    }

    const template = await db.messageTemplate.upsert({
      where: { name },
      update: {
        content,
        mediaType: body.mediaType || 'text',
        mediaUrl: body.mediaUrl || null,
        fileName: body.fileName || null,
        caption: body.caption || null,
        tags: body.tags ? JSON.stringify(body.tags) : undefined,
      },
      create: {
        name,
        content,
        mediaType: body.mediaType || 'text',
        mediaUrl: body.mediaUrl || null,
        fileName: body.fileName || null,
        caption: body.caption || null,
        tags: body.tags ? JSON.stringify(body.tags) : null,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    logger.error({ err }, 'Error creating template');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

