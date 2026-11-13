export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/crm/tags - List all CRM tags with contact counts
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const tags = await db.crmTag.findMany({
      orderBy: { name: 'asc' },
    });

    // Also get contact counts per tag by scanning contact tags
    const allContacts = await db.contact.findMany({
      select: { tags: true },
    });

    const tagCounts: Record<string, number> = {};
    for (const c of allContacts) {
      if (!c.tags) continue;
      try {
        const parsed = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags;
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            const clean = String(t).trim();
            if (clean) {
              tagCounts[clean] = (tagCounts[clean] || 0) + 1;
            }
          }
        }
      } catch {
        // comma-separated fallback
        const split = String(c.tags).split(',');
        for (const s of split) {
          const clean = s.trim();
          if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        }
      }
    }

    const tagsWithCounts = tags.map((t) => ({
      ...t,
      contactCount: tagCounts[t.name] || 0,
    }));

    return NextResponse.json({
      success: true,
      tags: tagsWithCounts,
      totalTags: tags.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/crm/tags');
    return NextResponse.json({ error: err.message || 'Failed to fetch tags' }, { status: 500 });
  }
}

// POST /api/crm/tags - Create a new CRM tag
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const name = String(body.name || '').trim();
    const color = String(body.color || '#0c57e4').trim();

    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const existing = await db.crmTag.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
    }

    const created = await db.crmTag.create({
      data: {
        name,
        color: color || '#0c57e4',
      },
    });

    return NextResponse.json({
      success: true,
      tag: { ...created, contactCount: 0 },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/crm/tags');
    return NextResponse.json({ error: err.message || 'Failed to create tag' }, { status: 500 });
  }
}

// DELETE /api/crm/tags - Delete a tag by ID or name
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name');

    if (!id && !name) {
      return NextResponse.json({ error: 'Tag ID or Name is required' }, { status: 400 });
    }

    if (id) {
      await db.crmTag.delete({ where: { id } });
    } else if (name) {
      await db.crmTag.delete({ where: { name } });
    }

    return NextResponse.json({ success: true, message: 'Tag removed successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/crm/tags');
    return NextResponse.json({ error: err.message || 'Failed to delete tag' }, { status: 500 });
  }
}
