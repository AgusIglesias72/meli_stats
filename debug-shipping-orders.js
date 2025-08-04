// Script para debuggear órdenes con problemas de envío
const API_KEY = 'YOUR_API_KEY';
const API_URL = 'https://meli-stats.vercel.app/api/orders';

// Órdenes self_service que traen envío incorrecto (deberían ser gratis)
const selfServiceOrders = [
  '2000012533349008',
  '2000012532964228', 
  '2000012532500936',
  '2000012532491384',
  '2000012532400854',
  '2000012531702456',
  '2000012528721768'
];

// Órdenes que deberían cobrar envío pero traen 0
const shouldChargeShipping = [
  '2000012515509682',
  '2000012515302946',
  '2000012505006808',
  '2000012502779948',
  '2000012502386636',
  '2000012501065382',
  '2000012500116178'
];

async function analyzeOrder(orderId) {
  try {
    console.log(`\n🔍 Analizando orden: ${orderId}`);
    
    // 1. Obtener datos desde nuestra base de datos
    const dbResponse = await fetch(`${API_URL}?date_range=last_30_days&getAllPages=true`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    if (!dbResponse.ok) {
      console.error(`❌ Error obteniendo datos de DB: ${dbResponse.status}`);
      return;
    }
    
    const dbData = await dbResponse.json();
    const order = dbData.orders.find(o => o.id === orderId);
    
    if (!order) {
      console.log(`⚠️  Orden ${orderId} no encontrada en la base de datos`);
      return;
    }
    
    console.log(`📊 Datos en nuestra DB:`);
    console.log(`   - shipping_amount: ${order.shipping_amount}`);
    console.log(`   - charge_shipping: ${order.charge_shipping}`);
    console.log(`   - shipping_mode: ${order.shipping_mode}`);
    console.log(`   - shipping_logistic_type: ${order.shipping_logistic_type}`);
    console.log(`   - total_paid_amount: ${order.total_paid_amount}`);
    console.log(`   - transaction_amount: ${order.transaction_amount}`);
    console.log(`   - net_received_amount: ${order.net_received_amount}`);
    console.log(`   - shipping_id: ${order.shipping_id}`);
    
    // 2. Obtener datos directamente de ML API (necesitaríamos token)
    console.log(`\n🔗 Para verificar en ML API:`);
    console.log(`   - Order: https://api.mercadolibre.com/orders/${orderId}`);
    if (order.shipping_id) {
      console.log(`   - Shipment: https://api.mercadolibre.com/shipments/${order.shipping_id}`);
      console.log(`   - Shipment Costs: https://api.mercadolibre.com/shipments/${order.shipping_id}/costs`);
    }
    
    // 3. Análisis del problema
    console.log(`\n🚨 Análisis:`);
    if (selfServiceOrders.includes(orderId)) {
      console.log(`   - Orden SELF_SERVICE que debería tener envío gratis`);
      if (order.shipping_amount > 0) {
        console.log(`   - ❌ PROBLEMA: shipping_amount = ${order.shipping_amount} (debería ser 0)`);
      }
      if (order.charge_shipping > 0) {
        console.log(`   - ❌ PROBLEMA: charge_shipping = ${order.charge_shipping} (debería ser 0)`);
      }
    }
    
    if (shouldChargeShipping.includes(orderId)) {
      console.log(`   - Orden que DEBERÍA cobrar envío`);
      if (order.shipping_amount === 0) {
        console.log(`   - ❌ PROBLEMA: shipping_amount = 0 (debería > 0)`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error analizando orden ${orderId}:`, error);
  }
}

async function main() {
  console.log('🚀 Iniciando análisis de órdenes con problemas de envío...');
  
  console.log('\n📦 === ÓRDENES SELF_SERVICE (deberían ser gratis) ===');
  for (const orderId of selfServiceOrders.slice(0, 3)) { // Solo las primeras 3
    await analyzeOrder(orderId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa 1s
  }
  
  console.log('\n💰 === ÓRDENES QUE DEBERÍAN COBRAR ENVÍO ===');
  for (const orderId of shouldChargeShipping.slice(0, 3)) { // Solo las primeras 3
    await analyzeOrder(orderId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa 1s
  }
  
  console.log('\n✅ Análisis completado');
}

main().catch(console.error);