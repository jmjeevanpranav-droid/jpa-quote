import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/auth/tokens';

export async function proxy(req: NextRequest) {
  // 1. Strict Cross-Origin Request Forgery (CSRF) & Origin Defense
  const origin = req.headers.get('origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin requests are strictly prohibited' }, { status: 403 });
  }

  const { pathname } = req.nextUrl;

  // 2. Identify Public vs Protected Assets
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/jpa_favicon.svg') ||
    pathname.startsWith('/jpa-header-logo.png') ||
    pathname.startsWith('/fonts');

  if (isPublicAsset) {
    const res = NextResponse.next();
    applySecurityHeaders(res);
    return res;
  }

  const isAuthEndpoint =
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/register') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/auth/google') ||
    pathname.startsWith('/api/auth/me');

  const isLoginPage = pathname === '/login';

  // 3. Verify Signed User Session Token (Header priority over shared cookie)
  let token = req.headers.get('x-jpa-session-token') || undefined;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }
  if (!token) {
    token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  const session = token ? await verifySessionToken(token) : null;
  const isAuthenticated = !!session;
  const isAdmin = !!session && session.role === 'admin';

  // Allow test runners in isolated test environments
  const isTestRunner =
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.JPA_DATA_DIR && process.env.JPA_DATA_DIR.includes('jpa-test'));

  // 4. If Already Authenticated and Visiting /login, Redirect to Destination (unless explicit switch requested)
  const isSwitch = req.nextUrl.searchParams.get('switch') === 'true' || req.nextUrl.searchParams.get('account') !== null;
  if (isLoginPage && isAuthenticated && !isSwitch) {
    const target = req.nextUrl.searchParams.get('redirect') || '/';
    const redirectUrl = new URL(target.startsWith('/') ? target : '/', req.url);
    const res = NextResponse.redirect(redirectUrl);
    applySecurityHeaders(res);
    return res;
  }

  // Allow login page, public assets, and auth endpoints
  if (isLoginPage || isAuthEndpoint || isTestRunner) {
    const res = NextResponse.next();
    applySecurityHeaders(res);
    return res;
  }

  // 5. Require Authentication for All Other Pages & APIs
  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to access JPA portal' },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    const res = NextResponse.redirect(loginUrl);
    applySecurityHeaders(res);
    return res;
  }

  // 6. Role-Based Access Control: Restrict Administrator Portal APIs to Admin Only
  const isAdminOnlyEndpoint =
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/audit') ||
    pathname.startsWith('/api/products/reset-rates');

  if (isAdminOnlyEndpoint && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Administrator privileges required for this operation' },
      { status: 403 }
    );
  }

  // 7. Authorized Request: Inject Security Headers
  const res = NextResponse.next();
  applySecurityHeaders(res);
  return res;
}

function applySecurityHeaders(res: NextResponse) {
  // Enterprise-Grade Cybersecurity Headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()');
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com https://www.google.com; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://www.google.com https://generativelanguage.googleapis.com; frame-src 'self' https://accounts.google.com https://www.google.com; frame-ancestors 'none';"
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|jpa_favicon.svg|fonts/).*)'],
};
