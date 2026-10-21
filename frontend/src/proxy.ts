import { NextResponse, type NextRequest } from 'next/server';

/**
 * UX-only gate: if there is no session cookie at all, send the visitor to /login instead of rendering
 * an empty protected shell. It does NOT authorise anything — the API validates the session and role on
 * every request, and the client re-checks the role before rendering role-specific pages.
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Per-request nonce CSP: only scripts that Next.js stamps with the nonce may run ('strict-dynamic' lets those
 * load their own chunks). Inline styles stay allowed because React renders `style=""` attributes
 * (CSS cannot execute script; see PROJECT_STATUS.md).
 */
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'" + (isDev ? ' ws:' : ''),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const SESSION_COOKIES = ['lms_sid', '__Host-lms_sid'];
const PROTECTED = ['/student', '/instructor', '/admin', '/learn', '/profile', '/dashboard'];

export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const { pathname, search } = req.nextUrl;
  const needsSession = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (needsSession && !SESSION_COOKIES.some((c) => req.cookies.has(c))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
