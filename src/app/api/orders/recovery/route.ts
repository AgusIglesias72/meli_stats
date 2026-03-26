import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, orders } from '@/lib/db/schema';
import { eq, and, ne, gt, inArray } from 'drizzle-orm';
import { fetchOrderDetails, saveOrderToDatabase } from '@/lib/meliOrders';

export const maxDuration = 300; // 5 minutos max

const DELAY_BETWEEN_ORDERS_MS = 500; // 500ms entre órdenes para no saturar la API de ML
const PAGE_SIZE = 50; // ML devuelve hasta 50 resultados por página

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /api/orders/recovery
 *
 * Recupera órdenes de Mercado Libre por rango de fechas que no están en la base de datos.
 *
 * Body:
 * {
 *   "date_from": "2026-03-20",     // Fecha inicio (YYYY-MM-DD) - REQUERIDO
 *   "date_to": "2026-03-26",       // Fecha fin (YYYY-MM-DD) - REQUERIDO
 *   "store_id": "uuid",            // ID de tienda específica (opcional, si no se pasa procesa todas)
 *   "force_update": false           // Si true, re-procesa órdenes que ya existen (opcional)
 * }
 *
 * Ejemplo de uso local:
 *   curl -X POST http://localhost:3000/api/orders/recovery \
 *     -H "Content-Type: application/json" \
 *     -d '{"date_from":"2026-03-20","date_to":"2026-03-26"}'
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar API secret key
    const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
    const isLocal = request.headers.get('host')?.includes('localhost');

    if (!isLocal && apiKey !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date_from, date_to, store_id, force_update = false } = body;

    if (!date_from || !date_to) {
      return NextResponse.json(
        { error: 'Se requieren date_from y date_to en formato YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validar formato de fechas
    const dateFromParsed = new Date(date_from);
    const dateToParsed = new Date(date_to);
    if (isNaN(dateFromParsed.getTime()) || isNaN(dateToParsed.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Usar YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Formatear fechas para la API de ML (ISO 8601)
    const dateFromISO = `${date_from}T00:00:00.000-03:00`;
    const dateToISO = `${date_to}T23:59:59.999-03:00`;

    // Obtener tiendas con token válido
    const storeQuery = db.select({
      id: stores.id,
      store_id: stores.store_id,
      ml_user_id: stores.ml_user_id,
      access_token: stores.access_token,
      token_expiry: stores.token_expiry,
      name: stores.name,
    }).from(stores);

    let storeList;
    if (store_id) {
      storeList = await storeQuery.where(eq(stores.id, store_id));
    } else {
      storeList = await storeQuery;
    }

    if (storeList.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron tiendas' },
        { status: 404 }
      );
    }

    const results: any[] = [];

    for (const store of storeList) {
      const storeResult: any = {
        store_name: store.name,
        store_id: store.store_id,
        orders_found_in_ml: 0,
        orders_already_in_db: 0,
        orders_recovered: 0,
        orders_updated: 0,
        orders_failed: 0,
        errors: [],
      };

      // Verificar token
      if (!store.access_token) {
        storeResult.errors.push('Sin access_token');
        results.push(storeResult);
        continue;
      }

      if (store.token_expiry && new Date(store.token_expiry) < new Date()) {
        storeResult.errors.push('Token expirado');
        results.push(storeResult);
        continue;
      }

      try {
        // Paginar por la API de órdenes de ML
        let offset = 0;
        let totalOrders = 0;
        let hasMore = true;

        while (hasMore) {
          const searchUrl = `https://api.mercadolibre.com/orders/search?seller=${store.ml_user_id}&order.date_created.from=${dateFromISO}&order.date_created.to=${dateToISO}&sort=date_desc&limit=${PAGE_SIZE}&offset=${offset}`;

          const searchResponse = await fetch(searchUrl, {
            headers: {
              'Authorization': `Bearer ${store.access_token}`
            }
          });

          if (!searchResponse.ok) {
            storeResult.errors.push(`Error buscando órdenes: HTTP ${searchResponse.status}`);
            break;
          }

          const searchData = await searchResponse.json();
          totalOrders = searchData.paging?.total || 0;
          const ordersList = searchData.results || [];

          storeResult.orders_found_in_ml = totalOrders;

          if (ordersList.length === 0) {
            break;
          }

          // Verificar cuáles ya existen en la DB
          const orderIds = ordersList.map((o: any) => o.id.toString());
          const existingOrders = await db.select({ id: orders.id })
            .from(orders)
            .where(inArray(orders.id, orderIds));

          const existingIds = new Set(existingOrders.map(o => o.id));

          for (const mlOrder of ordersList) {
            const orderId = mlOrder.id.toString();
            const alreadyExists = existingIds.has(orderId);

            if (alreadyExists && !force_update) {
              storeResult.orders_already_in_db++;
              continue;
            }

            try {
              // Obtener detalles completos de la orden (pagos, envío, facturación)
              const orderDetails = await fetchOrderDetails(
                orderId,
                store.ml_user_id!.toString(),
                store.access_token!
              );

              if (!orderDetails) {
                storeResult.orders_failed++;
                storeResult.errors.push(`No se pudo obtener detalles de orden ${orderId}`);
                continue;
              }

              // Guardar en la DB
              const saved = await saveOrderToDatabase(
                orderDetails,
                store.ml_user_id!.toString(),
                store.id
              );

              if (saved) {
                if (alreadyExists) {
                  storeResult.orders_updated++;
                } else {
                  storeResult.orders_recovered++;
                }
              } else {
                storeResult.orders_failed++;
                storeResult.errors.push(`Error guardando orden ${orderId}`);
              }

              // Rate limiting
              await delay(DELAY_BETWEEN_ORDERS_MS);
            } catch (orderError: any) {
              storeResult.orders_failed++;
              storeResult.errors.push(`Error procesando orden ${orderId}: ${orderError.message}`);
            }
          }

          offset += PAGE_SIZE;
          hasMore = offset < totalOrders;

          // Pequeña pausa entre páginas
          if (hasMore) {
            await delay(200);
          }
        }
      } catch (storeError: any) {
        storeResult.errors.push(`Error general: ${storeError.message}`);
      }

      results.push(storeResult);
    }

    // Resumen global
    const summary = {
      date_range: { from: date_from, to: date_to },
      force_update,
      total_found_in_ml: results.reduce((sum, r) => sum + r.orders_found_in_ml, 0),
      total_already_in_db: results.reduce((sum, r) => sum + r.orders_already_in_db, 0),
      total_recovered: results.reduce((sum, r) => sum + r.orders_recovered, 0),
      total_updated: results.reduce((sum, r) => sum + r.orders_updated, 0),
      total_failed: results.reduce((sum, r) => sum + r.orders_failed, 0),
      stores: results,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Error en recovery de órdenes:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
