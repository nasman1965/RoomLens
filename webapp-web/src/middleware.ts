import { NextRequest, NextResponse } from 'next/server';

// ─── Middleware: Subdomain-based multi-tenant routing ──────────────────────────
//
// Routing logic:
//   roomlenspro.com            → landing page (/)
//   roomlenspro.com/dashboard  → main app (authenticated)
//   roomlenspro.com/super-admin → super admin panel
//   acme.roomlenspro.com       → tenant staff app at /tenant/acme/*
//   localhost:3000             → main app (dev)
//
export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';

  // Strip port for local dev
  const host = hostname.split(':')[0];

  // Known non-tenant hosts
  const rootHosts = [
    'roomlenspro.com',
    'www.roomlenspro.com',
    'roomlenspro.vercel.app',
    'localhost',
    '127.0.0.1',
  ];

  // Check if this is a subdomain request
  const isRootHost = rootHosts.some(h => host === h || host.endsWith('.vercel.app'));
  const isSubdomain = !isRootHost && host.endsWith('.roomlenspro.com');

  if (isSubdomain) {
    // Extract slug: "acme.roomlenspro.com" → "acme"
    const slug = host.replace('.roomlenspro.com', '');

    // Skip if already rewriting (avoid infinite loop)
    if (url.pathname.startsWith('/tenant/')) {
      return NextResponse.next();
    }

    // Rewrite to /tenant/[slug]/... internally
    url.pathname = `/tenant/${slug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── Protect /dashboard, /jobs, /photos etc. ──────────────────────────────
  const protectedPaths = [
    '/dashboard', '/jobs', '/photos', '/floorplans',
    '/moisture', '/equipment', '/reports', '/settings',
    '/super-admin',
  ];
  const isProtected = protectedPaths.some(p => url.pathname.startsWith(p));

  if (isProtected) {
    // Check for Supabase session cookie
    const sessionCookie = req.cookies.get('sb-ilxojqefffravkjxyqlx-auth-token')?.value
      || req.cookies.get('sb-access-token')?.value
      || req.cookies.getAll().find(c => c.name.includes('auth-token'))?.value;

    if (!sessionCookie) {
      url.pathname = '/login';
      // Never set ?redirect to /super-admin — always fall back to /dashboard
      const intendedPath = req.nextUrl.pathname;
      const safeRedirect = intendedPath.startsWith('/super-admin') ? '/dashboard' : intendedPath;
      url.searchParams.set('redirect', safeRedirect);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
