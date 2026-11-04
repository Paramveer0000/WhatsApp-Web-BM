export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  GuardrailConfigSchema,
  DEFAULT_GUARDRAIL_CONFIG,
  calculateRiskScore,
  resolveEffectiveConfig,
  getEffectiveGuardrails,
  invalidateGuardrailCache,
} from '@/lib/guardrails';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get('scope') || 'global') as 'global' | 'instance' | 'campaign';
    const scopeId = searchParams.get('scopeId') || '';

    // Fetch raw profile
    const profile = await db.guardrailProfile.findUnique({
      where: {
        scope_scopeId: {
          scope,
          scopeId,
        },
      },
    });

    const parsedRawConfig = profile ? JSON.parse(profile.config) : null;

    // Get effective resolved config
    const effectiveResult = await getEffectiveGuardrails({
      scope,
      scopeId,
      instanceName: scope === 'instance' ? scopeId : undefined,
      campaignId: scope === 'campaign' ? scopeId : undefined,
    });

    const risk = calculateRiskScore(effectiveResult.effective);

    return NextResponse.json({
      success: true,
      profile: profile ? {
        ...profile,
        config: parsedRawConfig,
      } : null,
      effective: effectiveResult.effective,
      sources: effectiveResult.sources,
      strictMode: effectiveResult.strictMode,
      version: profile?.version || 1,
      risk,
      userRole: user.role,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required to modify anti-ban guardrails' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const scope = (body.scope || 'global') as 'global' | 'instance' | 'campaign';
    const scopeId = body.scopeId || '';
    const presetKey = body.presetKey || 'custom';
    const strictMode = Boolean(body.strictMode);
    const expectedVersion = Number(body.version || 1);
    const diffSummary = body.diffSummary || 'Updated guardrail settings';

    // Validate with Zod
    const validatedConfig = GuardrailConfigSchema.parse(body.config);

    // Optimistic Concurrency Check
    const existing = await db.guardrailProfile.findUnique({
      where: {
        scope_scopeId: {
          scope,
          scopeId,
        },
      },
    });

    if (existing && existing.version > expectedVersion) {
      return NextResponse.json(
        {
          error: 'Concurrency Conflict: This profile was updated by another administrator. Please refresh and review changes.',
          serverVersion: existing.version,
        },
        { status: 409 }
      );
    }

    const nextVersion = existing ? existing.version + 1 : 1;

    // Upsert Profile
    const profile = await db.guardrailProfile.upsert({
      where: {
        scope_scopeId: {
          scope,
          scopeId,
        },
      },
      create: {
        scope,
        scopeId,
        presetKey,
        config: JSON.stringify(validatedConfig),
        strictMode,
        version: nextVersion,
        updatedBy: user.email,
      },
      update: {
        presetKey,
        config: JSON.stringify(validatedConfig),
        strictMode,
        version: nextVersion,
        updatedBy: user.email,
      },
    });

    // Create historical version snapshot
    await db.guardrailVersion.create({
      data: {
        profileId: profile.id,
        version: nextVersion,
        config: JSON.stringify(validatedConfig),
        diffSummary,
        savedBy: user.email,
      },
    });

    // Invalidate Cache
    invalidateGuardrailCache();

    // Audit Log
    await db.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'GUARDRAILS_UPDATE',
        entity: 'GUARDRAIL',
        entityId: profile.id,
        details: JSON.stringify({
          scope,
          scopeId,
          presetKey,
          version: nextVersion,
          diffSummary,
        }),
      },
    });

    const risk = calculateRiskScore(validatedConfig);

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        config: validatedConfig,
      },
      version: nextVersion,
      risk,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

