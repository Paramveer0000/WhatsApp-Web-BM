export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settingsRows = await db.setting.findMany();
    const settings: Record<string, string> = {};

    for (const s of settingsRows) {
      if (s.isEncrypted && s.value) {
        settings[s.key] = user.role === 'ADMIN' ? decrypt(s.value) : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢';
      } else {
        settings[s.key] = s.value;
      }
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch settings');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required to update settings' }, { status: 403 });
    }

    const body = await req.json();

    const encryptedKeys = new Set(['GLOBAL_API_KEY', 'WEBHOOK_SECRET']);

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') continue;

      const isEnc = encryptedKeys.has(key);
      const storedValue = isEnc && value ? encrypt(value) : value;

      await db.setting.upsert({
        where: { key },
        update: { value: storedValue, isEncrypted: isEnc },
        create: { key, value: storedValue, isEncrypted: isEnc },
      });
    }

    // Record audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'SETTINGS_UPDATE',
        entity: 'SETTINGS',
        details: JSON.stringify({ keysUpdated: Object.keys(body) }),
      },
    });

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to save settings');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

