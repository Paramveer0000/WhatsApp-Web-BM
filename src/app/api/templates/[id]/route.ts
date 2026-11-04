export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolvedParams = await params;
    const templateId = resolvedParams.id;

    await db.messageTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/templates/[id]');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
