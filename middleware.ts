// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que requieren autenticación
const protectedRoutes = ['/dashboard', '/connect-store', '/accept-invitation'];

// Rutas a las que no se puede acceder si ya está autenticado
const publicAuthRoutes = ['/login'];

// Rutas especiales que no requieren tienda seleccionada
const noStoreRequiredRoutes = ['/store-selection', '/connect-store', '/connect-callback', '/accept-invitation'];

export function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const authUserId = request.cookies.get('auth_user_id')?.value;
  const isAuthenticated = !!authUserId;
  const selectedStoreId = request.cookies.get('selected_store_id')?.value;
  
  // Si la ruta requiere autenticación y no está autenticado, redirigir al login
  if (protectedRoutes.some(route => currentPath.startsWith(route)) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Guardar la URL original para redirigir después del login
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Si es una ruta de autenticación pública y ya está autenticado, redirigir al dashboard
  if (publicAuthRoutes.includes(currentPath) && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Si está autenticado, requiere una tienda seleccionada y no tiene ninguna seleccionada,
  // y no está en una ruta especial (como selección de tienda), redirigir a selección de tienda
  if (
    isAuthenticated && 
    !selectedStoreId && 
    !noStoreRequiredRoutes.some(route => currentPath.startsWith(route)) && 
    !currentPath.startsWith('/api/')
  ) {
    const storeSelectionUrl = new URL('/store-selection', request.url);
    return NextResponse.redirect(storeSelectionUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rutas que requieren autenticación
    '/dashboard/:path*',
    '/connect-store',
    '/connect-callback',
    '/accept-invitation',
    '/store-selection',
    // Rutas públicas de autenticación
    '/login',
  ],
};