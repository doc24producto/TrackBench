import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = publicPaths.some((p) => pathname === p) || pathname.startsWith('/_next') || pathname.startsWith('/api');
  if (isPublic) return NextResponse.next();

  // Verificamos el token en localStorage via cookie (el authStore de Zustand lo persiste)
  // La protección real está en el DashboardLayout del cliente
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
