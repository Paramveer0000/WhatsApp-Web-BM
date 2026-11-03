export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword, signToken, setSessionCookie } from '@/lib/auth';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Simple in-memory rate limiter for auth
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.expiresAt < now) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + 60000 }); // 1 minute window
    return true;
  }
  if (entry.count >= 10) {
    return false; // Exceeded 10 requests per minute
  }
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many login attempts. Please wait a minute.' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format.' }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // First run auto-create admin if zero users exist
    const userCount = await db.user.count();
    if (userCount === 0) {
      const passwordHash = await hashPassword(password);
      const newAdmin = await db.user.create({
        data: {
          email,
          passwordHash,
          name: 'Administrator',
          role: 'ADMIN',
        },
      });

      const token = signToken({
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: 'ADMIN',
      });

      const res = NextResponse.json({
        success: true,
        user: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name, role: newAdmin.role },
        message: 'Initial administrator account created successfully.',
      });
      setSessionCookie(res, token);
      return res;
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'ADMIN' | 'OPERATOR',
    });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    setSessionCookie(res, token);

    logger.info({ userId: user.id, email: user.email }, 'User logged in');
    return res;
  } catch (err: any) {
    logger.error({ err }, 'Login error');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

