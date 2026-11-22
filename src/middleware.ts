import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge, JWT_SECRET } from './lib/auth';

// Public endpoints that bypass authentication checks
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
  '/api/ready',
  '/api/webhooks',
  '/api/media',
  '/api/docs',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass static files and Next.js internal bundles
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // Static files like favicon.ico, images, fonts
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Extract JWT token from cookie or Authorization header
  let token =
    req.cookies.get('auth_token')?.value ||
    req.cookies.get('wa_bulk_session')?.value;

  if (!token) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  // Verify token
  let validUser = null;
  if (token) {
    validUser = await verifyTokenEdge(token, JWT_SECRET);
  }

  // 3. Handle Login Page
  if (pathname === '/login') {
    // If already authenticated, redirect straight to dashboard
    if (validUser) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 4. Handle other Public Paths
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isPublic) {
    return NextResponse.next();
  }

  // 5. Handle Protected API Routes
  if (pathname.startsWith('/api/')) {
    if (!validUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Valid JWT session or Bearer token required',
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 6. Handle Protected UI Routes (Dashboard, Campaigns, Settings, etc.)
  if (!validUser) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
