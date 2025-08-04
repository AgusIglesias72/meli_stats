// test-fix-orders-shipping.js
// Script para ejecutar la corrección de datos de envío de todas las órdenes

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET_KEY || 'YOUR_API_KEY';

async function testFixOrdersShipping() {
  console.log('🚀 Testing Orders Shipping Fix Cron Job...');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`🔐 Using API Key: ${API_SECRET_KEY.substring(0, 8)}...`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}/api/cron/fix-orders-shipping`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('\n📋 Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Shipping correction executed successfully!');
      console.log(`📊 Stats:`);
      console.log(`  - Total stores: ${data.stats.totalStores}`);
      console.log(`  - Total processed: ${data.stats.totalProcessed}`);
      console.log(`  - Total fixed: ${data.stats.totalFixed}`);
      console.log(`  - Total errors: ${data.stats.totalErrors}`);
      console.log(`  - Execution time: ${data.stats.executionTime}`);
    } else {
      console.error('\n❌ Shipping correction failed:', data.error || 'Unknown error');
    }

  } catch (error) {
    console.error('\n❌ Error calling shipping correction cron:', error);
  }
}

// Ejecutar el test
testFixOrdersShipping();