import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/reservar') ||
    pathname.startsWith('/reserva/') ||
    pathname.startsWith('/sucursal/') ||
    pathname.startsWith('/api/');

  if (!isLoggedIn && !isPublic) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/courts', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
