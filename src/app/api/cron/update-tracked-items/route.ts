import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// Clave secreta para autorizar peticiones externas
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'default-secret-key-change-this';

export async function POST(request: NextRequest) {
  try {
    // Verificar la autorización mediante clave secreta
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ') || authorization.split(' ')[1] !== API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID del usuario cuyas items se van a actualizar
    // Si no se proporciona, actualizaremos todos los usuarios
    const { userId } = await request.json().catch(() => ({}));

    const supabase = createServerSupabaseClient();
    
    // Si se proporciona un userId, verificar que existe
    if (userId) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    // Obtener todos los usuarios activos con sus tokens
    const { data: usersWithTokens, error: usersError } = await supabase
      .from('users')
      .select('id, user_id, access_token')
      .eq(userId ? 'user_id' : 'id IS NOT NULL', userId || true);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
    }

    if (!usersWithTokens || usersWithTokens.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No users found to update items'
      });
    }

    // Para cada usuario, actualizar sus items trackeados
    const updateResults = await Promise.all(
      usersWithTokens.map(async (user) => {
        try {
          // Obtener todos los items a trackear del usuario
          const { data: trackedItems, error: itemsError } = await supabase
            .from('tracked_items_config')
            .select('id, item_id')
            .eq('user_id', user.id);

          if (itemsError) {
            throw new Error(`Error fetching tracked items for user ${user.user_id}: ${itemsError.message}`);
          }

          if (!trackedItems || trackedItems.length === 0) {
            return {
              user_id: user.user_id,
              updated: 0,
              failed: 0,
              message: 'No items to update'
            };
          }

          // Actualizar cada item
          const itemUpdateResults = await Promise.allSettled(
            trackedItems.map(async (trackedItem) => {
              try {
                // Hacer la solicitud a la API de Mercado Libre para obtener la información del ítem
                const itemResponse = await fetch(`https://api.mercadolibre.com/items/${trackedItem.item_id}`, {
                  headers: {
                    'Authorization': `Bearer ${user.access_token}`
                  }
                });

                if (!itemResponse.ok) {
                  throw new Error(`Error fetching item ${trackedItem.item_id}: ${itemResponse.statusText}`);
                }

                const itemData = await itemResponse.json();

                // Obtener información del precio de venta
                const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${trackedItem.item_id}/sale_price`, {
                  headers: {
                    'Authorization': `Bearer ${user.access_token}`
                  }
                });

                let salePriceData = null;
                if (salePriceResponse.ok) {
                  salePriceData = await salePriceResponse.json();
                }

                // Guardar los datos en la tabla de datos trackeados
                const { error: insertError } = await supabase
                  .from('tracked_items_data')
                  .insert({
                    config_id: trackedItem.id,
                    item_id: trackedItem.item_id,
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
                  });

                if (insertError) {
                  throw new Error(`Error inserting data for item ${trackedItem.item_id}: ${insertError.message}`);
                }

                return {
                  success: true,
                  item_id: trackedItem.item_id
                };
              } catch (error: any) {
                return {
                  success: false,
                  item_id: trackedItem.item_id,
                  error: error.message || 'Unknown error'
                };
              }
            })
          );

          // Contar éxitos y fracasos
          const successful = itemUpdateResults.filter(result => 
            result.status === 'fulfilled' && (result.value as any).success
          ).length;
          
          const failed = itemUpdateResults.filter(result => 
            result.status === 'rejected' || !(result.value as any).success
          ).length;

          return {
            user_id: user.user_id,
            updated: successful,
            failed: failed,
            total: trackedItems.length
          };
        } catch (error: any) {
          return {
            user_id: user.user_id,
            updated: 0,
            failed: 0,
            error: error.message || 'Unknown error'
          };
        }
      })
    );

    // Preparar resumen de resultados
    const totalSuccessful = updateResults.reduce((acc, result) => acc + result.updated, 0);
    const totalFailed = updateResults.reduce((acc, result) => acc + result.failed, 0);
    const totalUsers = updateResults.length;
    const usersWithErrors = updateResults.filter(result => 'error' in result).length;

    return NextResponse.json({
      success: true,
      message: `Updated items for ${totalUsers} users. Total: ${totalSuccessful} successful, ${totalFailed} failed`,
      summary: {
        users_processed: totalUsers,
        users_with_errors: usersWithErrors,
        total_items_updated: totalSuccessful,
        total_items_failed: totalFailed
      },
      details: updateResults
    });
  } catch (error) {
    console.error('Error processing cron update request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}