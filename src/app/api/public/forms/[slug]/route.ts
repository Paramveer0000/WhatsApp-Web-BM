import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await ensureDbSchema();
    const slug = (params.slug || '').trim().toLowerCase();

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Form slug is required' }, { status: 400 });
    }

    const form = await db.form.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        description: true,
        slug: true,
        fields: true,
        isActive: true,
      },
    });

    if (!form || !form.isActive) {
      return NextResponse.json(
        { success: false, error: 'Form not found or has been deactivated' },
        { status: 404 }
      );
    }

    let parsedFields = [];
    try {
      parsedFields = JSON.parse(form.fields);
    } catch {
      parsedFields = [];
    }

    return NextResponse.json({
      success: true,
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        slug: form.slug,
        fields: parsedFields,
        isActive: form.isActive,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch form' },
      { status: 500 }
    );
  }
}
