import { NextRequest, NextResponse } from 'next/server';

// ─── Middleware: Subdomain-based multi-tenant routing only ─────────────────────
//
// Auth protection is handled per-page via supabase.auth.getSession()
// DO NOT add cookie-based auth checks here — @supabase/ssr uses chunked
// cookies (sb-xxx-auth-token.0, .1 etc.) that are unreliable to check in
// middleware without the full SSR client.
//
// Routing logic:
//   roomlenspro.com            → landing page (/)
//   roomlenspro.com/dashboard  → main app (authenticated per-page)
//   acme.roomlenspro.com       → tenant staff app at /tenant/acme/*
//
export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';

  // Strip port for local dev
  const host = hostname.split(':')[0];

  // Known non-tenant hosts — pass through
  const rootHosts = [
    'roomlenspro.com',
    'www.roomlenspro.com',
    'roomlenspro.vercel.app',
    'localhost',
    '127.0.0.1',
  ];

  const isRootHost = rootHosts.some(h => host === h || host.endsWith('.vercel.app'));
  const isSubdomain = !isRootHost && host.endsWith('.roomlenspro.com');

  if (isSubdomain) {
    const slug = host.replace('.roomlenspro.com', '');
    if (url.pathname.startsWith('/tenant/')) {
      return NextResponse.next();
    }
    url.pathname = `/tenant/${slug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
