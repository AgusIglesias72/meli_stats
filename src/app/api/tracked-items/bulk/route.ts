// src/app/api/tracked-items/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const maxDuration = 59; // This function can run for a maximum of 5 seconds


// POST: Importación masiva de items para trackear
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;
    
    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
    }

    // Obtener datos del cuerpo
    const { itemIds } = await request.json();
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Item IDs array is required' }, { status: 400 });
    }

    // Limitar el número de items a importar
    if (itemIds.length > 5000) {
      return NextResponse.json({ 
        error: `Too many items (${itemIds.length}). Maximum allowed is 5000.` 
      }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario tiene acceso a esta tienda
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }
    
    // Verificar si el usuario tiene permisos para trackear items (todos excepto viewer)
    if (userAccess.role === 'viewer') {
      return NextResponse.json({ error: 'You do not have permission to track items' }, { status: 403 });
    }

    // Obtener la información de la tienda, incluyendo tokens de acceso
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('access_token, token_expiry, ml_user_id')
      .eq('id', selectedStoreId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verificar si el token ha expirado
    if (new Date(storeData.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }

    // Comprobar qué items ya están siendo trackeados para evitar duplicados
    const { data: existingItems, error: existingError } = await supabase
      .from('tracked_items_config')
      .select('item_id')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .in('item_id', itemIds);

    if (existingError) {
      console.error('Error checking existing items:', existingError);
      // Continuamos porque podemos manejar este caso
    }

    // Crear un mapa de items existentes para búsqueda rápida
    const existingItemsMap = new Map<string, boolean>();
    if (existingItems) {
      existingItems.forEach(item => {
        existingItemsMap.set(item.item_id, true);
      });
    }

    // Filtrar solo los items que no están siendo trackeados
    const newItemIds = itemIds.filter(id => !existingItemsMap.has(id));

    if (newItemIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All items are already being tracked',
        results: {
          total: itemIds.length,
          new: 0,
          existing: itemIds.length,
          failed: 0,
          errors: []
        }
      });
    }

    // Preparar datos para la inserción en batch
    const itemsToInsert = newItemIds.map(itemId => ({
      user_id: authUserId,
      store_id: selectedStoreId,
      item_id: itemId,
      notes: null,
      seller_id: '', // Se actualizará después con los datos del vendedor
      seller_nickname: '',
      processing_status: 'pending', // Nuevo campo para seguimiento
      processing_message: null      // Nuevo campo para mensajes de error
    }));

    // Insertar todos los nuevos items de una sola vez
    const { data: insertedItems, error: insertError } = await supabase
      .from('tracked_items_config')
      .insert(itemsToInsert)
      .select('id, item_id');

    if (insertError) {
      console.error('Error inserting tracked items:', insertError);
      return NextResponse.json({ error: 'Error adding items to track' }, { status: 500 });
    }

    // Procesar la obtención de datos para los items insertados
    // Usamos Promise.allSettled para no bloquear si algunos fallan
    if (insertedItems && insertedItems.length > 0) {
      const batchSize = 10; // Procesar en lotes más pequeños para no sobrecargar la API
      const itemGroups = [];
      const detailedErrors: { id: any; error: any; }[] = [];
      
      // Agrupar items para procesar en lotes
      for (let i = 0; i < insertedItems.length; i += batchSize) {
        itemGroups.push(insertedItems.slice(i, i + batchSize));
      }
      
      // Procesar cada grupo secuencialmente
      let fetchSuccess = 0;
      let fetchFailed = 0;
      
      for (const group of itemGroups) {
        const results = await Promise.allSettled(
          group.map(async (item) => {
            try {
                // Hacer la solicitud a la API de Mercado Libre para obtener la información del ítem
                const itemResponse = await fetch(`https://api.mercadolibre.com/items/${item.item_id}`, {
                  headers: {
                    'Authorization': `Bearer ${storeData.access_token}`
                  }
                });
              
                // Si la respuesta no es exitosa, manejar el error directamente sin intentar parsearlo como JSON
                if (!itemResponse.ok) {
                  const errorMessage = `Error API: ${itemResponse.status} - ${itemResponse.statusText}`;
                  
                  // Actualizar el estado del item a error
                  await supabase
                    .from('tracked_items_config')
                    .update({
                      processing_status: 'error',
                      processing_message: errorMessage
                    })
                    .eq('id', item.id);
                    
                  detailedErrors.push({
                    id: item.item_id,
                    error: errorMessage
                  });
                    
                  throw new Error(`Error fetching item ${item.item_id}: ${itemResponse.statusText}`);
                }
              
                // AHORA verificamos si la respuesta es JSON antes de procesarla
                const contentType = itemResponse.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                  const errorText = await itemResponse.text().catch(() => 'No text content');
                  const errorMessage = `Respuesta no es JSON: ${itemResponse.status} - ${errorText.substring(0, 100)}`;
                  
                  // Actualizar el estado del item a error
                  await supabase
                    .from('tracked_items_config')
                    .update({
                      processing_status: 'error',
                      processing_message: errorMessage
                    })
                    .eq('id', item.id);
                    
                  detailedErrors.push({
                    id: item.item_id,
                    error: errorMessage
                  });
                    
                  throw new Error(`Respuesta no es JSON para item ${item.item_id}: ${itemResponse.status}`);
                }
              
                // Solo si llegamos aquí, intentamos parsear como JSON
                const itemData = await itemResponse.json().catch(parseError => {
                  const errorMessage = `Error parsing JSON: ${parseError.message}`;
                  throw new Error(errorMessage);
                });
              

              // Obtener información del vendedor
              const sellerId = itemData.seller_id;
              let sellerNickname = '';
              
              try {
                const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
                  headers: {
                    'Authorization': `Bearer ${storeData.access_token}`
                  }
                });
                
                // Verificar si la respuesta del vendedor es JSON
                const sellerContentType = sellerResponse.headers.get('content-type');
                if (!sellerContentType || !sellerContentType.includes('application/json')) {
                  console.warn(`Respuesta de vendedor no es JSON para item ${item.item_id}`);
                  // Continuamos pero sin información del vendedor
                } else if (sellerResponse.ok) {
                  const sellerData = await sellerResponse.json();
                  sellerNickname = sellerData.nickname || '';
                }
              } catch (error) {
                console.error(`Error fetching seller info for item ${item.item_id}:`, error);
                // Continuamos incluso si hay error al obtener datos del vendedor
              }

              // Actualizar tracked_items_config con la información del vendedor y estado de éxito
              await supabase
                .from('tracked_items_config')
                .update({
                  seller_id: sellerId,
                  seller_nickname: sellerNickname,
                  processing_status: 'success',
                  processing_message: null
                })
                .eq('id', item.id);

              // Extraer la marca de los atributos si existe
              let brand = null;
              if (itemData.attributes && Array.isArray(itemData.attributes)) {
                const brandAttribute = itemData.attributes.find((attr: any) => attr.id === 'BRAND'); 
                if (brandAttribute && brandAttribute.value_name) {
                  brand = brandAttribute.value_name;
                }
              }

              // Obtener información del precio de venta
              let salePriceData = null;
              try {
                const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${item.item_id}/sale_price`, {
                  headers: {
                    'Authorization': `Bearer ${storeData.access_token}`
                  }
                });

                // Verificar si la respuesta del precio es JSON
                const priceContentType = salePriceResponse.headers.get('content-type');
                if (priceContentType && priceContentType.includes('application/json') && salePriceResponse.ok) {
                  salePriceData = await salePriceResponse.json();
                }
              } catch (error) {
                console.error(`Error fetching sale price for item ${item.item_id}:`, error);
                // Continuamos incluso si hay error al obtener el precio
              }

              // Guardar los datos en tracked_items_data
              const { error: dataInsertError } = await supabase
                .from('tracked_items_data')
                .insert({
                  config_id: item.id,
                  item_id: item.item_id,
                  site_id: itemData.site_id,
                  title: itemData.title,
                  seller_id: itemData.seller_id,
                  seller_nickname: sellerNickname,
                  category_id: itemData.category_id,
                  official_store_id: itemData.official_store_id,
                  price: itemData.price,
                  base_price: itemData.base_price,
                  currency_id: itemData.currency_id,
                  available_quantity: itemData.available_quantity,
                  permalink: itemData.permalink,
                  thumbnail: itemData.thumbnail,
                  status: itemData.status,
                  regular_amount: salePriceData?.regular_amount || null,
                  amount: salePriceData?.amount || null,
                  brand: brand,
                  last_updated: new Date().toISOString(),
                  created_at: new Date().toISOString()
                });
              
              if (dataInsertError) {
                console.error(`Error inserting data for item ${item.item_id}:`, dataInsertError);
                // Actualizar el estado del item en caso de error al insertar datos
                await supabase
                  .from('tracked_items_config')
                  .update({
                    processing_status: 'error_data',
                    processing_message: `Error al guardar datos: ${dataInsertError.message}`
                  })
                  .eq('id', item.id);
                  
                throw new Error(`Error inserting data for item ${item.item_id}: ${dataInsertError.message}`);
              }
              
              return { success: true };
            } catch (error: any) {
              console.error(`Error processing item ${item.item_id}:`, error);
              
              // Si no se actualizó el estado anteriormente, hacerlo ahora
              await supabase
                .from('tracked_items_config')
                .update({
                  processing_status: 'error',
                  processing_message: error.message || 'Unknown error'
                })
                .eq('id', item.id);
                
              // Añadir a la lista de errores detallados si no se añadió antes
              if (!detailedErrors.some(e => e.id === item.item_id)) {
                detailedErrors.push({
                  id: item.item_id,
                  error: error.message || 'Unknown error'
                });
              }
              
              return { success: false, error: error.message || 'Unknown error' };
            }
          })
        );
        
        // Contar los éxitos y fallos en este lote
        fetchSuccess += results.filter(r => 
          r.status === 'fulfilled' && (r.value as any).success
        ).length;
        
        fetchFailed += results.filter(r => 
          r.status === 'rejected' || !(r.value as any)?.success
        ).length;
        
        // Pequeña pausa entre grupos para evitar rate limits
        if (itemGroups.indexOf(group) < itemGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Preparar respuesta con información detallada
      return NextResponse.json({
        success: true,
        message: 'Bulk import processed successfully',
        results: {
          total: itemIds.length,
          new: insertedItems.length,
          existing: existingItemsMap.size,
          successful: fetchSuccess,
          failed: fetchFailed,
          errors: detailedErrors.slice(0, 50) // Limitamos a 50 errores para no sobrecargar la respuesta
        }
      });
    }

    // Preparar respuesta
    return NextResponse.json({
      success: true,
      message: 'Bulk import processed successfully',
      results: {
        total: itemIds.length,
        new: insertedItems?.length || 0,
        existing: existingItemsMap.size,
        failed: 0,
        errors: []
      }
    });
  } catch (error: any) {
    console.error('Error processing bulk import request:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}