// refreshOrders.js
// Node 18+ incluye fetch nativo. Si usas Node <18, instala “node-fetch” y descomenta la línea indicada.

// const fetch = require('node-fetch');

const API_URL     = 'https://meli-stats.vercel.app/api/stores/token';
const API_KEY     = 'YOUR_API_KEY';
const WEBHOOK_URL = 'https://meli-stats.vercel.app/api/meli/webhooks';

const STORES = [
  //{ name: 'Green Deco', id: '205076801' },
  { name: 'Harte',      id: '1027217359' }
];

// Fecha desde la cual relanzamos todas las órdenes
const FROM_DATE = '2025-04-30T23:00:00.000-04:00';
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
 * 2) Traer TODOS los IDs de órdenes paginando ML
 */
async function getAllOrderIds(accessToken, sellerId) {
  let offset  = 0;
  let allIds  = [];
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.mercadolibre.com/orders/search');
    url.searchParams.set('seller', sellerId);
    url.searchParams.set('sort', 'date_asc');
    url.searchParams.set('order.date_created.from', FROM_DATE);
    url.searchParams.set('limit', ML_LIMIT);
    url.searchParams.set('offset', offset);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`ML fetch error [${sellerId}]: ${res.status} ${res.statusText}`);
    }

    const { results, paging } = await res.json();
    allIds.push(...results.map(o => o.id.toString()));

    offset  += ML_LIMIT;
    hasMore = results.length === ML_LIMIT && offset < paging.total;

    // pequeña pausa para no abusar de la API
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`🔎 Encontradas ${allIds.length} órdenes para seller ${sellerId}`);
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
  try {
    for (const store of STORES) {
      console.log(`\n▶️  Procesando tienda ${store.name} (${store.id})`);

      // 1) Token
      const { access_token, seller_id } = await getAccessToken(store.id);

      // 2) IDs
      const orderIds = await getAllOrderIds(access_token, seller_id);

      // 3) Notificar uno a uno mostrando progreso
      console.log(`Comenzando notificaciones: ${orderIds.length} órdenes a procesar.`);
      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        const idx     = i + 1;
        const total   = orderIds.length;

        console.log(`🔔 [${idx}/${total}] Enviando webhook para orden ${orderId}…`);
        const ok = await sendOrderNotification(orderId, seller_id);

        if (ok) {
          console.log(`   ✅ [${idx}/${total}] Orden ${orderId} procesada.`);
        } else {
          console.log(`   ❌ [${idx}/${total}] Error procesando orden ${orderId}.`);
        }

        // throttle opcional
        await new Promise(r => setTimeout(r, 100));
      }

      console.log(`🎉 Tienda ${store.name} completada.`);
    }

    console.log('\n🎉 ¡Proceso completo para todas las tiendas!');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
