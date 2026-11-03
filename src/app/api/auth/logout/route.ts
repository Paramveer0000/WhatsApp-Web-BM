import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionUser } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logged out' });
  clearSessionCookie(res);
  return res;
}

