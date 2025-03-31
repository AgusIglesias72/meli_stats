import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Durante desarrollo, podemos desactivar temporalmente la verificación de autenticación
  // para facilitar las pruebas
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    // En desarrollo, permitimos el acceso sin verificación
    return NextResponse.next();
  }
  
  // Verificar si el usuario está autenticado
  const authUserId = request.cookies.get('auth_user_id')?.value;
  const isAuthenticated = !!authUserId;
  
  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Guardar la URL original para redirigir después del login
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar si tiene una tienda seleccionada
  const selectedStoreId = request.cookies.get('selected_store_id')?.value;
  const hasSelectedStore = !!selectedStoreId;
  
  // Para algunas rutas, no es necesario tener una tienda seleccionada
  const noStoreRequiredRoutes = ['/admin/stores'];
  const currentPath = request.nextUrl.pathname;
  
  const requiresStore = !noStoreRequiredRoutes.some(route => currentPath.startsWith(route));
  
  // Si necesita una tienda seleccionada pero no la tiene, redirigir a la selección de tienda
  if (requiresStore && !hasSelectedStore) {
    const storeSelectionUrl = new URL('/admin/stores', request.url);
    return NextResponse.redirect(storeSelectionUrl);
  }

  return NextResponse.next();
}

// Aplicar este middleware solo a las rutas dentro de /admin
export const config = {
  matcher: '/admin/:path*',
};