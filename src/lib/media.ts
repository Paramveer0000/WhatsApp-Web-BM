import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { logger } from './logger';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
};

/**
 * Resolves any media URL (data URI Base64, relative URL, or external URL)
 * into a direct URL that Evolution API / Baileys can reliably fetch.
 */
export async function resolveMediaUrlForEvolution(
  mediaUrl: string,
  fileName?: string
): Promise<{ resolvedUrl: string; fileName: string; mimetype: string }> {
  if (!mediaUrl) {
    return { resolvedUrl: '', fileName: fileName || 'file', mimetype: 'application/octet-stream' };
  }

  const baseInternal =
    process.env.INTERNAL_BASE_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'http://app:3000'
      : (process.env.PUBLIC_BASE_URL || 'http://localhost:3000'));

  // Case 1: Data URI Base64 (e.g. data:image/jpeg;base64,...)
  if (mediaUrl.startsWith('data:')) {
    try {
      const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        const mime = match[1].toLowerCase();
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const ext = MIME_TO_EXT[mime] || path.extname(fileName || '') || '.bin';
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        const safeFileName = `upload_${hash}${ext}`;

        // Ensure directories exist in shared prisma volume and public
        const targets = [
          path.join(process.cwd(), 'prisma', 'uploads'),
          path.join(process.cwd(), 'public', 'uploads'),
        ];

        for (const dir of targets) {
          try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, safeFileName), buffer);
          } catch {}
        }

        // Persist to MediaAsset database table for resilient cross-container serving
        try {
          const { db } = await import('./db');
          await db.mediaAsset.upsert({
            where: { sha256: hash },
            update: { path: safeFileName, url: `/api/media/${safeFileName}`, data: mediaUrl },
            create: { sha256: hash, mime, size: buffer.length, path: safeFileName, url: `/api/media/${safeFileName}`, data: mediaUrl },
          });
        } catch {}

        const resolvedUrl = `${baseInternal}/api/media/${safeFileName}`;
        logger.info({ mime, bytes: buffer.length, resolvedUrl }, 'Converted Base64 media to internal served URL');

        return {
          resolvedUrl,
          fileName: fileName && fileName.includes('.') ? fileName : safeFileName,
          mimetype: mime,
        };
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to convert base64 to file, passing through');
    }
  }

  // Case 2: Relative URL (e.g. /uploads/... or /api/media/...)
  if (mediaUrl.startsWith('/')) {
    const fullUrl = `${baseInternal}${mediaUrl}`;
    const ext = path.extname(mediaUrl).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
        ? 'image/png'
        : ext === '.pdf'
        ? 'application/pdf'
        : ext === '.mp4'
        ? 'video/mp4'
        : 'application/octet-stream';

    return {
      resolvedUrl: fullUrl,
      fileName: fileName || path.basename(mediaUrl),
      mimetype: mime,
    };
  }

  // Case 3: Public HTTP/HTTPS URL
  const ext = path.extname(mediaUrl.split('?')[0]).toLowerCase();
  const mime =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
      ? 'image/png'
      : ext === '.pdf'
      ? 'application/pdf'
      : ext === '.mp4'
      ? 'video/mp4'
      : 'image/jpeg';

  return {
    resolvedUrl: mediaUrl,
    fileName: fileName || path.basename(mediaUrl.split('?')[0]) || 'media.jpg',
    mimetype: mime,
  };
}

