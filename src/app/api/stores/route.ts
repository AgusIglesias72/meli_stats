// src/app/api/stores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, storeUsers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { cookies } from 'next/headers';

// Interfaces para tipar los datos
interface FormattedStore {
  id: string;
  store_id: string;
  name: string;
  ml_user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

// GET: Obtiene todas las tiendas a las que tiene acceso el usuario
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener todas las tiendas a las que tiene acceso el usuario
    const userStores = await db
      .select({
        id: storeUsers.id,
        role: storeUsers.role,
        store_id: stores.id,
        store_store_id: stores.store_id,
        store_name: stores.name,
        store_ml_user_id: stores.ml_user_id,
        store_created_at: stores.created_at,
        store_updated_at: stores.updated_at,
      })
      .from(storeUsers)
      .innerJoin(stores, eq(storeUsers.store_id, stores.id))
      .where(eq(storeUsers.user_id, authUserId))
      .orderBy(desc(storeUsers.created_at));

    // Formatear la respuesta
    const formattedStores: FormattedStore[] = userStores.map(item => ({
      id: item.store_id || '',
      store_id: item.store_store_id || '',
      name: item.store_name || '',
      ml_user_id: String(item.store_ml_user_id || ''),
      role: item.role || '',
      created_at: item.store_created_at?.toISOString() || '',
      updated_at: item.store_updated_at?.toISOString() || ''
    }));

    return NextResponse.json({
      stores: formattedStores
    });
  } catch (error) {
    console.error('Error processing stores request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
