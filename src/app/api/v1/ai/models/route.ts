export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const models = [
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic', costTier: 'Ultra Low (~$0.80/M)', recommended: true },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', costTier: 'Ultra Low (~$0.15/M)', recommended: true },
    { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', provider: 'Google', costTier: 'Ultra Low (~$0.075/M)', recommended: true },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'Meta', costTier: 'Low (~$0.35/M)', recommended: false },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', costTier: 'Standard (~$3.00/M)', recommended: false },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', costTier: 'Standard (~$2.50/M)', recommended: false },
  ];

  return NextResponse.json({ success: true, models });
}

