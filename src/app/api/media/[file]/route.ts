export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function GET(req: NextRequest, { params }: { params: { file: string } }) {
  try {
    const fileName = path.basename(params.file);
    if (!fileName || fileName.includes('..')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    // Check possible storage locations
    const candidatePaths = [
      path.join(process.cwd(), 'prisma', 'uploads', fileName),
      path.join(process.cwd(), 'public', 'uploads', fileName),
      path.join('/app', 'prisma', 'uploads', fileName),
      path.join('/app', 'public', 'uploads', fileName),
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      // Fallback: Query database MediaAsset table
      const asset = await db.mediaAsset.findFirst({
        where: {
          OR: [
            { path: fileName },
            { url: { contains: fileName } },
          ],
        },
      });

      if (asset && asset.data) {
        const match = asset.data.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          const contentType = match[1];
          const fileBuffer = Buffer.from(match[2], 'base64');

          // Cache to filesystem for subsequent fast reads
          try {
            const cacheDir = path.join(process.cwd(), 'prisma', 'uploads');
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
            fs.writeFileSync(path.join(cacheDir, fileName), fileBuffer);
          } catch {}

          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': fileBuffer.length.toString(),
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }

      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(foundPath);
    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

