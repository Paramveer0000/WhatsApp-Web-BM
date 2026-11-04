export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { POST as handleWebhook } from '../route';

export async function POST(req: NextRequest, { params }: { params: { instanceId: string } }) {
  return handleWebhook(req, { params });
}
