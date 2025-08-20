// src/app/api/cron/export-dimensions-v2/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/googleSheetsClient';

// export const maxDuration = 59; // Comentado para desarrollo local - sin límite de tiempo

// Palabras clave para identificar atributos de dimensiones
const DIMENSION_KEYWORDS = [
  // Dimensiones básicas en inglés
  'DEPTH', 'WIDTH', 'HEIGHT', 'LENGTH', 
  'DIAMETER', 'THICKNESS', 'SIZE', 'DIMENSION',
  // Dimensiones básicas en español
  'ALTO', 'ANCHO', 'LARGO', 'PROFUNDIDAD',
  'ESPESOR', 'DIAMETRO', 'TAMAÑO', 'MEDIDA',
  // Medidas adicionales
  'RADIUS', 'PERIMETER', 'VOLUME', 'WEIGHT',
  'PROFUNDO', 'GRUESO', 'PESO', 'CAPACIDAD',
  'CIRCUNFERENCIA', 'AREA', 'SUPERFICIE',
  // Variaciones comunes
  'DISTANCIA', 'EXTENSION', 'ALCANCE', 'APERTURA',
  'GROSOR', 'CALIBRE', 'TALLA', 'MEDIDAS',
  // Términos específicos
  'ENVERGADURA', 'ESLORA', 'MANGA', 'CALADO',
  'SPAN', 'GAUGE', 'BORE', 'STROKE'
];

// Función para verificar si un atributo es de dimensión
function isDimensionAttribute(attributeId: string): boolean {
  const upperCaseId = attributeId.toUpperCase();
  return DIMENSION_KEYWORDS.some(keyword => upperCaseId.includes(keyword));
}

// Función para extraer valor de dimensión formateado
function extractDimensionValue(attribute: any): string {
  if (!attribute.values || attribute.values.length === 0) return '';
  
  const value = attribute.values[0];
  
  // Si tiene estructura con número y unidad
  if (value.struct && value.struct.number !== undefined) {
    return `${value.struct.number} ${value.struct.unit || ''}`.trim();
  }
  
  // Si es solo un string pero value_name está presente
  if (attribute.value_name) {
    return attribute.value_name;
  }
  
  // Si es solo un string en value.name
  return value.name || '';
}

// Función para formatear todos los atributos con separador |
function formatAllAttributes(attributes: any[]): string {
  if (!attributes || attributes.length === 0) return '';
  
  const formattedAttrs = attributes
    .filter(attr => attr.value_name && attr.value_name.trim() !== '') // Filtrar vacíos
    .map(attr => {
      // Si tiene múltiples valores, los junta con |
      if (attr.values && attr.values.length > 1) {
        return attr.values.map((v: any) => v.name || '').join(' | ');
      }
      return attr.value_name;
    })
    .filter(value => value && value.trim() !== '') // Filtrar valores vacíos
    .join(' | ');
    
  return formattedAttrs;
}

// Función para determinar cantidad de cuotas
function determineInstallmentsQuantity(listingTypeId: string, tags: string[]): number {
  if (listingTypeId === "gold_special") {
    if (tags.includes("pcj-enabled")) return 6;
    if (tags.includes("pcj-co-funded")) return 12;
    return 1;
  }

  if (listingTypeId === "gold_pro") {
    if (tags.includes("3x_campaign")) return 3;
    if (tags.includes("cuota-simple-3")) return 3;
    if (tags.includes("cuota-simple-6")) return 6;
    if (tags.includes("9x_campaign")) return 9;
    if (tags.includes("cuota-simple-12")) return 12;
    if (tags.includes("12x_campaign")) return 12;
    return 6; // Por defecto para gold_pro
  }

  return 1;
}

// Función para determinar envío gratis
function determineFreeShipping(shippingData: any): boolean {
  if (shippingData?.tags && shippingData.tags.includes("mandatory_free_shipping")) {
    return true;
  }
  return shippingData?.free_shipping || false;
}

