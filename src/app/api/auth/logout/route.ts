export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearSessionCookie(res);
  return res;
}
