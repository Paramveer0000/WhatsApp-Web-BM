export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { isTenantScoped } from '@/lib/tenant';

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

  if (isTenantScoped(user) && template.clientId && template.clientId !== user.clientId) {
    return NextResponse.json({ success: false, error: 'Forbidden: Access to this template is denied' }, { status: 403 });
  }

  return NextResponse.json({ success: true, template });
});

export const PUT = withApi(async function (
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const existing = await db.messageTemplate.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
  }

  if (isTenantScoped(user) && existing.clientId !== user.clientId) {
    return NextResponse.json({ success: false, error: 'Forbidden: You cannot modify this template' }, { status: 403 });
  }

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

  const existing = await db.messageTemplate.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
  }

  if (isTenantScoped(user) && existing.clientId !== user.clientId) {
    return NextResponse.json({ success: false, error: 'Forbidden: You cannot delete this template' }, { status: 403 });
  }

  await db.messageTemplate.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true, message: 'Template deleted successfully' });
});
