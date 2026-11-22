export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hasAnyUsers } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const initialized = await hasAnyUsers();

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Unauthorized',
          initialized,
          user: null,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user,
      initialized,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        authenticated: false,
        error: err.message || 'Unauthorized',
        initialized: false,
        user: null,
      },
      { status: 401 }
    );
  }
}
