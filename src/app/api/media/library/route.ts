export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isTenantScoped } from '@/lib/tenant';
import path from 'path';
import fs from 'fs';

// GET: Retrieve DAM Media Assets with filtering, search, and storage metrics
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category'); // 'image' | 'video' | 'document' | 'audio'
    const search = searchParams.get('search')?.trim();
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = {};
    if (isTenantScoped(user)) {
      where.clientId = user.clientId;
    }

    if (category && category !== 'all') {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { fileName: { contains: search } },
        { path: { contains: search } },
      ];
    }

    const [assets, total, stats] = await Promise.all([
      db.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
        select: {
          id: true,
          sha256: true,
          mime: true,
          size: true,
          path: true,
          url: true,
          title: true,
          fileName: true,
          category: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.mediaAsset.count({ where }),
      db.mediaAsset.aggregate({
        _sum: { size: true },
        _count: { id: true },
      }),
    ]);

    // Format output and parse tags safely
    const formatted = assets.map((a) => {
      let parsedTags: string[] = [];
      try {
        if (a.tags) parsedTags = JSON.parse(a.tags);
      } catch {}
      return {
        ...a,
        title: a.title || a.fileName || a.path,
        url: a.url || `/api/media/${a.path}`,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      success: true,
      assets: formatted,
      total,
      totalStorageBytes: stats._sum.size || 0,
      totalAssetsCount: stats._count.id || 0,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/media/library');
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete asset by ID from database and physical disk
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
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const asset = await db.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Attempt to delete physical files
    if (asset.path) {
      const safePath = path.basename(asset.path);
      const targetDirs = [
        path.join(process.cwd(), 'prisma', 'uploads'),
        path.join(process.cwd(), 'public', 'uploads'),
      ];
      for (const dir of targetDirs) {
        try {
          const filePath = path.join(dir, safePath);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (unlinkErr: any) {
          logger.warn({ unlinkErr: unlinkErr.message, safePath }, 'Failed to unlink physical media file');
        }
      }
    }

    await db.mediaAsset.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Asset deleted successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/media/library');
    return NextResponse.json({ error: err.message || 'Failed to delete asset' }, { status: 500 });
  }
}

// PATCH/PUT: Update asset metadata (title, category, tags)
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const { id, title, category, tags } = body;

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (category !== undefined) updateData.category = String(category).trim();
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? JSON.stringify(tags) : String(tags);
    }

    const updated = await db.mediaAsset.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/media/library');
    return NextResponse.json({ error: err.message || 'Failed to update asset' }, { status: 500 });
  }
}

