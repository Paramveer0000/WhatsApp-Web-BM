export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'global';
    const scopeId = searchParams.get('scopeId') || '';

    const profile = await db.guardrailProfile.findUnique({
      where: {
        scope_scopeId: {
          scope,
          scopeId,
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ success: true, versions: [] });
    }

    const versions = await db.guardrailVersion.findMany({
      where: { profileId: profile.id },
      orderBy: { version: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        diffSummary: v.diffSummary,
        savedBy: v.savedBy,
        savedAt: v.savedAt,
        config: JSON.parse(v.config),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

