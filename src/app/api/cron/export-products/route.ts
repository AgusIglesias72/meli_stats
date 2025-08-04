// src/app/api/cron/export-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/googleSheetsClient';

export const maxDuration = 59; // Máximo tiempo de ejecución

// Función para formatear fecha a Buenos Aires
function formatToBuenosAires(datetime: string) {
  const date = new Date(datetime);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('es-AR', options);
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value.padStart(2, '0') ?? '--';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// Función para formatear números grandes con separador de miles
function formatNumber(num: number): string {
  return num.toLocaleString('es-AR');
}

// Función para formatear precio
function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Función para extraer los atributos de combinación de una variante
function extractVariantAttributes(variant: any): string {
  if (!variant.attribute_combinations || variant.attribute_combinations.length === 0) {
    return '';
  }
  
  return variant.attribute_combinations
    .map((attr: any) => `${attr.name}: ${attr.value_name || 'N/A'}`)
    .join(' | ');
}

// Función para obtener el SKU de una variante
function getVariantSKU(variant: any): string {
  if (!variant.attributes) return '';
  
  const skuAttr = variant.attributes.find((attr: any) => attr.id === 'SELLER_SKU');
  return skuAttr ? skuAttr.value_name || '' : '';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 [EXPORT-PRODUCTS] Starting product export process...');
  
  try {
    // Verificar la autorización mediante clave secreta
    const authorization = request.headers.get('authorization');
    console.log('🔐 [EXPORT-PRODUCTS] Checking authorization...');
    
    if (!authorization || !authorization.startsWith('Bearer ') || authorization.split(' ')[1] !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      console.error('❌ [EXPORT-PRODUCTS] Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ [EXPORT-PRODUCTS] Authorization successful');

    const supabase = createServerSupabaseClient();
    
    // Obtener todas las tiendas activas con tokens válidos
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry, name')
      .gt('token_expiry', new Date().toISOString())
      .order('store_id');

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      return NextResponse.json({ error: 'Error fetching stores' }, { status: 500 });
    }

    if (!stores || stores.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active stores found' 
      });
    }

    console.log(`📊 [EXPORT-PRODUCTS] Found ${stores.length} active stores to process`);
    stores.forEach(store => {
      console.log(`  - ${store.name || store.store_id} (ID: ${store.ml_user_id})`);
    });

    // Preparar el spreadsheet
    const SPREADSHEET_ID = process.env.DIMENSIONS_SPREADSHEET_ID || '1uESNvCVtMssb56eop9FhisZPNLMPssUDdhonmXI_2b0';
    const sheets = getSheetsClient();
    console.log(`📄 [EXPORT-PRODUCTS] Using spreadsheet ID: ${SPREADSHEET_ID}`);
    
    // Array para almacenar todos los datos
    const allProductsData: any[] = [];
    const statsData = {
      totalProducts: 0,
      totalVariants: 0,
      totalActiveProducts: 0,
      totalPausedProducts: 0,
      totalClosedProducts: 0,
      totalStock: 0,
      totalSold: 0,
      productsByCategory: new Map<string, number>(),
      productsByListingType: new Map<string, number>(),
      variantsByProduct: new Map<string, number>(),
      storeStats: new Map<string, any>()
    };
    
    // Procesar tiendas en paralelo (máximo 2 a la vez para no saturar)
    const maxConcurrentStores = 2;
    
    for (let storeIndex = 0; storeIndex < stores.length; storeIndex += maxConcurrentStores) {
      const concurrentStores = stores.slice(storeIndex, storeIndex + maxConcurrentStores);
      
      const storePromises = concurrentStores.map(async (store, idx) => {
        const currentStoreIndex = storeIndex + idx;
        const storeStartTime = Date.now();
        
        try {
          console.log(`\n🏪 [STORE ${currentStoreIndex + 1}/${stores.length}] Starting: ${store.name || store.store_id}`);
          console.log(`  - Store ID: ${store.store_id}`);
          console.log(`  - ML User ID: ${store.ml_user_id}`);
        
          // Inicializar estadísticas de la tienda
          const storeStatsData = {
            name: store.name || store.store_id,
            totalProducts: 0,
            totalVariants: 0,
            totalStock: 0,
            totalSold: 0
          };
          
          const storeProductsData = [];
        
        // Obtener TODOS los productos de la tienda con paginación
        let allItems: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        console.log(`  📋 Fetching products from database...`);

        while (hasMore) {
          const { data: items, error: itemsError, count } = await supabase
            .from('items')
            .select('item_id, title, sku, price, category_id, listing_type_id, status', { count: 'exact' })
            .eq('seller_id', store.ml_user_id)
            .order('title', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (itemsError) {
            console.error(`  ❌ Error fetching items page ${page + 1}:`, itemsError);
            break;
          }

          if (items && items.length > 0) {
            allItems = allItems.concat(items);
            console.log(`    - Page ${page + 1}: ${items.length} items (total so far: ${allItems.length})`);
            page++;
            hasMore = items.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        if (allItems.length === 0) {
          console.log(`  ⚠️ No items found for this store`);
          return true; // Continuar con la siguiente tienda
        }

        console.log(`  ✅ Found ${allItems.length} total items in ${page} pages`);
        
        // Procesar items en lotes con paralelización
        const batchSize = 20;
        const maxConcurrentBatches = 3; // Procesar hasta 3 batches en paralelo
        let processedCount = 0;
        console.log(`  🔄 Processing items in batches of ${batchSize} (${maxConcurrentBatches} concurrent)...`);
        
        // Dividir items en batches
        const batches = [];
        for (let i = 0; i < allItems.length; i += batchSize) {
          batches.push(allItems.slice(i, i + batchSize));
        }
        
        // Procesar batches en grupos paralelos
        for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
          const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);
          
          const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
            const currentBatchNumber = i + batchIndex + 1;
            const itemIds = batch.map(item => item.item_id).join(',');
            
            console.log(`    📦 Starting batch ${currentBatchNumber}/${batches.length} (${batch.length} items)`);
            
            try {
              // Obtener detalles completos de los items
              const response = await fetch(`https://api.mercadolibre.com/items?ids=${itemIds}`, {
                headers: {
                  'Authorization': `Bearer ${store.access_token}`
                }
              });

              if (!response.ok) {
                console.error(`      ❌ Batch ${currentBatchNumber} error: ${response.status}`);
                return [];
              }

              const itemsData = await response.json();
              console.log(`      ✅ Batch ${currentBatchNumber} received data for ${itemsData.length} items`);

              const batchResults = [];
              
              // Procesar cada item del batch
              for (const itemResponse of itemsData) {
                if (itemResponse.code !== 200 || !itemResponse.body) {
                  continue;
                }
                
                const itemData = itemResponse.body;
                const originalItem = batch.find(item => item.item_id === itemData.id);
                
                if (!originalItem) continue;

              // Actualizar estadísticas
              statsData.totalProducts++;
              storeStatsData.totalProducts++;
              
              if (itemData.status === 'active') statsData.totalActiveProducts++;
              else if (itemData.status === 'paused') statsData.totalPausedProducts++;
              else if (itemData.status === 'closed') statsData.totalClosedProducts++;
              
              // Categorías y listing types
              statsData.productsByCategory.set(
                itemData.category_id,
                (statsData.productsByCategory.get(itemData.category_id) || 0) + 1
              );
              statsData.productsByListingType.set(
                itemData.listing_type_id,
                (statsData.productsByListingType.get(itemData.listing_type_id) || 0) + 1
              );

                // Si el producto tiene variantes
                if (itemData.variations && itemData.variations.length > 0) {
                  statsData.variantsByProduct.set(itemData.id, itemData.variations.length);
                  
                  // Procesar variantes en paralelo con SKUs
                  const variantPromises = itemData.variations.map(async (variant: any) => {
                    statsData.totalVariants++;
                    storeStatsData.totalVariants++;
                    statsData.totalStock += variant.available_quantity || 0;
                    statsData.totalSold += variant.sold_quantity || 0;
                    storeStatsData.totalStock += variant.available_quantity || 0;
                    storeStatsData.totalSold += variant.sold_quantity || 0;
                    
                    // Obtener SKU de la variante en paralelo
                    let variantSKU = '';
                    
                    try {
                      const variantResponse = await fetch(`https://api.mercadolibre.com/items/${itemData.id}/variations/${variant.id}`, {
                        headers: {
                          'Authorization': `Bearer ${store.access_token}`
                        }
                      });
                      
                      if (variantResponse.ok) {
                        const variantData = await variantResponse.json();
                        variantSKU = getVariantSKU(variantData);
                      }
                    } catch (error) {
                      // Silently ignore variant SKU errors
                    }
                  
                    return {
                      // Información de la tienda
                      store_id: store.ml_user_id,
                      store_name: store.name || store.store_id,
                      
                      // Información del producto principal
                      product_id: itemData.id,
                      product_title: itemData.title,
                      product_status: itemData.status,
                      product_permalink: itemData.permalink,
                      category_id: itemData.category_id,
                      listing_type_id: itemData.listing_type_id,
                      condition: itemData.condition,
                      
                      // Información de la variante
                      variant_id: variant.id,
                      variant_attributes: extractVariantAttributes(variant),
                      variant_sku: variantSKU || variant.seller_custom_field || '',
                      
                      // Precios y cantidades
                      price: variant.price || itemData.price,
                      original_price: itemData.original_price || null,
                      available_quantity: variant.available_quantity || 0,
                      sold_quantity: variant.sold_quantity || 0,
                      
                      // Información adicional
                      free_shipping: itemData.shipping?.free_shipping || false,
                      shipping_mode: itemData.shipping?.mode || '',
                      warranty: itemData.warranty || '',
                      
                      // Fechas
                      created_date: itemData.date_created,
                      last_updated: itemData.last_updated
                    };
                  });
                  
                  const variantResults = await Promise.all(variantPromises);
                  batchResults.push(...variantResults);
                } else {
                  // Producto sin variantes
                  statsData.totalVariants++;
                  storeStatsData.totalVariants++;
                  statsData.totalStock += itemData.available_quantity || 0;
                  statsData.totalSold += itemData.sold_quantity || 0;
                  storeStatsData.totalStock += itemData.available_quantity || 0;
                  storeStatsData.totalSold += itemData.sold_quantity || 0;
                  
                  batchResults.push({
                    // Información de la tienda
                    store_id: store.ml_user_id,
                    store_name: store.name || store.store_id,
                    
                    // Información del producto
                    product_id: itemData.id,
                    product_title: itemData.title,
                    product_status: itemData.status,
                    product_permalink: itemData.permalink,
                    category_id: itemData.category_id,
                    listing_type_id: itemData.listing_type_id,
                    condition: itemData.condition,
                    
                    // Sin variante
                    variant_id: '',
                    variant_attributes: '',
                    variant_sku: originalItem.sku || '',
                    
                    // Precios y cantidades
                    price: itemData.price,
                    original_price: itemData.original_price || null,
                    available_quantity: itemData.available_quantity || 0,
                    sold_quantity: itemData.sold_quantity || 0,
                    
                    // Información adicional
                    free_shipping: itemData.shipping?.free_shipping || false,
                    shipping_mode: itemData.shipping?.mode || '',
                    warranty: itemData.warranty || '',
                    
                    // Fechas
                    created_date: itemData.date_created,
                    last_updated: itemData.last_updated
                  });
                }
              }
              
              return batchResults;
              
            } catch (error) {
              console.error(`      ❌ Batch ${currentBatchNumber} error:`, error);
              return [];
            }
          });
          
          // Esperar a que terminen todos los batches paralelos
          const batchResults = await Promise.all(batchPromises);
          const flatResults = batchResults.flat();
          storeProductsData.push(...flatResults);
          
          processedCount += concurrentBatches.reduce((sum, batch) => sum + batch.length, 0);
          console.log(`    ✅ Completed ${processedCount}/${allItems.length} items`);
          
          // Pausa entre grupos de batches paralelos
          if (i + maxConcurrentBatches < batches.length) {
            console.log(`    ⏳ Waiting 200ms before next batch group...`);
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // Guardar estadísticas de la tienda
        statsData.storeStats.set(store.store_id, storeStatsData);
        allProductsData.push(...storeProductsData);
        
        const storeTime = ((Date.now() - storeStartTime) / 1000).toFixed(2);
        console.log(`  ✅ Store ${store.name} completed in ${storeTime}s:`);
        console.log(`     - Products: ${storeStatsData.totalProducts}`);
        console.log(`     - Variants: ${storeStatsData.totalVariants}`);
        console.log(`     - Total Stock: ${storeStatsData.totalStock}`);
        console.log(`     - Total Sold: ${storeStatsData.totalSold}`);
        
        return true;
          
        } catch (error) {
          console.error(`  ❌ Error processing store ${store.store_id}:`, error);
          return false;
        }
      });
      
      // Esperar a que terminen las tiendas paralelas
      await Promise.all(storePromises);
      
      // Pausa entre grupos de tiendas
      if (storeIndex + maxConcurrentStores < stores.length) {
        console.log(`\n⏳ Waiting before processing next store group...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Ahora exportar todo a Google Sheets
    console.log(`\n📊 SUMMARY OF DATA COLLECTION:`);
    console.log(`  - Total stores processed: ${stores.length}`);
    console.log(`  - Total products: ${statsData.totalProducts}`);
    console.log(`  - Total variants: ${statsData.totalVariants}`);
    console.log(`  - Total rows to export: ${allProductsData.length}`);
    
    if (allProductsData.length === 0) {
      console.log(`⚠️ No products found across all stores`);
      return NextResponse.json({
        success: true,
        message: 'No products found across all stores'
      });
    }
    
    console.log(`\n📝 STARTING GOOGLE SHEETS EXPORT...`);

    // Crear los encabezados
    const headers = [
      'Tienda ID',
      'Tienda Nombre',
      'ID Producto',
      'Título Producto',
      'Estado',
      'ID Variante',
      'SKU',
      'Atributos Variante',
      'Categoría',
      'Condición',
      'Stock Disponible',
      'Cantidad Vendida',
      'Precio',
      'Precio Original',
      'Tipo Publicación',
      'URL Producto',
      'Envío Gratis',
      'Modo Envío',
      'Garantía',
      'Fecha Creación',
      'Última Actualización'
    ];

    // Nombre fijo de la hoja
    const SHEET_NAME = 'Productos con Variantes';

    try {
      console.log(`  🔄 Preparing sheet "${SHEET_NAME}"...`);
      
      // Intentar limpiar directamente, si falla es porque no existe
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A:ZZ`,
          requestBody: {}
        });
        console.log(`  🧹 Sheet cleared successfully`);
      } catch (err) {
        console.log(`  ➕ Sheet doesn't exist, creating it...`);
        // Si no existe, crearla
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: SHEET_NAME
                }
              }
            }]
          }
        });
      }
      
      // Preparar las filas de datos
      console.log(`  📋 Preparing ${allProductsData.length} rows of data...`);
      const rows = [headers];
      
      for (const item of allProductsData) {
        const row = [
          item.store_id || '',
          item.store_name || '',
          item.product_id || '',
          item.product_title || '',
          item.product_status || '',
          item.variant_id || '',
          item.variant_sku || '',
          item.variant_attributes || '',
          item.category_id || '',
          item.condition || '',
          formatNumber(item.available_quantity || 0),
          formatNumber(item.sold_quantity || 0),
          formatPrice(item.price || 0),
          item.original_price ? formatPrice(item.original_price) : '',
          item.listing_type_id || '',
          item.product_permalink || '',
          item.free_shipping ? 'Sí' : 'No',
          item.shipping_mode || '',
          item.warranty || '',
          formatToBuenosAires(item.created_date || new Date().toISOString()),
          formatToBuenosAires(item.last_updated || new Date().toISOString())
        ];
        rows.push(row);
      }
      
      console.log(`  📤 Uploading data to Google Sheets...`);
      // Insertar todos los datos
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows
        }
      });
      console.log(`  ✅ Data uploaded successfully!`);
      
      // Formateo opcional - salteamos para evitar límites de API
      console.log(`  ⚡ Skipping sheet formatting to avoid API limits`);
      
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ EXPORT COMPLETED SUCCESSFULLY!`);
      console.log(`  ⏱️ Total time: ${totalTime} seconds`);
      console.log(`  📊 Total products: ${statsData.totalProducts}`);
      console.log(`  📊 Total variants: ${statsData.totalVariants}`);
      console.log(`  📄 Sheet name: ${SHEET_NAME}`);
      console.log(`  🔗 Spreadsheet URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
      
      return NextResponse.json({
        success: true,
        message: 'Products exported successfully',
        stats: {
          totalStores: stores.length,
          totalProducts: statsData.totalProducts,
          totalVariants: statsData.totalVariants,
          totalStock: statsData.totalStock,
          totalSold: statsData.totalSold,
          sheetName: SHEET_NAME,
          spreadsheetId: SPREADSHEET_ID,
          executionTime: `${totalTime}s`
        }
      });
      
    } catch (sheetError) {
      console.error('Error writing to Google Sheets:', sheetError);
      return NextResponse.json({ 
        error: 'Error writing to Google Sheets',
        message: sheetError instanceof Error ? sheetError.message : 'Unknown error' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in cron products export:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Función auxiliar para obtener el ID de una hoja
async function getSheetId(sheets: any, spreadsheetId: string, sheetName: string): Promise<number> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    
    const sheet = response.data.sheets.find((s: any) => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
  } catch (error) {
    console.error('Error getting sheet ID:', error);
    return 0;
  }
}