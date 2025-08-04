// scripts/test-dimensions-cron.js
// Script para probar el cron job de exportación de dimensiones

async function testDimensionsCron() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_SECRET_KEY = "YOUR_API_KEY";

  if (!API_SECRET_KEY) {
    console.error('❌ Error: NEXT_PUBLIC_API_SECRET_KEY no está configurada');
    process.exit(1);
  }

  console.log('🚀 Iniciando test del cron de exportación de dimensiones...');
  console.log(`📍 URL: ${API_URL}/api/cron/export-dimensions`);

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}/api/cron/export-dimensions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (!response.ok) {
      console.error('❌ Error en la respuesta:', response.status, response.statusText);
      console.error('Detalles:', data);
      process.exit(1);
    }

    console.log('✅ Cron ejecutado exitosamente');
    console.log(`⏱️  Duración: ${duration} segundos`);
    console.log('\n📊 Resultados:');
    
    if (data.stats) {
      console.log(`  • Tiendas procesadas: ${data.stats.totalStores}`);
      console.log(`  • Items con dimensiones: ${data.stats.totalItemsWithDimensions}`);
      console.log(`  • Atributos únicos encontrados: ${data.stats.uniqueDimensionAttributes}`);
      console.log(`  • Hoja creada: ${data.stats.sheetName}`);
      console.log(`  • Spreadsheet ID: ${data.stats.spreadsheetId}`);
      console.log(`\n📄 Ver en Google Sheets:`);
      console.log(`  https://docs.google.com/spreadsheets/d/${data.stats.spreadsheetId}`);
    }

  } catch (error) {
    console.error('❌ Error ejecutando el cron:', error);
    process.exit(1);
  }
}

// Ejecutar el test
testDimensionsCron();