import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge, getJwtSecretEdge } from './lib/auth-edge';

// Public endpoints that bypass authentication checks
const PUBLIC_PATHS = [
  '/login',
  '/f',
  '/api/public',
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

  // 0. Security Guard: Immediately block attempts to probe or download environment files, git files, or databases
  const lowerPath = pathname.toLowerCase();
  if (
    lowerPath.includes('.env') ||
    lowerPath.includes('.git') ||
    lowerPath.includes('.ssh') ||
    lowerPath.endsWith('.db') ||
    lowerPath.endsWith('.sqlite') ||
    lowerPath.endsWith('.sql') ||
    lowerPath.endsWith('.key') ||
    lowerPath.endsWith('.pem') ||
    lowerPath.endsWith('.yml') ||
    lowerPath.endsWith('.yaml') ||
    lowerPath.includes('.secret') ||
    (lowerPath.endsWith('.json') && !lowerPath.startsWith('/_next') && !lowerPath.startsWith('/api'))
  ) {
    return new NextResponse('Forbidden: Access Denied', { status: 403 });
  }

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
    validUser = await verifyTokenEdge(token, getJwtSecretEdge());
  }

  // 3. Handle Login Page
  if (pathname === '/login') {
    // If logging out explicitly, clear cookies and allow rendering /login
    if (req.nextUrl.searchParams.get('logout') === 'true') {
      const res = NextResponse.next();
      res.cookies.delete('auth_token');
      res.cookies.delete('wa_bulk_session');
      res.cookies.set('auth_token', '', { path: '/', maxAge: 0, expires: new Date(0) });
      res.cookies.set('wa_bulk_session', '', { path: '/', maxAge: 0, expires: new Date(0) });
      return res;
    }

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
