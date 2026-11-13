export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, signToken, setSessionCookie } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/reseller/exit-impersonation - Step out of client account back to Admin / Reseller
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !user.isImpersonating || !user.originalAdminId) {
      return NextResponse.json(
        { error: 'No active client impersonation session found' },
        { status: 400 }
      );
    }

    await ensureDbSchema();

    const admin = await db.user.findUnique({
      where: { id: user.originalAdminId },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Original administrator account not found' },
        { status: 404 }
      );
    }

    // Re-sign admin token
    const adminToken = signToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: (admin.role as any) || 'ADMIN',
    });

    const res = NextResponse.json({
      success: true,
      message: 'Exited client impersonation. Welcome back, Administrator.',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });

    setSessionCookie(res, adminToken);

    logger.info(
      { adminId: admin.id, exitedClientId: user.clientId },
      'Admin exited client impersonation session'
    );

    return res;
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/reseller/exit-impersonation');
    return NextResponse.json({ error: err.message || 'Failed to exit impersonation' }, { status: 500 });
  }
}