// Función para obtener detalles de comisiones
async function getFeeDetails(
  itemId: string,
  price: number,
  listingTypeId: string,
  categoryId: string,
  accessToken: string
): Promise<any> {
  try {
    // Validar parámetros antes de hacer la llamada
    if (!price || !listingTypeId || !categoryId) {
      // console.log(`Skipping fee details for item ${itemId}: missing required params`);
      return {
        meli_percentage_fee: 0,
        percentage_fee: 0,
        financing_add_on_fee: 0,
        fixed_fee: 0,
        sale_fee_amount: 0
      };
    }
    
    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/listing_prices?price=${price}&listing_type_id=${listingTypeId}&category_id=${categoryId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      // Solo loguear si no es un error esperado
      if (response.status !== 400 && response.status !== 404) {
        console.error(`Error fetching fee details: ${response.status} for item ${itemId}`);
      }
      return {
        meli_percentage_fee: 0,
        percentage_fee: 0,
        financing_add_on_fee: 0,
        fixed_fee: 0,
        sale_fee_amount: 0
      };
    }

    const data = await response.json();
    
    return {
      meli_percentage_fee: data.sale_fee_details?.meli_percentage_fee || 0,
      percentage_fee: data.sale_fee_details?.percentage_fee || 0,
      financing_add_on_fee: data.sale_fee_details?.financing_add_on_fee || 0,
      fixed_fee: data.sale_fee_details?.fixed_fee || 0,
      sale_fee_amount: data.sale_fee_amount || 0
    };
  } catch (error) {
    console.error('Error fetching fee details:', error);
    return {
      meli_percentage_fee: 0,
      percentage_fee: 0,
      financing_add_on_fee: 0,
      fixed_fee: 0,
      sale_fee_amount: 0
    };
  }
}

// Función para obtener reviews del producto
async function getProductReviews(itemId: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(`https://api.mercadolibre.com/reviews/item/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      return {
        total_reviews: 0,
        rating_average: 0
      };
    }

    const data = await response.json();
    
    return {
      total_reviews: data.paging?.total || 0,
      rating_average: data.rating_average || 0
    };
  } catch (error) {
    return {
      total_reviews: 0,
      rating_average: 0
    };
  }
}

// Función para obtener costos de envío
async function getShippingCosts(
  itemId: string,
  userId: string,
  accessToken: string
): Promise<any> {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/users/${userId}/shipping_options/free?item_id=${itemId}&verbose=TRUE`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      // Solo loguear si no es un error esperado (404 es común cuando no hay opciones de envío)
      if (response.status !== 404 && response.status !== 400) {
        console.error(`Error fetching shipping costs: ${response.status} for item ${itemId}`);
      }
      return {
        shipping_list_cost: null,
        shipping_discount_rate: null,
        shipping_promoted_amount: null
      };
    }

    const data = await response.json();
    
    return {
      shipping_list_cost: data.coverage?.all_country?.list_cost || null,
      shipping_discount_rate: data.coverage?.all_country?.discount?.rate || null,
      shipping_promoted_amount: data.coverage?.all_country?.discount?.promoted_amount || null
    };
  } catch (error) {
    console.error(`Error fetching shipping costs:`, error);
    return {
      shipping_list_cost: null,
      shipping_discount_rate: null,
      shipping_promoted_amount: null
    };
  }
}

