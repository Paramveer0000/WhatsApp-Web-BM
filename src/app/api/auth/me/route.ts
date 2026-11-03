import { NextResponse } from 'next/server';
import { getSessionUser, hasAnyUsers } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  const initialized = await hasAnyUsers();

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user || null,
    initialized,
  });
}

