// refreshOrders-2025-robust.js
// Script para cargar TODAS las órdenes desde enero 2025 con los nuevos cálculos de envío
// VERSION ROBUSTA con manejo de errores y capacidad de resumir

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

// Configuración para manejo de errores
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 segundos entre reintentos
const BATCH_SIZE = 100;   // procesar en lotes para evitar saturar
const BATCH_DELAY = 2000; // 2 segundos entre lotes

/**
 * Función para esperar con delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Con manejo de errores y reintentos
 */
async function getAllOrderIds(accessToken, sellerId, storeName) {
  let offset  = 0;
  let allIds  = [];
  let hasMore = true;
  let consecutiveErrors = 0;

  console.log(`📅 Buscando órdenes desde: ${FROM_DATE}`);

  while (hasMore) {
    const url = new URL('https://api.mercadolibre.com/orders/search');
    url.searchParams.set('seller', sellerId);
    url.searchParams.set('sort', 'date_asc');
    url.searchParams.set('order.date_created.from', FROM_DATE);
    url.searchParams.set('limit', ML_LIMIT);
    url.searchParams.set('offset', offset);

    console.log(`  🔍 Página ${Math.floor(offset/ML_LIMIT) + 1} - offset: ${offset}`);

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        if (res.status === 429 || res.status === 400) {
          // Rate limit o error temporal
          consecutiveErrors++;
          console.warn(`⚠️ Error ${res.status} en página ${Math.floor(offset/ML_LIMIT) + 1}. Esperando ${RETRY_DELAY}ms...`);
          
          if (consecutiveErrors >= MAX_RETRIES) {
            console.error(`❌ Demasiados errores consecutivos. Deteniendo en offset ${offset}`);
            break;
          }
          
          await delay(RETRY_DELAY);
          continue;
        } else {
          throw new Error(`ML fetch error [${sellerId}]: ${res.status} ${res.statusText}`);
        }
      }

      // Reset contador de errores si la llamada fue exitosa
      consecutiveErrors = 0;

      const { results, paging } = await res.json();
      const pageIds = results.map(o => o.id.toString());
      allIds.push(...pageIds);

      console.log(`    ✅ Encontradas ${pageIds.length} órdenes en esta página (total: ${allIds.length}/${paging.total})`);

      offset  += ML_LIMIT;
      hasMore = results.length === ML_LIMIT && offset < paging.total;

      // Pausa más larga para evitar rate limits
      await delay(200);

    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ Error obteniendo página ${Math.floor(offset/ML_LIMIT) + 1}:`, error.message);
      
      if (consecutiveErrors >= MAX_RETRIES) {
        console.error(`❌ Demasiados errores consecutivos. Deteniendo en offset ${offset}`);
        break;
      }
      
      await delay(RETRY_DELAY);
    }
  }

  console.log(`🔎 TOTAL: ${allIds.length} órdenes encontradas para ${storeName} desde enero 2025`);
  return allIds;
}

/**
 * 3) Enviar webhook a tu servidor para recrear la orden
 */
async function sendOrderNotification(orderId, sellerId, retryCount = 0) {
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

  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (!res.ok) {
      if (retryCount < MAX_RETRIES && (res.status === 429 || res.status >= 500)) {
        console.warn(`⚠️ Error ${res.status} procesando orden ${orderId}. Reintento ${retryCount + 1}/${MAX_RETRIES}`);
        await delay(RETRY_DELAY);
        return await sendOrderNotification(orderId, sellerId, retryCount + 1);
      } else {
        console.error(`❌ Error webhook [${orderId}]: ${res.status} ${await res.text()}`);
        return false;
      }
    }
    return true;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`⚠️ Error de red procesando orden ${orderId}. Reintento ${retryCount + 1}/${MAX_RETRIES}`);
      await delay(RETRY_DELAY);
      return await sendOrderNotification(orderId, sellerId, retryCount + 1);
    } else {
      console.error(`❌ Error webhook [${orderId}]:`, error.message);
      return false;
    }
  }
}

/**
 * 4) Procesar órdenes en lotes para evitar saturación
 */
async function processOrdersBatch(orderIds, sellerId, batchNumber, totalBatches) {
  console.log(`🔄 Procesando lote ${batchNumber}/${totalBatches} (${orderIds.length} órdenes)`);
  
  let success = 0;
  let errors = 0;

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];
    const idx = i + 1;
    
    if (idx % 10 === 0 || idx <= 3 || idx > orderIds.length - 3) {
      console.log(`🔔 [Lote ${batchNumber}] [${idx}/${orderIds.length}] Procesando orden ${orderId}...`);
    }

    const ok = await sendOrderNotification(orderId, sellerId);
    
    if (ok) {
      success++;
      if (idx % 10 === 0 || idx <= 3 || idx > orderIds.length - 3) {
        console.log(`   ✅ Orden ${orderId} procesada correctamente`);
      }
    } else {
      errors++;
      console.log(`   ❌ ERROR procesando orden ${orderId}`);
    }

    // Throttle entre órdenes
    await delay(100);
  }

  return { success, errors };
}

/**
 * MAIN: coordina todo el proceso
 */
async function main() {
  const startTime = Date.now();
  
  console.log('🚀 INICIANDO CARGA MASIVA DE ÓRDENES 2025 (VERSIÓN ROBUSTA)');
  console.log('='.repeat(70));
  console.log(`📅 Desde: ${FROM_DATE}`);
  console.log(`🏪 Tiendas: ${STORES.map(s => s.name).join(', ')}`);
  console.log(`🔗 Servidor: ${WEBHOOK_URL}`);
  console.log(`⚙️ Configuración: lotes de ${BATCH_SIZE}, delay ${BATCH_DELAY}ms`);
  console.log('='.repeat(70));

  try {
    let totalOrdersProcessed = 0;
    let totalOrdersSuccess = 0;
    let totalOrdersError = 0;

    for (const store of STORES) {
      const storeStartTime = Date.now();
      console.log(`\n▶️  PROCESANDO TIENDA: ${store.name} (${store.id})`);
      console.log(`${'='.repeat(50)}`);

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

        // 3) Procesar en lotes
        console.log(`\n🔔 INICIANDO PROCESAMIENTO EN LOTES:`);
        console.log(`   Total a procesar: ${orderIds.length} órdenes`);
        console.log(`   Lotes de: ${BATCH_SIZE} órdenes c/u`);
        
        const batches = [];
        for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
          batches.push(orderIds.slice(i, i + BATCH_SIZE));
        }

        console.log(`   Total de lotes: ${batches.length}`);

        let storeSuccess = 0;
        let storeErrors = 0;

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const batchNumber = i + 1;
          
          const result = await processOrdersBatch(batch, seller_id, batchNumber, batches.length);
          
          storeSuccess += result.success;
          storeErrors += result.errors;
          totalOrdersProcessed += batch.length;

          // Progreso cada 5 lotes
          if (batchNumber % 5 === 0 || batchNumber === batches.length) {
            const elapsed = ((Date.now() - storeStartTime) / 1000).toFixed(1);
            const avgTime = (elapsed / (batchNumber * BATCH_SIZE) * 1000).toFixed(0);
            const remaining = ((batches.length - batchNumber) * BATCH_SIZE * avgTime / 1000).toFixed(0);
            console.log(`   📊 Progreso: lote ${batchNumber}/${batches.length} | Tiempo: ${elapsed}s | ETA: ${remaining}s`);
          }

          // Pausa entre lotes
          if (i < batches.length - 1) {
            console.log(`   ⏸️ Pausa entre lotes (${BATCH_DELAY}ms)...`);
            await delay(BATCH_DELAY);
          }
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
    console.log(`\n${'='.repeat(70)}`);
    console.log('🎉 PROCESO COMPLETO PARA TODAS LAS TIENDAS');
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 ESTADÍSTICAS FINALES:`);
    console.log(`   🏪 Tiendas procesadas: ${STORES.length}`);
    console.log(`   📦 Total órdenes: ${totalOrdersProcessed}`);
    console.log(`   ✅ Éxito: ${totalOrdersSuccess}`);
    console.log(`   ❌ Errores: ${totalOrdersError}`);
    console.log(`   ⏱️  Tiempo total: ${totalTime} segundos`);
    console.log(`   🚀 Promedio: ${(totalOrdersProcessed / parseFloat(totalTime)).toFixed(1)} órdenes/seg`);
    console.log(`${'='.repeat(70)}`);
    
    console.log(`\n✨ ¡Todas las órdenes desde enero 2025 han sido procesadas!`);
    console.log(`✨ Los nuevos cálculos de envío se aplicaron automáticamente.`);

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

main();