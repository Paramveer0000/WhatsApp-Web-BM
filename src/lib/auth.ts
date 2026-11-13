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

const JWT_SECRET = resolveJwtSecret();
const COOKIE_NAME = 'wa_bulk_session';

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
  role: 'ADMIN' | 'OPERATOR';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserSession): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<UserSession | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function hasAnyUsers(): Promise<boolean> {
  try {
    const count = await db.user.count();
    return count > 0;
  } catch {
    return false;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  // Allow HTTP access (e.g. sslip.io or direct IP without SSL)
  // Only enforce secure cookies if COOKIE_SECURE is explicitly 'true'
  const isSecure = process.env.COOKIE_SECURE === 'true';

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie(response: NextResponse) {
  const isSecure = process.env.COOKIE_SECURE === 'true';

  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
