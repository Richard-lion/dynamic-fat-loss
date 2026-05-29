import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPaths = ['/', '/analytics'];
  const isProtected = protectedPaths.includes(pathname);

  // Accept token from cookie OR Authorization header
  const cookieToken = request.cookies.get('fl_token');
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken ?? bearerToken;

  if (!token && isProtected) {
    // No token found — check if there's a fl_token in localStorage by redirecting to a
    // client-side check page that can read localStorage and redirect properly.
    // For now, redirect to /login (most common case: hard nav without session).
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};