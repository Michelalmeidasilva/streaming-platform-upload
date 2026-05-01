import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { evaluateRateLimit } from '@/lib/security/rate-limit';
import { recordSecurityEvent } from '@/lib/security/audit';

function getClientKey(request: NextRequest, tokenEmail?: string | null) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown-ip';
  return tokenEmail || ip;
}

function rateLimitFor(pathname: string) {
  if (pathname.startsWith('/api/auth')) {
    return { limit: 10, windowMs: 60_000 };
  }

  if (pathname.startsWith('/api/upload')) {
    return { limit: 8, windowMs: 60_000 };
  }

  if (pathname.startsWith('/api/videos')) {
    return { limit: 30, windowMs: 60_000 };
  }

  return { limit: 60, windowMs: 60_000 };
}

function isProtectedApi(pathname: string) {
  return pathname.startsWith('/api/upload') || pathname.startsWith('/api/videos');
}

function isAdminMutation(pathname: string, method: string) {
  return pathname.startsWith('/api/upload') || (pathname.startsWith('/api/videos/') && ['PATCH', 'DELETE'].includes(method));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const isAuthRoute = pathname.startsWith('/api/auth');
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || 'development-secret' });
  const key = `${pathname}:${method}:${getClientKey(request, token?.email || null)}`;
  const rateLimit = evaluateRateLimit(key, rateLimitFor(pathname));

  if (!rateLimit.allowed) {
    recordSecurityEvent({
      type: 'rate_limited',
      route: pathname,
      method,
      reason: 'rate_limit_exceeded',
      status: 429,
      email: token?.email || null,
      role: token?.role || null,
    });

    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter),
        },
      },
    );
  }

  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (isProtectedApi(pathname) && !token) {
    recordSecurityEvent({
      type: 'access_denied',
      route: pathname,
      method,
      reason: 'missing_session',
      status: 401,
      email: null,
      role: null,
    });

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isAdminMutation(pathname, method) && token?.role !== 'ADMIN') {
    recordSecurityEvent({
      type: 'access_denied',
      route: pathname,
      method,
      reason: 'insufficient_role',
      status: 403,
      email: token?.email || null,
      role: token?.role || null,
    });

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};

