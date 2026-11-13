export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
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
    const normalizedEmail = email.toLowerCase().trim();

    await ensureDbSchema();

    // First run auto-create admin if zero users exist
    const userCount = await db.user.count();
    if (userCount === 0) {
      const passwordHash = await hashPassword(password);
      const newAdmin = await db.user.create({
        data: {
          email: normalizedEmail,
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

    // 1. Check Platform / Reseller Users (Tier 1 & Tier 2)
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: (user.role as any) || 'ADMIN',
      });

      const res = NextResponse.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
      setSessionCookie(res, token);

      logger.info({ userId: user.id, email: user.email, role: user.role }, 'User logged in');
      return res;
    }

    // 2. Check Reseller SaaS Business Clients (Tier 3)
    const client = await db.resellerClient.findUnique({
      where: { ownerEmail: normalizedEmail },
    });

    if (client) {
      if (client.status === 'SUSPENDED') {
        return NextResponse.json(
          { error: 'Your account has been suspended by the administrator. Please contact support.' },
          { status: 403 }
        );
      }

      const isMatch = await verifyPassword(password, client.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const token = signToken({
        id: client.id,
        email: client.ownerEmail,
        name: client.ownerName,
        role: 'CLIENT',
        clientId: client.id,
        companyName: client.companyName,
        planName: client.planName,
        maxInstances: client.maxInstances,
        monthlyMsgCap: client.monthlyMsgCap,
        hasCrmPipeline: client.hasCrmPipeline,
        hasChatbot: client.hasChatbot,
        hasMultiWarmup: client.hasMultiWarmup,
        hasDamMedia: client.hasDamMedia,
        hasAiResponder: client.hasAiResponder,
      });

      const res = NextResponse.json({
        success: true,
        user: {
          id: client.id,
          email: client.ownerEmail,
          name: client.ownerName,
          role: 'CLIENT',
          companyName: client.companyName,
          planName: client.planName,
          maxInstances: client.maxInstances,
          monthlyMsgCap: client.monthlyMsgCap,
        },
      });
      setSessionCookie(res, token);

      logger.info({ clientId: client.id, email: client.ownerEmail, company: client.companyName }, 'Client logged in');
      return res;
    }

    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  } catch (err: any) {
    logger.error({ err }, 'Login error');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
