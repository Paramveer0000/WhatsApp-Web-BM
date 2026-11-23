import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { db } from './db';
import { NextRequest, NextResponse } from 'next/server';

function resolveJwtSecret(): string {
  // 1. Explicit JWT_SECRET from environment
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET.trim();
  }

  // 2. Stable APP_SECRET from environment
  if (process.env.APP_SECRET && process.env.APP_SECRET.trim().length > 0) {
    return process.env.APP_SECRET.trim();
  }

  // 3. Persistent secret file stored in the persistent volume (/app/prisma)
  // Ensures secrets survive container rebuilds, redeploys, and worker process spawns!
  try {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const secretFile = path.join(prismaDir, '.jwt_secret');
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf8').trim();
      if (saved) return saved;
    }

    const generated = crypto.randomBytes(32).toString('hex');
    try {
      if (!fs.existsSync(prismaDir)) fs.mkdirSync(prismaDir, { recursive: true });
      fs.writeFileSync(secretFile, generated, 'utf8');
    } catch {}
    return generated;
  } catch {
    // 4. Stable deterministic production fallback
    return 'bulkflow-production-jwt-stable-secret-2026-v2';
  }
}

export const JWT_SECRET = resolveJwtSecret();
export const COOKIE_NAME = 'auth_token';
export const LEGACY_COOKIE_NAME = 'wa_bulk_session';

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
  role: 'ADMIN' | 'OPERATOR' | 'RESELLER' | 'CLIENT';
  clientId?: string | null;
  companyName?: string | null;
  planName?: string | null;
  maxInstances?: number;
  monthlyMsgCap?: number;
  hasCrmPipeline?: boolean;
  hasChatbot?: boolean;
  hasMultiWarmup?: boolean;
  hasDamMedia?: boolean;
  hasAiResponder?: boolean;
  isImpersonating?: boolean;
  originalAdminId?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserSession, expiresIn: string = process.env.JWT_EXPIRES_IN || '7d'): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId || null,
      companyName: user.companyName || null,
      planName: user.planName || null,
      maxInstances: user.maxInstances || null,
      monthlyMsgCap: user.monthlyMsgCap || null,
      hasCrmPipeline: user.hasCrmPipeline ?? true,
      hasChatbot: user.hasChatbot ?? true,
      hasMultiWarmup: user.hasMultiWarmup ?? true,
      hasDamMedia: user.hasDamMedia ?? true,
      hasAiResponder: user.hasAiResponder ?? false,
      isImpersonating: Boolean(user.isImpersonating),
      originalAdminId: user.originalAdminId || null,
    },
    JWT_SECRET,
    { expiresIn: expiresIn as any }
  );
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export { verifyTokenEdge } from './auth-edge';

export async function getSessionUser(req?: NextRequest | Request): Promise<UserSession | null> {
  try {
    // 1. Check Authorization: Bearer <token> header if req is provided
    if (req) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.substring(7).trim();
        const verified = verifyToken(bearerToken);
        if (verified) return verified;
      }

      // Check cookies on NextRequest
      if ('cookies' in req && req.cookies && typeof (req as NextRequest).cookies.get === 'function') {
        const cookieToken =
          (req as NextRequest).cookies.get('auth_token')?.value ||
          (req as NextRequest).cookies.get(COOKIE_NAME)?.value ||
          (req as NextRequest).cookies.get(LEGACY_COOKIE_NAME)?.value;
        if (cookieToken) {
          const verified = verifyToken(cookieToken);
          if (verified) return verified;
        }
      }
    }

    // 2. Next.js cookies() store
    const cookieStore = cookies();
    const token =
      cookieStore.get('auth_token')?.value ||
      cookieStore.get(COOKIE_NAME)?.value ||
      cookieStore.get(LEGACY_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Middleware helper for API route handlers to enforce JWT authentication.
 */
export async function authenticateJWT(
  req: NextRequest
): Promise<{ user: UserSession | null; errorResponse?: NextResponse }> {
  const user = await getSessionUser(req);
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Valid JWT authentication required' },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export async function hasAnyUsers(): Promise<boolean> {
  try {
    const count = await db.user.count();
    return count > 0;
  } catch {
    return false;
  }
}

export function setSessionCookie(response: NextResponse, token: string, rememberMe: boolean = true) {
  // Only enforce secure if explicitly set via COOKIE_SECURE=true.
  // This ensures cookies work reliably across both plain HTTP (e.g. http://zolosuit.org) and HTTPS.
  const isSecure = process.env.COOKIE_SECURE === 'true';
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7; // 30d if rememberMe, else 7d

  // Set primary 'auth_token' cookie as per specification
  response.cookies.set({
    name: 'auth_token',
    value: token,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  // Also set 'wa_bulk_session' for backwards compatibility
  response.cookies.set({
    name: LEGACY_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function clearSessionCookie(response: NextResponse) {
  const cookieNames = ['auth_token', COOKIE_NAME, LEGACY_COOKIE_NAME];
  for (const name of cookieNames) {
    try {
      response.cookies.delete(name);
    } catch {}
    response.cookies.set({
      name,
      value: '',
      httpOnly: true,
      secure: false, // Ensure deletion succeeds over both plain HTTP and HTTPS
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
