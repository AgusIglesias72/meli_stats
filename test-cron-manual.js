// Script para probar el cron de export-dimensions manualmente
// Uso: node test-cron-manual.js

async function testExportDimensions() {
  console.log('🚀 Iniciando test del cron export-dimensions...');
  console.log('==========================================\n');

  const url = 'http://localhost:3002/api/cron/export-dimensions';
  const token = 'YOUR_API_KEY';

  try {
    console.log('📡 Enviando request a:', url);
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️ Tiempo de respuesta: ${elapsed}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ ÉXITO! Resumen:');
      console.log('================');
      
      if (data.stats) {
        console.log(`📦 Tiendas procesadas: ${data.stats.totalStores || 0}`);
        console.log(`📝 Items procesados: ${data.stats.totalItemsProcessed || 0}`);
        console.log(`📊 Hoja: ${data.stats.sheetName || 'N/A'}`);
        console.log(`🔗 Spreadsheet ID: ${data.stats.spreadsheetId || 'N/A'}`);
        
        if (data.stats.spreadsheetId) {
          console.log(`\n🔗 Ver en Google Sheets:`);
          console.log(`   https://docs.google.com/spreadsheets/d/${data.stats.spreadsheetId}`);
        }
      }
      
      console.log('\n📄 Respuesta completa:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('\n❌ ERROR:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Error ejecutando el cron:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Sugerencia: Asegúrate de que el servidor esté corriendo:');
      console.log('   npm run dev');
    }
  }
}

// Ejecutar si el servidor local está corriendo
testExportDimensions();