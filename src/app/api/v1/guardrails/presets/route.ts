export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { GUARDRAIL_PRESETS, GuardrailConfigSchema } from '@/lib/guardrails';

export async function GET() {
  try {
    const customPresets = await db.guardrailPreset.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const builtins = Object.entries(GUARDRAIL_PRESETS).map(([key, val]) => ({
      key,
      name: val.name,
      description: val.description,
      config: val.config,
      isBuiltin: true,
    }));

    const customs = customPresets.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      config: JSON.parse(p.config),
      isBuiltin: false,
    }));

    return NextResponse.json({
      success: true,
      presets: [...builtins, ...customs],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, config } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Preset name is required' }, { status: 400 });
    }

    const validatedConfig = GuardrailConfigSchema.parse(config);
    const key = `custom-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

    const created = await db.guardrailPreset.create({
      data: {
        key,
        name: name.trim(),
        description: description?.trim() || null,
        config: JSON.stringify(validatedConfig),
        isBuiltin: false,
      },
    });

    return NextResponse.json({
      success: true,
      preset: {
        ...created,
        config: validatedConfig,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Preset key is required' }, { status: 400 });
    }

    if (GUARDRAIL_PRESETS[key]) {
      return NextResponse.json({ error: 'Cannot delete built-in system presets' }, { status: 400 });
    }

    await db.guardrailPreset.delete({
      where: { key },
    });

    return NextResponse.json({ success: true, deletedKey: key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
