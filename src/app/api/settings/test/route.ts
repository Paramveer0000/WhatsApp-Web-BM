export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { EvolutionClient } from '@/lib/evolution';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required to test API connections' }, { status: 403 });
    }

    const body = await req.json();
    let apiUrl = (body.apiUrl || '').trim();
    const apiKey = body.apiKey;

    if (apiUrl) {
      try {
        const parsed = new URL(apiUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json({ error: 'Invalid URL protocol. Only http and https are allowed.' }, { status: 400 });
        }
        if (parsed.hostname === '169.254.169.254' || parsed.hostname.startsWith('169.254.')) {
          return NextResponse.json({ error: 'Prohibited target address' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 });
      }
    }

    const client = apiUrl ? new EvolutionClient(apiUrl, apiKey || '') : await EvolutionClient.fromDatabase();

    const instances = await client.fetchInstances();

    return NextResponse.json({
      success: true,
      message: `Connected successfully! Found ${instances.length} instance(s).`,
      instancesCount: instances.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Connection failed',
      },
      { status: 400 }
    );
  }
}

