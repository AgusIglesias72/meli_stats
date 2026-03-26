// src/app/api/sheets-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, items, trackedItemsConfig, trackedItemsData } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Obtener la API key del header de autorización
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    // Obtener el ID de la tienda desde los parámetros
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Verificar si la API key es válida para la tienda proporcionada
    const [storeData] = await db.select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.store_id, storeId), eq(stores.gsheets_api_key, apiKey)))
      .limit(1);

    if (!storeData) {
      return NextResponse.json({ error: 'Invalid API key or store ID' }, { status: 401 });
    }

    // Obtener el tipo de datos solicitados (items, tracked_items o ambos)
    const dataType = searchParams.get('type') || 'all';
    const response: any = { store_id: storeId };

    // Obtener items de la tienda si se solicitan
    if (dataType === 'all' || dataType === 'items') {
      const storeItems = await db.select({
        item_id: items.item_id,
        title: items.title,
        available_quantity: items.available_quantity,
        last_updated: items.last_updated,
        status: items.status,
        regular_amount: items.regular_amount,
        amount: items.amount,
        currency_id: items.currency_id,
        category_id: items.category_id,
        permalink: items.permalink,
      }).from(items)
        .where(eq(items.store_id, storeData.id))
        .orderBy(desc(items.last_updated));

      response.items = storeItems || [];
    }

    // Obtener los items trackeados y sus datos más recientes si se solicitan
    if (dataType === 'all' || dataType === 'tracked_items') {
      // Note: Drizzle doesn't support nested selects like Supabase's relational queries
      // in the same way. We need to do a separate query for tracked items data.
      const trackedConfigs = await db.select({
        id: trackedItemsConfig.id,
        item_id: trackedItemsConfig.item_id,
        notes: trackedItemsConfig.notes,
        created_at: trackedItemsConfig.created_at,
      }).from(trackedItemsConfig)
        .where(and(
          eq(trackedItemsConfig.store_id, storeData.id),
          eq(trackedItemsConfig.processing_status, 'success')
        ))
        .orderBy(desc(trackedItemsConfig.created_at));

      // For each tracked config, get the latest data
      const processedTrackedItems = await Promise.all(
        (trackedConfigs || []).map(async (config) => {
          const [latestData] = await db.select({
            id: trackedItemsData.id,
            title: trackedItemsData.title,
            status: trackedItemsData.status,
            thumbnail: trackedItemsData.thumbnail,
            permalink: trackedItemsData.permalink,
            regular_amount: trackedItemsData.regular_amount,
            amount: trackedItemsData.amount,
            currency_id: trackedItemsData.currency_id,
            seller_nickname: trackedItemsData.seller_nickname,
            brand: trackedItemsData.brand,
            last_updated: trackedItemsData.last_updated,
          }).from(trackedItemsData)
            .where(eq(trackedItemsData.config_id, config.id))
            .orderBy(desc(trackedItemsData.last_updated))
            .limit(1);

          return {
            id: config.id,
            item_id: config.item_id,
            notes: config.notes,
            created_at: config.created_at,
            data: latestData || null
          };
        })
      );

      response.tracked_items = processedTrackedItems;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing sheets data request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
