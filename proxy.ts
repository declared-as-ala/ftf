import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function proxy(req: NextRequest) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    const { pathname } = req.nextUrl;
    const isAdminRoute = pathname.startsWith('/admin');
    const isClubRoute = pathname.startsWith('/club');
    const isAuthRoute = pathname === '/login';

    if (!isAuthRoute && (isAdminRoute || isClubRoute)) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const isLoggedIn = !!session;
  const isAdminRoute = pathname.startsWith('/admin');
  const isClubRoute = pathname.startsWith('/club');
  const isAuthRoute = pathname === '/login';

  if (isAuthRoute && isLoggedIn) {
    if (session?.user.role === 'FTF_ADMIN') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.redirect(new URL('/club', req.url));
  }

  if (!isLoggedIn && (isAdminRoute || isClubRoute)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAdminRoute && session?.user.role !== 'FTF_ADMIN') {
    return NextResponse.redirect(new URL('/club', req.url));
  }

  if (isClubRoute && session?.user.role !== 'CLUB_ADMIN') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
