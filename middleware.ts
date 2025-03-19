import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que requieren autenticación
const protectedRoutes = ['/dashboard'];

// Rutas a las que no se puede acceder si ya está autenticado
const publicAuthRoutes = ['/login'];

export function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const mlUserId = request.cookies.get('ml_user_id')?.value;
  const isAuthenticated = !!mlUserId;

  // Si la ruta requiere autenticación y no está autenticado, redirigir al login
  if (protectedRoutes.some(route => currentPath.startsWith(route)) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si es una ruta de autenticación pública y ya está autenticado, redirigir al dashboard
  if (publicAuthRoutes.includes(currentPath) && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rutas que requieren autenticación
    '/dashboard/:path*',
    // Rutas públicas de autenticación
    '/login',
  ],
};