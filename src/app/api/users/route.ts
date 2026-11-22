export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'OPERATOR']).default('OPERATOR'),
});

// GET /api/users - List team users
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required' }, { status: 403 });
    }

    await ensureDbSchema();

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    logger.error({ err }, 'Error fetching team users');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/users - Create new team user account
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required' }, { status: 403 });
    }

    await ensureDbSchema();

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid user details. Email must be valid and password at least 6 characters.' },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: `User with email "${normalizedEmail}" already exists` }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name ? name.trim() : null,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    logger.info({ adminId: user.id, newUserId: newUser.id, email: newUser.email }, 'Admin created new team user');

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (err: any) {
    logger.error({ err }, 'Error creating team user');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/users - Delete a team user account
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required' }, { status: 403 });
    }

    await ensureDbSchema();

    const { searchParams } = new URL(req.url);
    let targetId = searchParams.get('id');
    if (!targetId) {
      const body = await req.json().catch(() => ({}));
      targetId = body.id;
    }

    if (!targetId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own active administrator account' }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting the only remaining admin
    if (targetUser.role === 'ADMIN') {
      const adminCount = await db.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last remaining administrator account' }, { status: 400 });
      }
    }

    await db.user.delete({ where: { id: targetId } });

    logger.info({ adminId: user.id, deletedUserId: targetId }, 'Admin deleted team user');

    return NextResponse.json({ success: true, message: 'User account removed successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error deleting team user');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
