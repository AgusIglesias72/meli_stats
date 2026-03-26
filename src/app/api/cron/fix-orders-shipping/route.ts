// src/app/api/cron/fix-orders-shipping/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, orders } from '@/lib/db/schema';
import { and, gt, eq, gte, isNotNull, asc, desc } from 'drizzle-orm';

export const maxDuration = 300; // 5 minutos para procesar todas las órdenes

/**
 * Corrige los datos de envío para todas las órdenes existentes
 * Re-procesa usando el endpoint /shipments/{id}/costs
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 [FIX-ORDERS-SHIPPING] Starting shipping data correction...');

  try {
    // Verificar autorización
    const authorization = request.headers.get('authorization');
    console.log('🔐 [FIX-ORDERS-SHIPPING] Checking authorization...');

    if (!authorization || !authorization.startsWith('Bearer ') || authorization.split(' ')[1] !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      console.error('❌ [FIX-ORDERS-SHIPPING] Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ [FIX-ORDERS-SHIPPING] Authorization successful');

    // Obtener todas las tiendas activas con tokens válidos
    const activeStores = await db.select({
      id: stores.id,
      store_id: stores.store_id,
      ml_user_id: stores.ml_user_id,
      access_token: stores.access_token,
      token_expiry: stores.token_expiry,
      name: stores.name,
    }).from(stores)
      .where(gt(stores.token_expiry, new Date()))
      .orderBy(asc(stores.store_id));

    if (!activeStores || activeStores.length === 0) {
      console.error('Error fetching stores');
      return NextResponse.json({ error: 'No active stores found' }, { status: 500 });
    }

    console.log(`📊 [FIX-ORDERS-SHIPPING] Found ${activeStores.length} active stores`);

    let totalProcessed = 0;
    let totalFixed = 0;
    let totalErrors = 0;

    // Procesar cada tienda
    for (const store of activeStores) {
      console.log(`\n🏪 [STORE] Processing store: ${store.name || store.store_id}`);

      // Obtener órdenes desde enero 2025 que tengan shipping_id
      const storeOrders = await db.select({
        id: orders.id,
        shipping_id: orders.shipping_id,
        shipping_amount: orders.shipping_amount,
        charge_shipping: orders.charge_shipping,
        net_received_amount: orders.net_received_amount,
      }).from(orders)
        .where(and(
          eq(orders.store_id, String(store.ml_user_id)),
          gte(orders.date_created, '2025-01-01T00:00:00.000Z'),
          isNotNull(orders.shipping_id)
        ))
        .orderBy(desc(orders.date_created));

      if (!storeOrders || storeOrders.length === 0) {
        console.log(`  ⚠️ No orders with shipping found for store ${store.store_id}`);
        continue;
      }

      console.log(`  📦 Found ${storeOrders.length} orders to process`);

      // Procesar órdenes en lotes
      const batchSize = 10;
      for (let i = 0; i < storeOrders.length; i += batchSize) {
        const batch = storeOrders.slice(i, i + batchSize);

        console.log(`  🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(storeOrders.length/batchSize)} (${batch.length} orders)`);

        const batchPromises = batch.map(async (order) => {
          try {
            // Obtener costs del shipment
            const costsResponse = await fetch(`https://api.mercadolibre.com/shipments/${order.shipping_id}/costs`, {
              headers: {
                'Authorization': `Bearer ${store.access_token}`
              }
            });

            if (!costsResponse.ok) {
              console.warn(`    ⚠️ Cannot get costs for shipment ${order.shipping_id}: ${costsResponse.status}`);
              return { success: false, orderId: order.id };
            }

            const costsData = await costsResponse.json();

            if (!costsData.senders || !costsData.senders[0]) {
              console.warn(`    ⚠️ No sender data for shipment ${order.shipping_id}`);
              return { success: false, orderId: order.id };
            }

            const senderData = costsData.senders[0];
            const correctShippingAmount = senderData.cost || 0;

            // Calcular comisiones de envío
            let correctChargeShipping = 0;
            if (senderData.charges) {
              correctChargeShipping = Object.values(senderData.charges)
                .reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
            }

            // Solo actualizar si hay diferencias
            const needsUpdate =
              order.shipping_amount !== String(correctShippingAmount) ||
              order.charge_shipping !== String(correctChargeShipping);

            if (needsUpdate) {
              await db.update(orders).set({
                shipping_amount: String(correctShippingAmount),
                charge_shipping: String(correctChargeShipping),
                updated_at: new Date().toISOString()
              }).where(eq(orders.id, order.id));

              console.log(`    ✅ Fixed order ${order.id}: shipping ${order.shipping_amount} → ${correctShippingAmount}, charge ${order.charge_shipping} → ${correctChargeShipping}`);
              return { success: true, orderId: order.id, fixed: true };
            } else {
              return { success: true, orderId: order.id, fixed: false };
            }

          } catch (error) {
            console.error(`    ❌ Error processing order ${order.id}:`, error);
            return { success: false, orderId: order.id };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Contar resultados
        batchResults.forEach(result => {
          totalProcessed++;
          if (result.success) {
            if (result.fixed) {
              totalFixed++;
            }
          } else {
            totalErrors++;
          }
        });

        // Pausa entre lotes para no saturar la API
        if (i + batchSize < storeOrders.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`  ✅ Store ${store.store_id} completed`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ CORRECTION COMPLETED!`);
    console.log(`  ⏱️ Total time: ${totalTime} seconds`);
    console.log(`  📊 Total processed: ${totalProcessed}`);
    console.log(`  🔧 Total fixed: ${totalFixed}`);
    console.log(`  ❌ Total errors: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      message: 'Orders shipping data corrected successfully',
      stats: {
        totalStores: activeStores.length,
        totalProcessed,
        totalFixed,
        totalErrors,
        executionTime: `${totalTime}s`
      }
    });

  } catch (error) {
    console.error('Error in cron shipping correction:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
