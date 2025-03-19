import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el usuario desde la base de datos
    const supabase = createServerSupabaseClient();
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, access_token, token_expiry')
      .eq('user_id', mlUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verificar si el token ha expirado
    if (new Date(userData.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }

    // Hacer la solicitud a la API de Mercado Libre para obtener todos los productos del usuario
    const searchResponse = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search`, {
      headers: {
        'Authorization': `Bearer ${userData.access_token}`
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
                'Authorization': `Bearer ${userData.access_token}`
              }
            });

            if (!itemResponse.ok) {
              throw new Error(`Error fetching item ${itemId}: ${itemResponse.statusText}`);
            }

            const itemData = await itemResponse.json();

            // Obtener información del precio de venta
            const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
              headers: {
                'Authorization': `Bearer ${userData.access_token}`
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
              .eq('user_id', userData.id)
              .single();

            const itemToSave = {
              item_id: itemId,
              user_id: userData.id,
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