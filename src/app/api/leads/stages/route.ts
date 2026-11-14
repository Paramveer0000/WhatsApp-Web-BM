export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export interface WorkflowStageItem {
  id: string;
  key: string;
  label: string;
  color: string;
  winRate: number;
  isWon?: boolean;
  isLost?: boolean;
}

const DEFAULT_STAGES: WorkflowStageItem[] = [
  { id: 'NEW_LEAD', key: 'NEW_LEAD', label: 'New Lead', color: '#3b82f6', winRate: 10, isWon: false, isLost: false },
  { id: 'CONTACTED', key: 'CONTACTED', label: 'Contacted', color: '#6366f1', winRate: 25, isWon: false, isLost: false },
  { id: 'QUALIFIED', key: 'QUALIFIED', label: 'Qualified', color: '#a855f7', winRate: 50, isWon: false, isLost: false },
  { id: 'PROPOSAL', key: 'PROPOSAL', label: 'Proposal', color: '#f97316', winRate: 70, isWon: false, isLost: false },
  { id: 'WON', key: 'WON', label: 'Won', color: '#10b981', winRate: 100, isWon: true, isLost: false },
];

// GET /api/leads/stages - Retrieve current pipeline details and stages
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const config = await db.pipelineStageConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    let stages: WorkflowStageItem[] = DEFAULT_STAGES;
    if (config?.stages) {
      try {
        const parsed = JSON.parse(config.stages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stages = parsed;
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      pipelineName: config?.pipelineName || 'Falcon',
      description: config?.description || 'Configure sales stages, colors, and win probabilities',
      stages,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/leads/stages');
    return NextResponse.json({ error: err.message || 'Failed to fetch pipeline stages' }, { status: 500 });
  }
}

// POST /api/leads/stages - Update pipeline name, description, and workflow stages
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const pipelineName = String(body.pipelineName || 'Falcon').trim();
    const description = body.description ? String(body.description).trim() : null;
    const stages = Array.isArray(body.stages) && body.stages.length > 0 ? body.stages : DEFAULT_STAGES;

    const existing = await db.pipelineStageConfig.findFirst();

    let saved;
    if (existing) {
      saved = await db.pipelineStageConfig.update({
        where: { id: existing.id },
        data: {
          pipelineName,
          description,
          stages: JSON.stringify(stages),
        },
      });
    } else {
      saved = await db.pipelineStageConfig.create({
        data: {
          pipelineName,
          description,
          stages: JSON.stringify(stages),
        },
      });
    }

    return NextResponse.json({
      success: true,
      pipelineName: saved.pipelineName,
      description: saved.description,
      stages,
      message: 'Pipeline configuration saved successfully',
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/leads/stages');
    return NextResponse.json({ error: err.message || 'Failed to save pipeline configuration' }, { status: 500 });
  }
}

