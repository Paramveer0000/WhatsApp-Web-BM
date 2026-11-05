export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Size check (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds maximum 50MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine media type
    const mime = file.type || 'application/octet-stream';
    let mediaType = 'document';
    if (mime.startsWith('image/')) {
      mediaType = 'image';
    } else if (mime.startsWith('video/')) {
      mediaType = 'video';
    } else if (mime.startsWith('audio/')) {
      mediaType = 'audio';
    }

    // Generate safe unique filename
    const ext = path.extname(file.name) || (mediaType === 'image' ? '.png' : '.bin');
    const hash = crypto.randomBytes(8).toString('hex');
    const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const savedFileName = `${Date.now()}_${hash}_${safeBase}${ext}`;

    // Ensure uploads directories exist (both in public and shared prisma volume)
    const targetDirs = [
      path.join(process.cwd(), 'prisma', 'uploads'),
      path.join(process.cwd(), 'public', 'uploads'),
    ];

    for (const dir of targetDirs) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, savedFileName), buffer);
      } catch (err: any) {
        logger.warn({ dir, err: err.message }, 'Could not save to upload dir');
      }
    }

    // Build base64 Data URI
    const base64Uri = `data:${mime};base64,${buffer.toString('base64')}`;

    // Web URL served via /api/media route
    const publicUrl = `/api/media/${savedFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      base64: base64Uri,
      fileName: file.name,
      fileSize: file.size,
      mimeType: mime,
      mediaType,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/upload');
    return NextResponse.json({ error: err.message || 'Failed to upload file' }, { status: 500 });
  }
}

