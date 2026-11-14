export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isTenantScoped } from '@/lib/tenant';

// GET /api/quick-replies - List quick replies with search & category filter
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (isTenantScoped(user)) {
      where.OR = [
        { clientId: user.clientId },
        { clientId: null }, // Shared global templates
      ];
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { shortcut: { contains: search } },
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const replies = await db.quickReply.findMany({
      where,
      orderBy: [{ category: 'asc' }, { shortcut: 'asc' }],
    });

    // Extract unique categories
    const allCategories = await db.quickReply.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    return NextResponse.json({
      success: true,
      quickReplies: replies,
      categories: allCategories.map((c) => c.category),
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/quick-replies');
    return NextResponse.json({ error: err.message || 'Failed to fetch quick replies' }, { status: 500 });
  }
}

// POST /api/quick-replies - Create a new quick reply
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    let { shortcut, title, content, category, mediaUrl } = body;

    if (!shortcut || !title || !content) {
      return NextResponse.json(
        { error: 'Shortcut, title, and message content are required' },
        { status: 400 }
      );
    }

    // Ensure shortcut starts with "/"
    shortcut = String(shortcut).trim();
    if (!shortcut.startsWith('/')) {
      shortcut = `/${shortcut}`;
    }
    shortcut = shortcut.toLowerCase().replace(/\s+/g, '_');

    // Check shortcut collision
    const existing = await db.quickReply.findUnique({ where: { shortcut } });
    if (existing) {
      return NextResponse.json(
        { error: `Shortcut "${shortcut}" already exists. Please choose a different shortcut.` },
        { status: 409 }
      );
    }

    const reply = await db.quickReply.create({
      data: {
        shortcut,
        title: String(title).trim(),
        content: String(content).trim(),
        category: category ? String(category).trim() : 'General',
        mediaUrl: mediaUrl ? String(mediaUrl).trim() : null,
        clientId: user.clientId || null,
        createdById: user.id,
      },
    });

    return NextResponse.json({ success: true, quickReply: reply }, { status: 201 });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/quick-replies');
    return NextResponse.json({ error: err.message || 'Failed to create quick reply' }, { status: 500 });
  }
}

// PUT /api/quick-replies - Update an existing quick reply
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    let { id, shortcut, title, content, category, mediaUrl } = body;

    if (!id) {
      return NextResponse.json({ error: 'Quick reply ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (shortcut !== undefined) {
      shortcut = String(shortcut).trim();
      if (!shortcut.startsWith('/')) shortcut = `/${shortcut}`;
      shortcut = shortcut.toLowerCase().replace(/\s+/g, '_');

      // Check collision
      const existing = await db.quickReply.findFirst({
        where: { shortcut, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Shortcut "${shortcut}" is already taken by another quick reply.` },
          { status: 409 }
        );
      }
      updateData.shortcut = shortcut;
    }

    if (title !== undefined) updateData.title = String(title).trim();
    if (content !== undefined) updateData.content = String(content).trim();
    if (category !== undefined) updateData.category = String(category).trim();
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl ? String(mediaUrl).trim() : null;

    const updated = await db.quickReply.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, quickReply: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/quick-replies');
    return NextResponse.json({ error: err.message || 'Failed to update quick reply' }, { status: 500 });
  }
}

// DELETE /api/quick-replies - Delete quick reply
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Quick reply ID is required' }, { status: 400 });
    }

    await db.quickReply.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Quick reply deleted successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/quick-replies');
    return NextResponse.json({ error: err.message || 'Failed to delete quick reply' }, { status: 500 });
  }
}

