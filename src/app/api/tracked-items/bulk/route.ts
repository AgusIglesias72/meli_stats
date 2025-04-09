// src/app/api/tracked-items/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Configuración para Edge Runtime
export const runtime = 'edge';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos máximo para la función

// Interfaz para el resultado de procesamiento
interface ProcessingResult {
  success: boolean;
  itemId: string;
  error?: string;
}

// POST: Importación masiva de items para trackear
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = request.cookies.get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = request.cookies.get('selected_store_id')?.value;
    
    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
    }

    // Obtener datos del cuerpo
    const { itemIds } = await request.json();
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Item IDs array is required' }, { status: 400 });
    }

    // Limitar el número de items a importar
    if (itemIds.length > 10000) {
      return NextResponse.json({ 
        error: `Too many items (${itemIds.length}). Maximum allowed is 10000.` 
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

    // Preparar datos para la inserción en batch - solo la configuración inicial
    const itemsToInsert = newItemIds.map(itemId => ({
      user_id: authUserId,
      store_id: selectedStoreId,
      item_id: itemId,
      notes: null,
      seller_id: '', 
      seller_nickname: '',
      processing_status: 'pending',
      processing_message: null
    }));

    // Insertar todos los nuevos items de una sola vez - solo la configuración
    const { data: insertedItems, error: insertError } = await supabase
      .from('tracked_items_config')
      .insert(itemsToInsert)
      .select('id, item_id');

    if (insertError) {
      console.error('Error inserting tracked items:', insertError);
      return NextResponse.json({ error: 'Error adding items to track' }, { status: 500 });
    }

    // Devolver respuesta inmediata para no bloquear al cliente
    // Esta es una mejora clave - el cliente obtiene una respuesta rápida mientras
    // el procesamiento continúa en segundo plano
    const responseData = {
      success: true,
      message: 'Bulk import initiated successfully',
      results: {
        total: itemIds.length,
        new: insertedItems?.length || 0,
        existing: existingItemsMap.size,
        processing: true,
        jobId: Date.now().toString() // Un identificador simple para el trabajo
      }
    };

    // Iniciar el procesamiento en segundo plano sin bloquear la respuesta
    if (insertedItems && insertedItems.length > 0) {
      // Procesamiento asíncrono en segundo plano
      processItemsInBackground(insertedItems, storeData, supabase)
        .catch(err => console.error('Background processing error:', err));
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Error processing bulk import request:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * Procesa los items en segundo plano, en lotes, sin bloquear la respuesta al cliente
 */
async function processItemsInBackground(
  items: Array<{id: string, item_id: string}>, 
  storeData: any, 
  supabase: any
) {
  // Tamaño de lote optimizado para balancear velocidad y límites de API
  const batchSize = 20;
  
  // Procesar en lotes paralelos para mayor velocidad
  // pero limitando la concurrencia para no sobrecargar la API
  const concurrencyLimit = 5;
  
  for (let startIdx = 0; startIdx < items.length; startIdx += batchSize * concurrencyLimit) {
    const batchPromises = [];
    
    // Crear múltiples promesas para procesamiento paralelo
    for (let i = 0; i < concurrencyLimit && startIdx + i * batchSize < items.length; i++) {
      const batchStartIdx = startIdx + i * batchSize;
      const batchEndIdx = Math.min(batchStartIdx + batchSize, items.length);
      const batch = items.slice(batchStartIdx, batchEndIdx);
      
      batchPromises.push(processBatch(batch, storeData, supabase));
    }
    
    // Esperar a que todos los lotes actuales terminen antes de continuar
    await Promise.all(batchPromises);
  }
  
  console.log(`Background processing completed for ${items.length} items`);
}

/**
 * Procesa un lote de items
 */
async function processBatch(
  batch: Array<{id: string, item_id: string}>, 
  storeData: any, 
  supabase: any
): Promise<void> {
  const results = await Promise.allSettled(
    batch.map(item => processItem(item, storeData, supabase))
  );
  
  // Contar éxitos y fallos
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = batch.length - successful;
  
  console.log(`Batch processed: ${successful} successful, ${failed} failed`);
}

/**
 * Procesa un solo item, con manejo de errores y reintentos
 */
async function processItem(
  item: {id: string, item_id: string}, 
  storeData: any, 
  supabase: any
): Promise<ProcessingResult> {
  const maxRetries = 2;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      // Hacer la solicitud a la API de Mercado Libre para obtener la información del ítem
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${item.item_id}`, {
        headers: {
          'Authorization': `Bearer ${storeData.access_token}`
        }
      });
    
      // Si la respuesta no es exitosa, manejar el error
      if (!itemResponse.ok) {
        // En caso de error 429 (rate limit), esperar y reintentar
        if (itemResponse.status === 429 && retryCount < maxRetries) {
          retryCount++;
          // Esperar más tiempo en cada reintento
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        const errorMessage = `Error API: ${itemResponse.status} - ${itemResponse.statusText}`;
        
        // Actualizar el estado del item a error
        await supabase
          .from('tracked_items_config')
          .update({
            processing_status: 'error',
            processing_message: errorMessage
          })
          .eq('id', item.id);
          
        return {
          success: false,
          itemId: item.item_id,
          error: errorMessage
        };
      }
    
      // Verificar si la respuesta es JSON antes de procesarla
      const contentType = itemResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await itemResponse.text().catch(() => 'No text content');
        const errorMessage = `Respuesta no es JSON: ${errorText.substring(0, 100)}`;
        
        // Actualizar el estado del item a error
        await supabase
          .from('tracked_items_config')
          .update({
            processing_status: 'error',
            processing_message: errorMessage
          })
          .eq('id', item.id);
          
        return {
          success: false,
          itemId: item.item_id,
          error: errorMessage
        };
      }
    
      // Parsear la respuesta JSON
      const itemData = await itemResponse.json();

      // Obtener información del vendedor
      const sellerId = itemData.seller_id;
      let sellerNickname = '';
      
      try {
        const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
          headers: {
            'Authorization': `Bearer ${storeData.access_token}`
          }
        });
        
        if (sellerResponse.ok) {
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

        if (salePriceResponse.ok) {
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
          
        return {
          success: false,
          itemId: item.item_id,
          error: `Error inserting data: ${dataInsertError.message}`
        };
      }
      
      return { 
        success: true,
        itemId: item.item_id
      };
      
    } catch (error: any) {
      // Si hay error y aún tenemos reintentos, reintentar
      if (retryCount < maxRetries) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        continue;
      }
      
      console.error(`Error processing item ${item.item_id}:`, error);
      
      // Actualizar el estado del item
      try {
        await supabase
          .from('tracked_items_config')
          .update({
            processing_status: 'error',
            processing_message: error.message || 'Unknown error'
          })
          .eq('id', item.id);
      } catch (updateError) {
        console.error(`Error updating item status for ${item.item_id}:`, updateError);
      }
      
      return { 
        success: false,
        itemId: item.item_id,
        error: error.message || 'Unknown error'
      };
    }
  }
  
  // Este punto nunca debería alcanzarse debido a los returns en el bucle
  return {
    success: false,
    itemId: item.item_id,
    error: 'Unexpected execution flow'
  };
}