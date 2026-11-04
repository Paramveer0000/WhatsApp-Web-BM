export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { POST as handleControl } from '../control/route';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const modifiedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ action: 'RESUME' }),
  });
  return handleControl(modifiedReq, { params });
}
