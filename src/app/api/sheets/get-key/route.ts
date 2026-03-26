// src/app/api/sheets/get-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, stores } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;

    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
    }

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db.select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, selectedStoreId)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener la API key de la tienda
    const [storeData] = await db.select({
      gsheets_api_key: stores.gsheets_api_key,
      store_id: stores.store_id,
    }).from(stores)
      .where(eq(stores.id, selectedStoreId))
      .limit(1);

    if (!storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      apiKey: storeData.gsheets_api_key || null,
      storeId: storeData.store_id || null
    });
  } catch (error) {
    console.error('Error getting sheets API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
