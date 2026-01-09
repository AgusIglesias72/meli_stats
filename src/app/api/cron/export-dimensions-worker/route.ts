// src/app/api/cron/export-dimensions-worker/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const maxDuration = 30; // Función ligera de 30 segundos
export const runtime = 'nodejs';

/**
 * Worker function que procesa UNA SOLA tienda
 * Esta función es llamada por el coordinador para dividir el trabajo
 *
 * Query params esperados:
 * - store_id: ID de la tienda a procesar
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }

    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.NEXT_PUBLIC_API_SECRET_KEY;

    if (authHeader && apiSecret && authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[WORKER] Processing store: ${storeId}`);

    const supabase = createServerSupabaseClient();

    // Obtener información de la tienda
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry, name')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verificar token
    if (new Date(store.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    // Obtener lista de items
    const itemsResponse = await fetch(
      `https://api.mercadolibre.com/users/${store.ml_user_id}/items/search?limit=50`,
      {
        headers: { 'Authorization': `Bearer ${store.access_token}` }
      }
    );

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch items: ${itemsResponse.statusText}`);
    }

    const { results: itemIds } = await itemsResponse.json();

    console.log(`[WORKER] Found ${itemIds.length} items for store ${store.store_id}`);

    // Procesar items en batch
    const batchSize = 20;
    let processed = 0;

    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);

      const detailsResponse = await fetch(
        `https://api.mercadolibre.com/items?ids=${batch.join(',')}`,
        {
          headers: { 'Authorization': `Bearer ${store.access_token}` }
        }
      );

      if (detailsResponse.ok) {
        const itemsData = await detailsResponse.json();
        processed += itemsData.filter((r: any) => r.code === 200).length;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      store_id: store.store_id,
      items_processed: processed,
      duration
    });

  } catch (error) {
    console.error('[WORKER] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
