export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, signToken, setSessionCookie } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST /api/reseller/clients/[id]/impersonate - Step into client account with 1 click
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 });
    }

    await ensureDbSchema();

    const client = await db.resellerClient.findUnique({
      where: { id: params.id },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.status === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Cannot impersonate a suspended client. Please activate the account first.' },
        { status: 400 }
      );
    }

    // Generate impersonation token
    const impersonatedToken = signToken({
      id: client.id,
      email: client.ownerEmail,
      name: `${client.ownerName} (${client.companyName})`,
      role: 'ADMIN',
    });

    const res = NextResponse.json({
      success: true,
      message: `Impersonating ${client.companyName}`,
      client: {
        id: client.id,
        companyName: client.companyName,
        ownerEmail: client.ownerEmail,
        planName: client.planName,
      },
    });

    // Set active session cookie
    setSessionCookie(res, impersonatedToken);

    logger.info(
      { adminId: user.id, clientId: client.id, clientEmail: client.ownerEmail },
      'Admin initiated client impersonation'
    );

    return res;
  } catch (err: any) {
    logger.error({ err }, 'Error in client impersonation');
    return NextResponse.json({ error: err.message || 'Failed to impersonate client' }, { status: 500 });
  }
}
