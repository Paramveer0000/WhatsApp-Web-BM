export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { registry } from '@/lib/metrics';

export async function GET() {
  try {
    const metrics = await registry.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': registry.contentType,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
