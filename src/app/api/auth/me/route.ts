import { NextResponse } from 'next/server';
import { getSessionUser, hasAnyUsers } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    const initialized = await hasAnyUsers();

    return NextResponse.json({
      authenticated: Boolean(user),
      user: user || null,
      initialized,
    });
  } catch (err: any) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      initialized: false,
    });
  }
}
