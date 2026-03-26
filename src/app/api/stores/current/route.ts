// src/app/api/stores/current/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, storeUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// GET: Obtiene la información de la tienda actual seleccionada
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda seleccionada de las cookies
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;

    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 404 });
    }

    // Verificar que el usuario tiene acceso a esta tienda y obtener el rol
    const [storeAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, selectedStoreId)))
      .limit(1);

    console.log('storeAccess', storeAccess);

    if (!storeAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener información básica de la tienda
    const [storeInfo] = await db
      .select({ id: stores.id, name: stores.name, store_id: stores.store_id, ml_user_id: stores.ml_user_id })
      .from(stores)
      .where(eq(stores.id, selectedStoreId))
      .limit(1);

    if (!storeInfo) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      store: {
        id: storeInfo.id,
        name: storeInfo.name,
        store_id: storeInfo.store_id
      },
      role: storeAccess.role
    });
  } catch (error) {
    console.error('Error fetching current store:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
