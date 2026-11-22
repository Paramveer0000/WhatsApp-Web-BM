export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { verifyPassword, hashPassword, signToken, setSessionCookie } from '@/lib/auth';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rememberMe: z.boolean().optional(),
});

// Brute-force protection: max 5 failed attempts per 15 minutes per IP
const FAILED_ATTEMPTS_LIMIT = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface FailedAttemptRecord {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil: number;
}

const failedAttemptsMap = new Map<string, FailedAttemptRecord>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

function checkRateLimit(ip: string): { allowed: boolean; remainingLockoutSec?: number } {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);
  if (!record) return { allowed: true };

  // If locked out
  if (record.lockedUntil > now) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingLockoutSec: remainingSec };
  }

  // If lockout expired or window passed, reset
  if (now - record.firstFailedAt > LOCKOUT_WINDOW_MS) {
    failedAttemptsMap.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);

  if (!record || now - record.firstFailedAt > LOCKOUT_WINDOW_MS) {
    failedAttemptsMap.set(ip, {
      failedCount: 1,
      firstFailedAt: now,
      lockedUntil: 0,
    });
    return;
  }

  record.failedCount += 1;
  if (record.failedCount >= FAILED_ATTEMPTS_LIMIT) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
    logger.warn({ ip, attempts: record.failedCount }, 'IP locked out due to excessive failed login attempts');
  }
}

function resetFailedAttempts(ip: string): void {
  failedAttemptsMap.delete(ip);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please try again after ${Math.ceil(
            (rateCheck.remainingLockoutSec || 900) / 60
          )} minutes.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format.' }, { status: 400 });
    }

    const { email, password, rememberMe = true } = parsed.data;
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

      resetFailedAttempts(ip);

      const res = NextResponse.json({
        success: true,
        user: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name, role: newAdmin.role },
        token,
        message: 'Initial administrator account created successfully.',
      });
      setSessionCookie(res, token, rememberMe);
      return res;
    }

    // 1. Check Platform / Reseller Users (Tier 1 & Tier 2)
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        recordFailedAttempt(ip);
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      resetFailedAttempts(ip);

      const token = signToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: (user.role as any) || 'ADMIN',
      });

      const res = NextResponse.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      });
      setSessionCookie(res, token, rememberMe);

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
        recordFailedAttempt(ip);
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      resetFailedAttempts(ip);

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
        token,
      });
      setSessionCookie(res, token, rememberMe);

      logger.info({ clientId: client.id, email: client.ownerEmail, company: client.companyName }, 'Client logged in');
      return res;
    }

    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  } catch (err: any) {
    logger.error({ err }, 'Login error');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
