// src/app/api/sheets/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, stores, items, trackedItemsConfig } from '@/lib/db/schema';
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

    // Obtener información de la tienda
    const [storeData] = await db.select({
      gsheets_api_key: stores.gsheets_api_key,
      store_id: stores.store_id,
    }).from(stores)
      .where(eq(stores.id, selectedStoreId))
      .limit(1);

    if (!storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!storeData.gsheets_api_key) {
      return NextResponse.json({ error: 'API key not generated' }, { status: 400 });
    }

    // Obtener datos de prueba para verificar que todo funciona
    const testItems = await db.select({
      id: items.id,
      item_id: items.item_id,
      title: items.title,
    }).from(items)
      .where(eq(items.store_id, selectedStoreId))
      .limit(5);

    const trackedItems = await db.select({
      id: trackedItemsConfig.id,
      item_id: trackedItemsConfig.item_id,
      notes: trackedItemsConfig.notes,
    }).from(trackedItemsConfig)
      .where(eq(trackedItemsConfig.store_id, selectedStoreId))
      .limit(5);

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      storeId: storeData.store_id,
      items: testItems,
      tracked_items: trackedItems
    });
  } catch (error) {
    console.error('Error testing sheets connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
