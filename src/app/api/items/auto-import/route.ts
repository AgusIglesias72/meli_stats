// src/app/api/items/auto-import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

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
    
    // Verificar si el usuario tiene permisos para importar (todos excepto viewer)
    if (userAccess.role === 'viewer') {
      return NextResponse.json({ error: 'You do not have permission to import items' }, { status: 403 });
    }

    // Obtener la información de la tienda, incluyendo tokens de acceso
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry')
      .eq('id', selectedStoreId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verificar si el token ha expirado
    if (new Date(storeData.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }

    // Hacer la solicitud a la API de Mercado Libre para obtener todos los productos del usuario
    const searchResponse = await fetch(`https://api.mercadolibre.com/users/${storeData.ml_user_id}/items/search`, {
      headers: {
        'Authorization': `Bearer ${storeData.access_token}`
      }
    });

    if (!searchResponse.ok) {
      return NextResponse.json(
        { error: 'Error fetching items from Mercado Libre' },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();
    const itemIds = searchData.results || [];

    if (itemIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items found for this seller',
        imported: 0
      });
    }

    

    // Procesar cada ítem en lotes para no sobrecargar la API
    const batchSize = 20;
    let importedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (itemId: string) => {
          try {
            // Obtener detalles del ítem
            const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
              headers: {
                'Authorization': `Bearer ${storeData.access_token}`
              }
            });

            if (!itemResponse.ok) {
              throw new Error(`Error fetching item ${itemId}: ${itemResponse.statusText}`);
            }

            const itemData = await itemResponse.json();


            // Obtener información del vendedor
            let sellerNickname = '';
            try {
              const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${itemData.seller_id}`, {
                headers: {
                  'Authorization': `Bearer ${storeData.access_token}`
                }
              });
              
              if (sellerResponse.ok) {
                const sellerData = await sellerResponse.json();
                sellerNickname = sellerData.nickname || '';
              }
            } catch (error) {
              console.error(`Error fetching seller info for item ${itemId}:`, error);
              // Continuamos incluso si hay error al obtener datos del vendedor
            }

            // Obtener información del precio de venta
            const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
              headers: {
                'Authorization': `Bearer ${storeData.access_token}`
              }
            });

            let salePriceData = null;
            if (salePriceResponse.ok) {
              salePriceData = await salePriceResponse.json();
            }

            // Crear o actualizar el ítem en la base de datos
            const { data: existingItem } = await supabase
              .from('items')
              .select('id')
              .eq('item_id', itemId)
              .eq('user_id', authUserId)
              .single();

            const itemToSave = {
              item_id: itemId,
              user_id: authUserId,
              store_id: selectedStoreId, // Asociar con la tienda actual
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
              last_updated: new Date().toISOString()
            };

            if (existingItem) {
              await supabase
                .from('items')
                .update(itemToSave)
                .eq('id', existingItem.id);
            } else {
              await supabase
                .from('items')
                .insert(itemToSave);
            }

            return {
              success: true,
              item_id: itemId
            };
          } catch (error: any) {
            console.error(`Error processing item ${itemId}:`, error);
            return {
              success: false,
              item_id: itemId,
              error: error.message
            };
          }
        })
      );

      // Contar éxitos y fracasos
      importedCount += batchResults.filter(
        result => result.status === 'fulfilled' && (result.value as any).success
      ).length;
      
      failedCount += batchResults.filter(
        result => result.status === 'rejected' || !(result.value as any).success
      ).length;

      // Pequeña pausa para no saturar la API
      if (i + batchSize < itemIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-import completed. Imported: ${importedCount}, Failed: ${failedCount}`,
      total: itemIds.length,
      imported: importedCount,
      failed: failedCount
    });
  } catch (error) {
    console.error('Error processing auto-import request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}