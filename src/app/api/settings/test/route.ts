import { NextRequest, NextResponse } from 'next/server';
import { EvolutionClient } from '@/lib/evolution';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const apiUrl = body.apiUrl;
    const apiKey = body.apiKey;

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

