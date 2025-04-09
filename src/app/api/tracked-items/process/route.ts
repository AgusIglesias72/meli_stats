// src/app/api/tracked-items/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// Configuración para Edge Runtime
export const runtime = 'edge';
export const preferredRegion = 'auto';
export const maxDuration = 60; // 60 segundos

/**
 * POST: Procesa un lote de items pendientes
 * Este endpoint es para ser llamado por un cron job o manualmente
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar clave API para seguridad
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const apiKey = authHeader.split(' ')[1];
    const expectedApiKey = process.env.NEXT_PUBLIC_API_SECRET_KEY;
    
    if (apiKey !== expectedApiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    
    // Obtener parámetros de la solicitud
    const { batch_size = 50, store_id = null } = await request.json().catch(() => ({}));
    
    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Consultar items pendientes de procesamiento
    let query = supabase
      .from('tracked_items_config')
      .select('id, item_id, store_id')
      .eq('processing_status', 'pending')
      .order('id', { ascending: true })
      .limit(batch_size);
      
    // Filtrar por tienda si se especifica
    if (store_id) {
      query = query.eq('store_id', store_id);
    }
    
    const { data: pendingItems, error: queryError } = await query;
    
    if (queryError) {
      console.error('Error fetching pending items:', queryError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }
    
    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending items to process',
        processed: 0
      });
    }
    
    // Agrupar los items por tienda para procesamiento eficiente
    const itemsByStore: Record<string, Array<{id: string, item_id: string}>> = {};
    
    pendingItems.forEach(item => {
      if (!itemsByStore[item.store_id]) {
        itemsByStore[item.store_id] = [];
      }
      itemsByStore[item.store_id].push({
        id: item.id,
        item_id: item.item_id
      });
    });
    
    // Procesar items agrupados por tienda
    const results = {
      successful: 0,
      failed: 0,
      stores_processed: 0
    };
    
    // Para cada tienda, obtener el token y procesar sus items
    for (const storeId of Object.keys(itemsByStore)) {
      // Obtener token de acceso para la tienda
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('access_token, token_expiry, ml_user_id')
        .eq('id', storeId)
        .single();
        
      if (storeError || !storeData) {
        console.error(`Error fetching store data for store ${storeId}:`, storeError);
        
        // Marcar todos los items de esta tienda como error
        const batch = itemsByStore[storeId];
        await Promise.all(batch.map(item => 
          supabase
            .from('tracked_items_config')
            .update({
              processing_status: 'error',
              processing_message: 'Store not found or access denied'
            })
            .eq('id', item.id)
        ));
        
        results.failed += batch.length;
        continue;
      }
      
      // Verificar si el token ha expirado
      if (new Date(storeData.token_expiry) < new Date()) {
        // Marcar todos los items de esta tienda como error
        const batch = itemsByStore[storeId];
        await Promise.all(batch.map(item => 
          supabase
            .from('tracked_items_config')
            .update({
              processing_status: 'error',
              processing_message: 'Store token expired'
            })
            .eq('id', item.id)
        ));
        
        results.failed += batch.length;
        continue;
      }
      
      // Procesar los items de esta tienda
      const storeResults = await processStoreItems(itemsByStore[storeId], storeData, supabase);
      results.successful += storeResults.successful;
      results.failed += storeResults.failed;
      results.stores_processed++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.successful + results.failed} items from ${results.stores_processed} stores`,
      results
    });
  } catch (error: any) {
    console.error('Error processing tracked items:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * Procesa los items de una tienda específica
 */
async function processStoreItems(
  items: Array<{id: string, item_id: string}>,
  storeData: any,
  supabase: any
): Promise<{ successful: number, failed: number }> {
  // Procesar en lotes más pequeños para evitar sobrecargar la API
  const batchSize = 10;
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processItem(item, storeData, supabase))
    );
    
    // Contar éxitos y fallos
    successful += batchResults.filter(
      result => result.status === 'fulfilled' && (result.value as any).success
    ).length;
    
    failed += batchResults.filter(
      result => result.status === 'rejected' || !(result.value as any).success
    ).length;
    
    // Pequeña pausa entre lotes para evitar rate limiting
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return { successful, failed };
}

/**
 * Procesa un solo item
 */
async function processItem(
  item: {id: string, item_id: string},
  storeData: any,
  supabase: any
): Promise<{ success: boolean, id: string, error?: string }> {
  try {
    // Hacer la solicitud a la API de Mercado Libre para obtener la información del ítem
    const itemResponse = await fetch(`https://api.mercadolibre.com/items/${item.item_id}`, {
      headers: {
        'Authorization': `Bearer ${storeData.access_token}`
      }
    });

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
        
      return {
        success: false,
        id: item.id,
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
        id: item.id,
        error: `Error inserting data: ${dataInsertError.message}`
      };
    }
    
    return { 
      success: true,
      id: item.id
    };
  } catch (error: any) {
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
      id: item.id,
      error: error.message || 'Unknown error'
    };
  }
}