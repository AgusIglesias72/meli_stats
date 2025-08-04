// test-products-cron.js
const fetch = require('node-fetch');

async function testProductsCron() {
    try {
        console.log('🚀 Testing Products Export Cron...');
        
        const response = await fetch('http://localhost:3001/api/cron/export-products', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET_KEY || 'YOUR_API_KEY'}`,
                'Content-Type': 'application/json'
            },
            timeout: 300000 // 5 minutos de timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error:', response.status, errorText);
            return;
        }

        const data = await response.json();
        console.log('✅ Success:', JSON.stringify(data, null, 2));
        
        if (data.stats) {
            console.log('\n📊 Estadísticas del Reporte:');
            console.log(`- Tiendas procesadas: ${data.stats.totalStores}`);
            console.log(`- Total de productos: ${data.stats.totalProducts}`);
            console.log(`- Total de variantes: ${data.stats.totalVariants}`);
            console.log(`- Stock total: ${data.stats.totalStock}`);
            console.log(`- Ventas totales: ${data.stats.totalSold}`);
            console.log(`\n📄 Hojas creadas:`);
            console.log(`- Datos: ${data.stats.sheetName}`);
            console.log(`- Resumen: ${data.stats.summarySheetName}`);
            console.log(`\n🔗 Spreadsheet ID: ${data.stats.spreadsheetId}`);
            console.log(`   URL: https://docs.google.com/spreadsheets/d/${data.stats.spreadsheetId}`);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar el test
testProductsCron();