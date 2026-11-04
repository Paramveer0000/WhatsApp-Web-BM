export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { OpenRouterClient } from '@/lib/advisor/openrouter';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const userMessage: string = (body.message || '').trim();
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body.history) ? body.history : [];

    if (!userMessage) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const run = await db.advisorRun.findUnique({
      where: { id: params.id },
      include: { recommendations: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const aiSettings = await db.aiSettings.findFirst();
    let apiKey = '';
    if (aiSettings?.apiKeyEncrypted) {
      try {
        apiKey = decrypt(aiSettings.apiKeyEncrypted);
      } catch {}
    }

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        reply: `Advisor is currently operating in offline rule-based mode. Based on run #${run.id.slice(0, 8)}, the recommendations were generated deterministically based on observed delivery failure rate. To enable contextual AI reasoning chat, configure an OpenRouter API key in Settings > AI.`,
      });
    }

    const client = new OpenRouterClient({
      apiKey,
      model: aiSettings?.model || 'anthropic/claude-3.5-haiku',
      temperature: 0.3,
      timeoutMs: 20000,
    });

    const parsedOutput = JSON.parse(run.output || '{}');

    const reply = await client.answerFollowUpQuestion({
      runContext: {
        healthRating: parsedOutput.overall_assessment?.health || 'good',
        healthSummary: parsedOutput.overall_assessment?.summary || '',
        keyFindings: parsedOutput.key_findings || [],
        recommendations: run.recommendations.map((r) => ({
          field_path: r.fieldPath,
          current_value: JSON.parse(r.currentValue),
          suggested_value: JSON.parse(r.suggestedValue),
          rationale: r.rationale,
        })),
        analyticsSummary: JSON.parse(run.inputSummary || '{}'),
      },
      userQuestion: userMessage,
      chatHistory: history,
    });

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in advisor chat endpoint');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
