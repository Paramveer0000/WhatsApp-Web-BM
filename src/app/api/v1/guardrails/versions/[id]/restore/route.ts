export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { invalidateGuardrailCache } from '@/lib/guardrails';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const versionRecord = await db.guardrailVersion.findUnique({
      where: { id: params.id },
    });

    if (!versionRecord) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const profile = await db.guardrailProfile.findUnique({
      where: { id: versionRecord.profileId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const nextVersion = profile.version + 1;

    // Restore config
    const updated = await db.guardrailProfile.update({
      where: { id: profile.id },
      data: {
        config: versionRecord.config,
        version: nextVersion,
        updatedBy: user.email,
      },
    });

    // Record snapshot of restoration
    await db.guardrailVersion.create({
      data: {
        profileId: profile.id,
        version: nextVersion,
        config: versionRecord.config,
        diffSummary: `Restored to version ${versionRecord.version}`,
        savedBy: user.email,
      },
    });

    invalidateGuardrailCache();

    return NextResponse.json({
      success: true,
      profile: {
        ...updated,
        config: JSON.parse(updated.config),
      },
      restoredFromVersion: versionRecord.version,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
