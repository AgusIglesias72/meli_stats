// src/app/api/cron/export-dimensions-coordinator/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/schema';
import { and, gt, ne, asc } from 'drizzle-orm';

export const maxDuration = 10; // Coordinador muy ligero
export const runtime = 'nodejs';

/**
 * Coordinador que divide el trabajo entre múltiples workers
 * En vez de una función de 5 minutos, lanza múltiples workers de 30s en paralelo
 *
 * Beneficios:
 * 1. Mejor escalabilidad
 * 2. Si un worker falla, los demás continúan
 * 3. Vercel cobra menos por funciones cortas
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.NEXT_PUBLIC_API_SECRET_KEY;

    if (authHeader && apiSecret && authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[COORDINATOR] Starting export-dimensions coordination...');

    // Obtener todas las tiendas activas
    const activeStores = await db.select({
      id: stores.id,
      store_id: stores.store_id,
      name: stores.name,
    }).from(stores)
      .where(and(gt(stores.token_expiry, new Date()), ne(stores.store_id, '405011859')))
      .orderBy(asc(stores.store_id));

    if (!activeStores || activeStores.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active stores found'
      });
    }

    console.log(`[COORDINATOR] Found ${activeStores.length} stores to process`);

    // Lanzar workers en paralelo (máximo 5 a la vez para no saturar)
    const workerUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/cron/export-dimensions-worker`
      : 'http://localhost:3000/api/cron/export-dimensions-worker';

    const maxConcurrent = 3;
    const results = [];

    for (let i = 0; i < activeStores.length; i += maxConcurrent) {
      const batch = activeStores.slice(i, i + maxConcurrent);

      console.log(`[COORDINATOR] Launching workers for batch ${Math.floor(i / maxConcurrent) + 1}`);

      const workerPromises = batch.map(store =>
        fetch(`${workerUrl}?store_id=${store.id}`, {
          headers: {
            'Authorization': `Bearer ${apiSecret}`
          }
        })
          .then(res => res.json())
          .then(data => ({ store_id: store.store_id, success: true, data }))
          .catch(error => ({ store_id: store.store_id, success: false, error: error.message }))
      );

      const batchResults = await Promise.all(workerPromises);
      results.push(...batchResults);

      // Pequeña pausa entre batches
      if (i + maxConcurrent < activeStores.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[COORDINATOR] Completed in ${duration}ms`);
    console.log(`[COORDINATOR] Success: ${successful}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      duration,
      stores_total: activeStores.length,
      stores_successful: successful,
      stores_failed: failed,
      results
    });

  } catch (error) {
    console.error('[COORDINATOR] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