// Función para obtener todos los productos de una tienda desde ML usando scan
async function getAllItemsFromML(userId: string, accessToken: string): Promise<string[]> {
  const allItemIds: string[] = [];
  let scrollId: string | null = null;
  const limit = 100; // Máximo permitido con scan
  let callCount = 0;

  console.log(`   Starting to fetch ALL items for user ${userId} using search_type=scan...`);

  while (true) {
    try {
      callCount++;
      let url: string;
      
      if (!scrollId) {
        // Primera llamada - usar search_type=scan
        url = `https://api.mercadolibre.com/users/${userId}/items/search?search_type=scan&limit=${limit}`;
        console.log(`   Call ${callCount}: Initial scan request`);
      } else {
        // Llamadas subsecuentes - usar el scroll_id
        url = `https://api.mercadolibre.com/users/${userId}/items/search?search_type=scan&scroll_id=${scrollId}`;
        console.log(`   Call ${callCount}: Using scroll_id`);
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ Error fetching items: ${response.status} - ${errorText}`);
        break;
      }

      const data = await response.json();
      
      // Extraer el scroll_id para la siguiente llamada
      if (data.scroll_id) {
        scrollId = data.scroll_id;
        console.log(`   ✓ Got scroll_id for next call`);
      }
      
      if (data.results && data.results.length > 0) {
        allItemIds.push(...data.results);
        console.log(`   ✓ Fetched ${data.results.length} items (total so far: ${allItemIds.length})`);
      } else {
        console.log(`   ✅ No more items - scan complete`);
        break;
      }

      // Si no hay scroll_id, significa que llegamos al final
      if (!data.scroll_id) {
        console.log(`   ✅ No more scroll_id - reached end`);
        break;
      }

      // Pausa entre requests (importante para scan)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Safety check para evitar loops infinitos
      if (callCount > 100) {
        console.log(`   ⚠️ Safety break - too many calls (${callCount})`);
        break;
      }
      
    } catch (error) {
      console.error('   ❌ Error in scan process:', error);
      break;
    }
  }

  console.log(`   ✅ Scan completed - Total items fetched: ${allItemIds.length} in ${callCount} calls`);
  return allItemIds;
}

// Función para refrescar el access token si es necesario
async function refreshTokenIfNeeded(storeId: string, supabase: any): Promise<{ accessToken: string; isValid: boolean }> {
  try {
    const { data: store, error } = await supabase
      .from('stores')
      .select('access_token, token_expiry')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      console.error('Error fetching store token:', error);
      return { accessToken: '', isValid: false };
    }

    // Verificar si el token sigue siendo válido (con 5 minutos de margen)
    const tokenExpiry = new Date(store.token_expiry);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (tokenExpiry > fiveMinutesFromNow) {
      return { accessToken: store.access_token, isValid: true };
    }

    // Si el token está por expirar o expiró, deberíamos refrescarlo
    // Por ahora solo retornamos el token actual y marcamos como inválido
    console.log(`Token for store ${storeId} is expiring soon or expired`);
    return { accessToken: store.access_token, isValid: false };
  } catch (error) {
    console.error('Error in refreshTokenIfNeeded:', error);
    return { accessToken: '', isValid: false };
  }
}

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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('===========================================');
  console.log('Starting export-dimensions-v2 at:', new Date().toISOString());
  console.log('===========================================');
  
  try {
    // Verificar la autorización mediante clave secreta
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ') || authorization.split(' ')[1] !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    
    // Obtener todas las tiendas activas con tokens válidos (excluyendo tienda de prueba)
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry, name')
      .gt('token_expiry', new Date().toISOString())
      .neq('store_id', '405011859')  // Excluir tienda de prueba
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

    console.log(`Processing ${stores.length} stores for dimension export V2`);

    // Preparar el spreadsheet
    const SPREADSHEET_ID = process.env.DIMENSIONS_SPREADSHEET_ID || '1uESNvCVtMssb56eop9FhisZPNLMPssUDdhonmXI_2b0';
    const sheets = getSheetsClient();
    
    // Almacenar todos los datos de las tiendas
    const allStoresData = [];
    
    // Procesar cada tienda
    for (const store of stores) {
      try {
        console.log(`Processing store: ${store.store_id} - ${store.name}`);
        console.log(`   Token preview: ${store.access_token?.substring(0, 20)}...`);
        
        // Verificar si el token sigue siendo válido
        const { accessToken, isValid } = await refreshTokenIfNeeded(store.id, supabase);
        
        if (!isValid) {
          console.log(`Skipping store ${store.store_id} due to expired token`);
          continue;
        }
        
        console.log(`   Using token: ${accessToken?.substring(0, 20)}... (valid: ${isValid})`);
        console.log(`   Original token: ${store.access_token?.substring(0, 20)}...`);
        
        // Obtener TODOS los IDs de productos activos desde ML
        console.log(`\n📦 Fetching all items for store ${store.store_id} from ML API...`);
        const itemFetchStart = Date.now();
        const allItemIds = await getAllItemsFromML(store.ml_user_id, accessToken);
        console.log(`   ✅ Fetched in ${((Date.now() - itemFetchStart) / 1000).toFixed(1)}s`);
        
        if (allItemIds.length === 0) {
          console.log(`❌ No items found for store ${store.store_id}`);
          continue;
        }
        
        console.log(`✅ Found ${allItemIds.length} items for store ${store.store_id}`);
        
        // Mostrar los primeros 5 item IDs para debug
        console.log(`   First 5 items: ${allItemIds.slice(0, 5).join(', ')}`);
        
        // Procesar items en lotes usando Multiget (máximo 20 según documentación ML)
        const batchSize = 20;
        const storeItemsData = [];
        let processedCount = 0;
        let actuallyProcessed = 0;
        
        for (let i = 0; i < allItemIds.length; i += batchSize) {
          const batch = allItemIds.slice(i, i + batchSize);
          const itemIdsString = batch.join(',');
          processedCount += batch.length;
          
          // Log de progreso cada 100 items
          if (processedCount % 100 === 0 || processedCount === allItemIds.length) {
            const elapsed = ((Date.now() - itemFetchStart) / 1000).toFixed(1);
            const progress = ((processedCount / allItemIds.length) * 100).toFixed(1);
            console.log(`  ⏳ Processing items ${processedCount}/${allItemIds.length} (${progress}%) - ${elapsed}s elapsed`);
            
            // Verificar token cada 100 items procesados
            const { accessToken: newToken, isValid: stillValid } = await refreshTokenIfNeeded(store.id, supabase);
            if (!stillValid) {
              console.log(`Token expired while processing store ${store.store_id}`);
              break;
            }
            if (newToken !== accessToken) {
              console.log(`Token refreshed for store ${store.store_id}`);
            }
          }
          
          try {
            // Debug: Mostrar token y URL para el primer batch
            if (processedCount <= batchSize) {
              console.log(`   🔍 DEBUG - Using token: ${accessToken?.substring(0, 20)}...`);
              console.log(`   🔍 DEBUG - URL: https://api.mercadolibre.com/items?ids=${itemIdsString.substring(0, 50)}...`);
            }
            
            // Obtener detalles completos de los items (sin attributes=all para evitar problemas)
            const response = await fetch(`https://api.mercadolibre.com/items?ids=${itemIdsString}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });

            if (!response.ok) {
              console.error(`Error fetching batch for store ${store.store_id}: ${response.status}`);
              continue;
            }

            const itemsData = await response.json();

            // Debug: Mostrar estructura de respuesta para el primer lote
            if (processedCount <= batchSize) {
              console.log(`   🔍 DEBUG - Response structure for first batch:`);
              console.log(`   - itemsData.length: ${itemsData.length}`);
              console.log(`   - First item structure:`, JSON.stringify(itemsData[0], null, 2).substring(0, 500) + '...');
            }

            // Procesar cada item EN PARALELO (para fees y shipping)
            let validItemsInBatch = 0;
            let skippedReasons = { noBody: 0, emptyBody: 0, noId: 0, errorCode: 0 };
            
            // Procesar items del lote en paralelo
            const itemProcessingPromises = itemsData.map(async (itemResponse) => {
              const processedItems: any[] = [];
              
              // Verificar código de respuesta
              if (itemResponse.code !== 200) {
                skippedReasons.errorCode++;
                if (processedCount <= batchSize) {
                  console.log(`   ⚠️ Skipping item - error code: ${itemResponse.code}`);
                }
                return processedItems;
              }
              
              // Verificar si tiene body
              if (!itemResponse.body) {
                skippedReasons.noBody++;
                if (processedCount <= batchSize) {
                  console.log(`   ⚠️ Skipping item - no body`);
                }
                return processedItems;
              }
              
              const itemData = itemResponse.body;
              
              // Verificar si el body está vacío
              if (Object.keys(itemData).length === 0) {
                skippedReasons.emptyBody++;
                if (processedCount <= batchSize) {
                  console.log(`   ⚠️ Skipping item - empty body`);
                }
                return processedItems;
              }
              
              // Verificar si tiene ID
              if (!itemData.id) {
                skippedReasons.noId++;
                if (processedCount <= batchSize) {
                  console.log(`   ⚠️ Skipping item - no ID found. Item keys: ${Object.keys(itemData).join(', ')}`);
                }
                return processedItems;
              }
              
              // Calcular campos de comisiones y envío
              const freeShipping = determineFreeShipping(itemData.shipping || {});
              const installmentsQuantity = determineInstallmentsQuantity(
                itemData.listing_type_id || '',
                itemData.tags || []
              );
              
              // Obtener detalles de comisiones, envío y reviews EN PARALELO
              const [feeDetails, shippingCosts, reviewsData] = await Promise.all([
                getFeeDetails(
                  itemData.id,
                  itemData.price || 0,
                  itemData.listing_type_id || '',
                  itemData.category_id || '',
                  accessToken
                ),
                getShippingCosts(
                  itemData.id,
                  store.ml_user_id,
                  accessToken
                ),
                getProductReviews(
                  itemData.id,
                  accessToken
                )
              ]);
              
              // Pausa más corta ya que las llamadas fueron en paralelo
              await new Promise(resolve => setTimeout(resolve, 50));
              
              // Extraer SKU de múltiples fuentes posibles (orden de prioridad)
              let sku = '';
              
              // 1. seller_custom_field (más común)
              if (itemData.seller_custom_field) {
                sku = itemData.seller_custom_field;
              }
              
              // 2. Buscar en attributes SELLER_SKU
              if (!sku && itemData.attributes) {
                const skuAttribute = itemData.attributes.find((attr: any) => attr.id === 'SELLER_SKU');
                if (skuAttribute && skuAttribute.value_name) {
                  sku = skuAttribute.value_name;
                }
              }
              
              // 3. Buscar en user_product_id (a veces tiene SKU)
              if (!sku && itemData.user_product_id) {
                sku = itemData.user_product_id;
              }
              
              // 4. Buscar en inventory_id (puede contener SKU)
              if (!sku && itemData.inventory_id) {
                sku = itemData.inventory_id;
              }
              
              // 5. Si tiene variations, consultar el endpoint específico de la primera variante
              if (!sku && itemData.variations && itemData.variations.length > 0) {
                const firstVariation = itemData.variations[0];
                if (firstVariation.seller_custom_field) {
                  sku = firstVariation.seller_custom_field;
                } else {
                  // Consultar endpoint específico de la variante
                  try {
                    const varResponse = await fetch(`https://api.mercadolibre.com/items/${itemData.id}/variations/${firstVariation.id}`, {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`
                      }
                    });
                    
                    if (varResponse.ok) {
                      const varData = await varResponse.json();
                      // Buscar SKU en seller_custom_field primero
                      if (varData.seller_custom_field) {
                        sku = varData.seller_custom_field;
                      }
                      // Si no, buscar en attributes de la variante
                      else if (varData.attributes) {
                        const skuAttr = varData.attributes.find((attr: any) => attr.id === 'SELLER_SKU');
                        if (skuAttr && skuAttr.value_name) {
                          sku = skuAttr.value_name;
                        }
                      }
                    }
                  } catch (error) {
                    // Silencioso, continuar sin el SKU de la variante
                  }
                }
              }
              
              // Debug temporal: mostrar fuentes de SKU para items sin SKU
              if (!sku && processedCount <= batchSize) {
                console.log(`   🔍 SKU DEBUG for ${itemData.id}:`);
                console.log(`     - seller_custom_field: ${itemData.seller_custom_field || 'null'}`);
                console.log(`     - user_product_id: ${itemData.user_product_id || 'null'}`);
                console.log(`     - inventory_id: ${itemData.inventory_id || 'null'}`);
                console.log(`     - has attributes: ${!!itemData.attributes}`);
                if (itemData.attributes) {
                  const skuAttr = itemData.attributes.find((attr: any) => attr.id === 'SELLER_SKU');
                  console.log(`     - SELLER_SKU attribute: ${skuAttr?.value_name || 'not found'}`);
                }
              }
              
              // Para productos sin variaciones, dejar atributos en blanco
              const allAttributes = '';
              
              // Extraer datos básicos + dimensiones + campos nuevos
              const dimensionData: any = {
                store_id: store.ml_user_id,
                store_name: store.name || store.store_id,
                item_id: itemData.id,
                variation_id: '', // Producto principal sin variación
                title: itemData.title || '',
                sku: sku,
                
                // Campos básicos del producto
                status: itemData.status || '',
                available_quantity: itemData.available_quantity || 0,
                price: itemData.price || 0,
                original_price: itemData.original_price || itemData.price || 0,
                listing_type: itemData.listing_type_id || '',
                permalink: itemData.permalink || '',
                date_created: itemData.date_created || '',
                last_updated: itemData.last_updated || '',
                
                // Atributos del producto formateados
                all_attributes: allAttributes,
                
                // Reviews
                total_reviews: reviewsData.total_reviews,
                rating_average: reviewsData.rating_average,
                
                // Envío
                shipping_mode: itemData.shipping?.mode || '',
                logistic_type: itemData.shipping?.logistic_type || '',
                free_shipping: freeShipping,
                
                // Comisiones y pagos
                installments_quantity: installmentsQuantity,
                sale_fee_amount: feeDetails.sale_fee_amount,
                percentage_fee: feeDetails.percentage_fee,
                meli_percentage_fee: feeDetails.meli_percentage_fee,
                financing_add_on_fee: feeDetails.financing_add_on_fee,
                fixed_fee: feeDetails.fixed_fee,
                
                // Costos de envío
                shipping_list_cost: shippingCosts.shipping_list_cost,
                shipping_discount_rate: shippingCosts.shipping_discount_rate,
                shipping_promoted_amount: shippingCosts.shipping_promoted_amount
              };

              // No procesamos dimensiones en esta versión

              // Agregar el item al array de procesados
              processedItems.push(dimensionData);
              
              // Procesar variaciones si existen
              if (itemData.variations && Array.isArray(itemData.variations)) {
                for (const variation of itemData.variations) {
                  // SKU para variantes: buscar en múltiples fuentes
                  let variantSku = '';
                  
                  // 1. SKU específico de la variante
                  if (variation.seller_custom_field) {
                    variantSku = variation.seller_custom_field;
                  }
                  // 2. SKU del producto padre
                  else if (sku) {
                    variantSku = sku;
                  }
                  // 3. Buscar en attributes de la variante si tienen
                  else if (variation.attributes) {
                    const varSkuAttr = variation.attributes.find((attr: any) => attr.id === 'SELLER_SKU');
                    if (varSkuAttr && varSkuAttr.value_name) {
                      variantSku = varSkuAttr.value_name;
                    }
                  }
                  // 4. Consultar endpoint específico de la variante si aún no hay SKU
                  if (!variantSku) {
                    try {
                      const varResponse = await fetch(`https://api.mercadolibre.com/items/${itemData.id}/variations/${variation.id}`, {
                        headers: {
                          'Authorization': `Bearer ${accessToken}`
                        }
                      });
                      
                      if (varResponse.ok) {
                        const varData = await varResponse.json();
                        // Buscar SKU en seller_custom_field primero
                        if (varData.seller_custom_field) {
                          variantSku = varData.seller_custom_field;
                        }
                        // Si no, buscar en attributes de la variante
                        else if (varData.attributes) {
                          const skuAttr = varData.attributes.find((attr: any) => attr.id === 'SELLER_SKU');
                          if (skuAttr && skuAttr.value_name) {
                            variantSku = skuAttr.value_name;
                          }
                        }
                      }
                    } catch (error) {
                      // Silencioso, continuar
                    }
                  }
                  // 5. Como último recurso, usar el SKU del producto padre
                  if (!variantSku) {
                    variantSku = itemData.seller_custom_field || itemData.user_product_id || itemData.inventory_id || '';
                  }
                  
                  // Formatear atributos de la variación desde attribute_combinations
                  let variantAttributes = '';
                  if (variation.attribute_combinations && variation.attribute_combinations.length > 0) {
                    variantAttributes = variation.attribute_combinations
                      .map((ac: any) => ac.value_name || ac.name || '')
                      .filter((v: string) => v)
                      .join(' | ');
                  }
                  
                  const variantData: any = {
                    store_id: store.ml_user_id,
                    store_name: store.name || store.store_id,
                    item_id: itemData.id, // ID original SIN sufijo de variante
                    variation_id: variation.id || '', // ID de la variación
                    title: `${itemData.title} - ${variation.attribute_combinations?.map((ac: any) => ac.value_name).join(' ')}`,
                    sku: variantSku,
                    
                    // Campos básicos del producto (iguales para variantes)
                    status: itemData.status || '',
                    available_quantity: variation.available_quantity || 0,
                    price: variation.price || itemData.price || 0,
                    original_price: itemData.original_price || itemData.price || 0,
                    listing_type: itemData.listing_type_id || '',
                    permalink: itemData.permalink || '',
                    date_created: itemData.date_created || '',
                    last_updated: itemData.last_updated || '',
                    
                    // Atributos del producto (específicos de la variante)
                    all_attributes: variantAttributes,
                    
                    // Reviews (iguales para variantes)
                    total_reviews: reviewsData.total_reviews,
                    rating_average: reviewsData.rating_average,
                    
                    // Envío
                    shipping_mode: itemData.shipping?.mode || '',
                    logistic_type: itemData.shipping?.logistic_type || '',
                    free_shipping: freeShipping,
                    
                    // Comisiones y pagos (iguales para variantes)
                    installments_quantity: installmentsQuantity,
                    sale_fee_amount: feeDetails.sale_fee_amount,
                    percentage_fee: feeDetails.percentage_fee,
                    meli_percentage_fee: feeDetails.meli_percentage_fee,
                    financing_add_on_fee: feeDetails.financing_add_on_fee,
                    fixed_fee: feeDetails.fixed_fee,
                    
                    // Costos de envío
                    shipping_list_cost: shippingCosts.shipping_list_cost,
                    shipping_discount_rate: shippingCosts.shipping_discount_rate,
                    shipping_promoted_amount: shippingCosts.shipping_promoted_amount
                  };
                  
                  // No procesamos dimensiones en esta versión
                  
                  processedItems.push(variantData);
                }
              }
              
              return processedItems; // Retorna array de items procesados
            });

            // Esperar a que todos los items del lote se procesen en paralelo
            const batchResults = await Promise.all(itemProcessingPromises);
            
            // Agregar todos los items procesados válidos a storeItemsData
            for (const items of batchResults) {
              if (items && items.length > 0) {
                storeItemsData.push(...items);
                validItemsInBatch += items.length;
                actuallyProcessed += 1; // Contar productos únicos (sin contar variantes)
              }
            }

            // Log del lote completado
            if (processedCount <= 100 || processedCount % 200 === 0) {
              const totalSkipped = skippedReasons.noBody + skippedReasons.emptyBody + skippedReasons.noId + skippedReasons.errorCode;
              console.log(`   ✓ Batch completed: ${validItemsInBatch}/${batch.length} valid items`);
              if (totalSkipped > 0) {
                console.log(`     Skipped reasons: errorCode=${skippedReasons.errorCode}, emptyBody=${skippedReasons.emptyBody}, noId=${skippedReasons.noId}, noBody=${skippedReasons.noBody}`);
              }
            }

            // Pausa entre lotes
            if (i + batchSize < allItemIds.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }

          } catch (error) {
            console.error(`Error processing batch for store ${store.store_id}:`, error);
            continue;
          }
        }
        
        // Agregar los datos de esta tienda al conjunto global
        allStoresData.push(...storeItemsData);
        const storeElapsed = ((Date.now() - itemFetchStart) / 1000).toFixed(1);
        console.log(`\n✅ Store ${store.store_id} completed:`);
        console.log(`   - Items fetched from API: ${allItemIds.length}`);
        console.log(`   - Items actually processed: ${actuallyProcessed}`);
        console.log(`   - Total rows (including variants): ${storeItemsData.length}`);
        console.log(`   - Time taken: ${storeElapsed}s`);
        console.log(`   - Total items so far: ${allStoresData.length}`);
        
      } catch (error) {
        console.error(`Error processing store ${store.store_id}:`, error);
        continue;
      }
    }

    // Ahora exportar todo a Google Sheets
    if (allStoresData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items found across all stores'
      });
    }

    // No procesamos atributos de dimensiones en esta versión
    
    // Crear los encabezados con el nuevo orden especificado
    const headers = [
      'Tienda ID', 
      'Tienda Nombre', 
      'ID Producto', 
      'ID Variante',  // Nuevo campo
      'Estado', 
      'Título', 
      'SKU',
      'Total Reviews', 
      'Rating Promedio',
      'Atributos',  // attribute_combinations de variantes
      'Publicación',  // listing_type
      'Precio', 
      'Precio Real',  // original_price
      'Tipo Envío',  // shipping_mode
      'Logística',  // logistic_type - nuevo campo
      'Envío Gratis',
      'Cuotas',
      'Comisión Total',
      '% Comisión',
      '% MELI',
      '% Cuotas',
      'Com. Fija',
      'Costo Envío',  // shipping_list_cost
      'Desc. Envío ML',  // shipping_discount_rate
      'Costo Envío Orig.',  // shipping_promoted_amount
      'Stock',  // available_quantity
      'Fecha Creación',
      'Última Actualización',
      'URL'
    ];
    
    // No incluir columnas de dimensiones/medidas en esta versión

    // Nombre de la hoja fijo
    const SHEET_NAME = 'Dimensiones';

    try {
      // Verificar si la hoja existe
      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1`,
        });
        
        // Si existe, limpiarla
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A:ZZ`,
          requestBody: {}
        });
      } catch (err) {
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
      const rows = [headers];
      
      for (const item of allStoresData) {
        const row = [
          item.store_id || '',
          item.store_name || '',
          item.item_id || '',
          item.variation_id || '',  // ID Variante
          item.status || '',
          item.title || '',
          item.sku || '',
          item.total_reviews || 0,  // Número
          item.rating_average || 0,  // Número
          item.all_attributes || '',  // Atributos
          item.listing_type || '',  // Publicación
          item.price || 0,  // Número
          item.original_price || 0,  // Número - Precio Real
          item.shipping_mode || '',  // Tipo Envío
          item.logistic_type || '',  // Logística
          item.free_shipping ? 'Sí' : 'No',  // Envío Gratis
          item.installments_quantity || 0,  // Número - Cuotas
          parseFloat(item.sale_fee_amount?.toFixed(2) || '0'),  // Número - Comisión Total
          parseFloat(item.percentage_fee?.toFixed(2) || '0'),  // Número - % Comisión
          parseFloat(item.meli_percentage_fee?.toFixed(2) || '0'),  // Número - % MELI
          parseFloat(item.financing_add_on_fee?.toFixed(2) || '0'),  // Número - % Cuotas
          parseFloat(item.fixed_fee?.toFixed(2) || '0'),  // Número - Com. Fija
          parseFloat(item.shipping_list_cost?.toFixed(2) || '0'),  // Número - Costo Envío
          item.shipping_discount_rate ? parseFloat((item.shipping_discount_rate * 100).toFixed(2)) : 0,  // Número - Desc. Envío ML
          parseFloat(item.shipping_promoted_amount?.toFixed(2) || '0'),  // Número - Costo Envío Orig.
          item.available_quantity || 0,  // Número - Stock
          formatToBuenosAires(item.date_created || new Date().toISOString()),  // Fecha Creación
          formatToBuenosAires(item.last_updated || new Date().toISOString()),  // Última Actualización
          item.permalink || ''  // URL
        ];
        
        rows.push(row);
      }
      
      // Insertar todos los datos
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'USER_ENTERED',  // Cambiar de RAW a USER_ENTERED para que Google Sheets interprete los números
        requestBody: {
          values: rows
        }
      });
      
      // Formatear la hoja principal
      const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_NAME);
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              // Congelar la primera fila
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                    frozenColumnCount: 6 // Congelar hasta Modo Envío
                  }
                },
                fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
              }
            },
            {
              // Auto-ajustar columnas
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: headers.length
                }
              }
            }
          ]
        }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Dimensions V2 exported successfully',
        stats: {
          totalStores: stores.length,
          totalItemsProcessed: allStoresData.length,
          sheetName: SHEET_NAME,
          spreadsheetId: SPREADSHEET_ID
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
    console.error('Error in cron dimensions export V2:', error);
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