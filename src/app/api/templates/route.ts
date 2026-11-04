export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';

export const GET = withApi(async function () {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const templates = await db.messageTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ success: true, templates });
});

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = (body.name || '').trim();
  const content = body.content || '';

  if (!name || !content) {
    return NextResponse.json({ success: false, error: 'Template name and content are required' }, { status: 400 });
  }

  const template = await db.messageTemplate.upsert({
    where: { name },
    update: {
      content,
      mediaType: body.mediaType || 'text',
      mediaUrl: body.mediaUrl || null,
      fileName: body.fileName || null,
      caption: body.caption || null,
      tags: body.tags ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : undefined,
    },
    create: {
      name,
      content,
      mediaType: body.mediaType || 'text',
      mediaUrl: body.mediaUrl || null,
      fileName: body.fileName || null,
      caption: body.caption || null,
      tags: body.tags ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : JSON.stringify(['Custom']),
    },
  });

  return NextResponse.json({ success: true, template });
});
