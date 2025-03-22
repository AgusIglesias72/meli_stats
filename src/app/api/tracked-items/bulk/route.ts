// src/app/api/tracked-items/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

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
          failed: 0
        }
      });
    }

    // Preparar datos para la inserción en batch
    const itemsToInsert = newItemIds.map(itemId => ({
      user_id: authUserId,
      store_id: selectedStoreId,
      item_id: itemId,
      notes: null
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

              if (!itemResponse.ok) {
                throw new Error(`Error fetching item ${item.item_id}: ${itemResponse.statusText}`);
              }

              const itemData = await itemResponse.json();

              // Extraer la marca de los atributos si existe
              let brand = null;
              if (itemData.attributes && Array.isArray(itemData.attributes)) {
                const brandAttribute = itemData.attributes.find((attr: any) => attr.id === 'BRAND'); 
                if (brandAttribute && brandAttribute.value_name) {
                  brand = brandAttribute.value_name;
                }
              }

              // Obtener información del precio de venta
              const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${item.item_id}/sale_price`, {
                headers: {
                  'Authorization': `Bearer ${storeData.access_token}`
                }
              });

              let salePriceData = null;
              if (salePriceResponse.ok) {
                salePriceData = await salePriceResponse.json();
              }

              // Guardar los datos en tracked_items_data
              await supabase
                .from('tracked_items_data')
                .insert({
                  config_id: item.id,
                  item_id: item.item_id,
                  site_id: itemData.site_id,
                  title: itemData.title,
                  seller_id: itemData.seller_id,
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
                  last_updated: new Date().toISOString()
                });
              
              return { success: true };
            } catch (error) {
              console.error(`Error fetching data for item ${item.item_id}:`, error);
              return { success: false };
            }
          })
        );
        
        fetchSuccess += results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        fetchFailed += results.filter(r => r.status === 'rejected' || !(r.value as any)?.success).length;
        
        // Pequeña pausa entre grupos para evitar rate limits
        if (itemGroups.indexOf(group) < itemGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`Fetch data results: ${fetchSuccess} successful, ${fetchFailed} failed`);
    }

    // Preparar respuesta
    return NextResponse.json({
      success: true,
      message: 'Bulk import processed successfully',
      results: {
        total: itemIds.length,
        new: insertedItems?.length || 0,
        existing: existingItemsMap.size,
        failed: 0
      }
    });
  } catch (error) {
    console.error('Error processing bulk import request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}