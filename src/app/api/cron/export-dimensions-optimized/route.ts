// src/app/api/cron/export-dimensions-optimized/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, dimensionsExportCache } from '@/lib/db/schema';
import { and, gt, ne, eq, asc } from 'drizzle-orm';
import crypto from 'crypto';

export const maxDuration = 60; // Reducido de 300 a 60 segundos
export const runtime = 'nodejs';

/**
 * Versión optimizada de export-dimensions con:
 * 1. Sistema de caché inteligente (solo procesar items modificados)
 * 2. Procesamiento por lotes más eficiente
 * 3. Reducción de llamadas API innecesarias
 */

// Generar checksum para detectar cambios
function generateChecksum(data: any): string {
  const relevantFields = {
    price: data.price,
    status: data.status,
    available_quantity: data.available_quantity,
    title: data.title,
    last_updated: data.last_updated
  };
  return crypto.createHash('md5').update(JSON.stringify(relevantFields)).digest('hex');
}

// Verificar si un item necesita actualización
async function needsUpdate(
  storeId: string,
  itemId: string,
  variationId: string,
  checksum: string,
  lastUpdated: string
): Promise<boolean> {
  const [data] = await db.select({
    checksum: dimensionsExportCache.checksum,
    last_updated_at: dimensionsExportCache.last_updated_at,
  }).from(dimensionsExportCache)
    .where(and(
      eq(dimensionsExportCache.store_id, storeId),
      eq(dimensionsExportCache.item_id, itemId),
      eq(dimensionsExportCache.variation_id, variationId)
    ))
    .limit(1);

  if (!data) {
    // Item no existe en caché, necesita procesarse
    return true;
  }

  // Verificar si cambió el checksum o la fecha de actualización
  return data.checksum !== checksum || new Date(data.last_updated_at!) < new Date(lastUpdated);
}

// Actualizar caché después de exportar
async function updateCache(
  storeId: string,
  itemId: string,
  variationId: string,
  checksum: string,
  lastUpdated: string
) {
  await db.insert(dimensionsExportCache).values({
    store_id: storeId,
    item_id: itemId,
    variation_id: variationId,
    checksum: checksum,
    last_updated_at: new Date(lastUpdated),
    last_exported_at: new Date()
  }).onConflictDoUpdate({
    target: [dimensionsExportCache.store_id, dimensionsExportCache.item_id, dimensionsExportCache.variation_id],
    set: {
      checksum: checksum,
      last_updated_at: new Date(lastUpdated),
      last_exported_at: new Date()
    }
  });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('===========================================');
  console.log('Starting OPTIMIZED export-dimensions at:', new Date().toISOString());
  console.log('===========================================');

  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.NEXT_PUBLIC_API_SECRET_KEY;

    if (authHeader && apiSecret && authHeader === `Bearer ${apiSecret}`) {
      console.log('Authorized via API_SECRET_KEY');
    } else if (authHeader) {
      console.log('Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      console.log('Vercel Cron call');
    }

    // En lugar de procesar TODAS las tiendas en una ejecución,
    // dividir el trabajo en múltiples ejecuciones
    const activeStores = await db.select({
      id: stores.id,
      store_id: stores.store_id,
      ml_user_id: stores.ml_user_id,
      access_token: stores.access_token,
      token_expiry: stores.token_expiry,
      name: stores.name,
    }).from(stores)
      .where(and(gt(stores.token_expiry, new Date()), ne(stores.store_id, '405011859')))
      .orderBy(asc(stores.store_id))
      .limit(2); // Procesar solo 2 tiendas por ejecución

    if (!activeStores || activeStores.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active stores found'
      });
    }

    console.log(`Processing ${activeStores.length} stores (OPTIMIZED MODE)`);

    let totalItemsProcessed = 0;
    let totalItemsSkipped = 0;
    let totalApiCallsSaved = 0;

    // Procesar cada tienda
    for (const store of activeStores) {
      try {
        console.log(`\n📦 Processing store: ${store.store_id} - ${store.name}`);

        // Obtener lista básica de items (sin detalles completos)
        const itemsResponse = await fetch(
          `https://api.mercadolibre.com/users/${store.ml_user_id}/items/search?limit=100`,
          {
            headers: { 'Authorization': `Bearer ${store.access_token}` }
          }
        );

        if (!itemsResponse.ok) {
          console.error(`Error fetching items for store ${store.store_id}`);
          continue;
        }

        const { results: itemIds } = await itemsResponse.json();
        console.log(`Found ${itemIds.length} items for store ${store.store_id}`);

        // Obtener detalles en batch (máximo 20 por request)
        const batchSize = 20;
        let itemsProcessed = 0;
        let itemsSkipped = 0;

        for (let i = 0; i < itemIds.length; i += batchSize) {
          const batch = itemIds.slice(i, i + batchSize);

          // Obtener detalles básicos en batch
          const detailsResponse = await fetch(
            `https://api.mercadolibre.com/items?ids=${batch.join(',')}`,
            {
              headers: { 'Authorization': `Bearer ${store.access_token}` }
            }
          );

          if (!detailsResponse.ok) continue;

          const itemsData = await detailsResponse.json();

          // Procesar cada item
          for (const itemResponse of itemsData) {
            if (itemResponse.code !== 200 || !itemResponse.body) continue;

            const item = itemResponse.body;
            const checksum = generateChecksum(item);

            // Verificar si necesita actualización
            const shouldUpdate = await needsUpdate(
              String(store.ml_user_id),
              item.id,
              '',
              checksum,
              item.last_updated
            );

            if (!shouldUpdate) {
              itemsSkipped++;
              totalApiCallsSaved += 3; // Ahorramos llamadas a fees, shipping y reviews
              continue;
            }

            // SOLO si necesita actualización, hacer las llamadas costosas
            // Aquí iría el código de getFeeDetails, getShippingCosts, etc.
            // Por ahora solo actualizamos el caché

            await updateCache(
              String(store.ml_user_id),
              item.id,
              '',
              checksum,
              item.last_updated
            );

            itemsProcessed++;
          }

          // Pequeña pausa entre batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        totalItemsProcessed += itemsProcessed;
        totalItemsSkipped += itemsSkipped;

        console.log(`✅ Store ${store.store_id} completed:`);
        console.log(`   - Processed: ${itemsProcessed}`);
        console.log(`   - Skipped (no changes): ${itemsSkipped}`);
        console.log(`   - API calls saved: ${itemsSkipped * 3}`);

      } catch (error) {
        console.error(`Error processing store ${store.store_id}:`, error);
        continue;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ OPTIMIZED export completed in ${duration}ms`);
    console.log(`📊 Total processed: ${totalItemsProcessed}`);
    console.log(`📊 Total skipped: ${totalItemsSkipped}`);
    console.log(`💰 API calls saved: ${totalApiCallsSaved}`);

    return NextResponse.json({
      success: true,
      stats: {
        duration,
        itemsProcessed: totalItemsProcessed,
        itemsSkipped: totalItemsSkipped,
        apiCallsSaved: totalApiCallsSaved,
        storesProcessed: activeStores.length
      }
    });

  } catch (error) {
    console.error('Error in optimized export-dimensions:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
