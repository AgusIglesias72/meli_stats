// refreshOrders-2025.js
// Script para cargar TODAS las órdenes desde enero 2025 con los nuevos cálculos de envío

// LocalHost (actualizado al puerto correcto)
const API_URL     = 'http://localhost:3003/api/stores/token';
const API_KEY     = 'YOUR_API_KEY';
const WEBHOOK_URL = 'http://localhost:3003/api/meli/webhooks';

const STORES = [
  { name: 'Green Deco', id: '205076801' },
  { name: 'Harte',      id: '1027217359' }
];

// Fecha desde enero 1, 2025 - 00:00:00 Argentina (UTC-3)
const FROM_DATE = '2025-01-01T00:00:00.000-03:00';
const ML_LIMIT  = 50; // máximo permitido por la API de ML

/**
 * 1) Obtener token de acceso para una tienda
 */
async function getAccessToken(storeId) {
  const res = await fetch(`${API_URL}?store_id=${storeId}`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type':  'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Token error [${storeId}]: ${res.status} ${res.statusText}`);
  }
  return await res.json(); // { access_token, seller_id, ... }
}

/**
 * 2) Traer TODOS los IDs de órdenes paginando ML desde enero 2025
 */
async function getAllOrderIds(accessToken, sellerId, storeName) {
  let offset  = 0;
  let allIds  = [];
  let hasMore = true;

  console.log(`📅 Buscando órdenes desde: ${FROM_DATE}`);

  while (hasMore) {
    const url = new URL('https://api.mercadolibre.com/orders/search');
    url.searchParams.set('seller', sellerId);
    url.searchParams.set('sort', 'date_asc');
    url.searchParams.set('order.date_created.from', FROM_DATE);
    url.searchParams.set('limit', ML_LIMIT);
    url.searchParams.set('offset', offset);

    console.log(`  🔍 Página ${Math.floor(offset/ML_LIMIT) + 1} - offset: ${offset}`);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`ML fetch error [${sellerId}]: ${res.status} ${res.statusText}`);
    }

    const { results, paging } = await res.json();
    const pageIds = results.map(o => o.id.toString());
    allIds.push(...pageIds);

    console.log(`    ✅ Encontradas ${pageIds.length} órdenes en esta página (total: ${allIds.length}/${paging.total})`);

    offset  += ML_LIMIT;
    hasMore = results.length === ML_LIMIT && offset < paging.total;

    // pequeña pausa para no abusar de la API
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`🔎 TOTAL: ${allIds.length} órdenes encontradas para ${storeName} desde enero 2025`);
  return allIds;
}

/**
 * 3) Enviar webhook a tu servidor para recrear la orden
 */
async function sendOrderNotification(orderId, sellerId) {
  const payload = {
    topic:          'orders_v2',
    resource:       `/orders/${orderId}`,
    user_id:        sellerId,
    application_id: 4081197249279107,
    sent:           new Date().toISOString(),
    attempts:       1,
    received:       new Date().toISOString(),
    actions:        []
  };

  const res = await fetch(WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error(`❌ Error webhook [${orderId}]: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

/**
 * MAIN: coordina todo el proceso
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🚀 INICIANDO CARGA MASIVA DE ÓRDENES 2025');
  console.log('='.repeat(60));
  console.log(`📅 Desde: ${FROM_DATE}`);
  console.log(`🏪 Tiendas: ${STORES.map(s => s.name).join(', ')}`);
  console.log(`🔗 Servidor: ${WEBHOOK_URL}`);
  console.log('='.repeat(60));

  try {
    let totalOrdersProcessed = 0;
    let totalOrdersSuccess = 0;
    let totalOrdersError = 0;

    for (const store of STORES) {
      const storeStartTime = Date.now();
      console.log(`\n▶️  PROCESANDO TIENDA: ${store.name} (${store.id})`);
      console.log(`${'='.repeat(40)}`);

      try {
        // 1) Token
        console.log(`🔐 Obteniendo token de acceso...`);
        const { access_token, seller_id } = await getAccessToken(store.id);
        console.log(`✅ Token obtenido para seller: ${seller_id}`);

        // 2) IDs
        console.log(`\n📋 Obteniendo IDs de órdenes...`);
        const orderIds = await getAllOrderIds(access_token, seller_id, store.name);

        if (orderIds.length === 0) {
          console.log(`⚠️  No se encontraron órdenes para ${store.name}`);
          continue;
        }

        // 3) Notificar uno a uno mostrando progreso
        console.log(`\n🔔 INICIANDO PROCESAMIENTO DE WEBHOOKS:`);
        console.log(`   Total a procesar: ${orderIds.length} órdenes`);
        
        let storeSuccess = 0;
        let storeErrors = 0;

        for (let i = 0; i < orderIds.length; i++) {
          const orderId = orderIds[i];
          const idx     = i + 1;
          const total   = orderIds.length;
          const percent = ((idx / total) * 100).toFixed(1);

          // Mostrar progreso cada 10 órdenes o en las últimas 5
          if (idx % 10 === 0 || idx <= 5 || idx > total - 5) {
            console.log(`🔔 [${idx}/${total}] (${percent}%) Procesando orden ${orderId}...`);
          }

          const ok = await sendOrderNotification(orderId, seller_id);

          if (ok) {
            storeSuccess++;
            if (idx % 10 === 0 || idx <= 5 || idx > total - 5) {
              console.log(`   ✅ Orden ${orderId} procesada correctamente`);
            }
          } else {
            storeErrors++;
            console.log(`   ❌ ERROR procesando orden ${orderId}`);
          }

          totalOrdersProcessed++;

          // Progreso cada 100 órdenes
          if (idx % 100 === 0) {
            const elapsed = ((Date.now() - storeStartTime) / 1000).toFixed(1);
            const avgTime = (elapsed / idx * 1000).toFixed(0);
            const remaining = ((total - idx) * avgTime / 1000).toFixed(0);
            console.log(`   📊 Progreso: ${idx}/${total} | Tiempo: ${elapsed}s | ETA: ${remaining}s`);
          }

          // throttle opcional
          await new Promise(r => setTimeout(r, 50));
        }

        totalOrdersSuccess += storeSuccess;
        totalOrdersError += storeErrors;

        const storeTime = ((Date.now() - storeStartTime) / 1000).toFixed(1);
        console.log(`\n🎉 TIENDA ${store.name} COMPLETADA:`);
        console.log(`   ✅ Éxito: ${storeSuccess}/${orderIds.length}`);
        console.log(`   ❌ Errores: ${storeErrors}/${orderIds.length}`);
        console.log(`   ⏱️  Tiempo: ${storeTime} segundos`);

      } catch (storeError) {
        console.error(`❌ Error procesando tienda ${store.name}:`, storeError);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 PROCESO COMPLETO PARA TODAS LAS TIENDAS');
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 ESTADÍSTICAS FINALES:`);
    console.log(`   🏪 Tiendas procesadas: ${STORES.length}`);
    console.log(`   📦 Total órdenes: ${totalOrdersProcessed}`);
    console.log(`   ✅ Éxito: ${totalOrdersSuccess}`);
    console.log(`   ❌ Errores: ${totalOrdersError}`);
    console.log(`   ⏱️  Tiempo total: ${totalTime} segundos`);
    console.log(`   🚀 Promedio: ${(totalOrdersProcessed / parseFloat(totalTime)).toFixed(1)} órdenes/seg`);
    console.log(`${'='.repeat(60)}`);
    
    console.log(`\n✨ ¡Todas las órdenes desde enero 2025 han sido procesadas!`);
    console.log(`✨ Los nuevos cálculos de envío se aplicaron automáticamente.`);

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

main();