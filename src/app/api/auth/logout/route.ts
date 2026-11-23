export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearSessionCookie(res);
  return res;
}

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login?logout=true', req.url));
  clearSessionCookie(res);
  return res;
}
