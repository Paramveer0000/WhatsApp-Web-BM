export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';

export const GET = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const template = await db.messageTemplate.findUnique({
    where: { id: params.id },
  });

  if (!template) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, template });
});

export const PUT = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = body.name ? String(body.name).trim() : undefined;
  const content = body.content !== undefined ? String(body.content) : undefined;

  const updated = await db.messageTemplate.update({
    where: { id: params.id },
    data: {
      name: name || undefined,
      content: content || undefined,
      mediaType: body.mediaType || undefined,
      mediaUrl: body.mediaUrl !== undefined ? body.mediaUrl : undefined,
      fileName: body.fileName !== undefined ? body.fileName : undefined,
      caption: body.caption !== undefined ? body.caption : undefined,
      tags: body.tags ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : undefined,
    },
  });

  return NextResponse.json({ success: true, template: updated });
});

export const DELETE = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await db.messageTemplate.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true, message: 'Template deleted successfully' });
});
