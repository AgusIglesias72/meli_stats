import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET: Obtiene todos los items trackeados por el usuario
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener parámetros de paginación
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Obtener el usuario desde la base de datos
    const supabase = createServerSupabaseClient();
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', mlUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obtener los items trackeados y sus datos más recientes
    const { data: trackedItems, error: itemsError, count } = await supabase
      .from('tracked_items_config')
      .select(`
        id,
        item_id,
        notes,
        created_at,
        tracked_items_data (
          id,
          price,
          base_price,
          seller_nickname,
          seller_id,
          title,
          available_quantity,
          status,
          thumbnail,
          permalink,
          regular_amount,
          amount,
          currency_id,
          brand,
          last_updated
        )
      `, { count: 'exact' })
      .eq('user_id', userData.id)
      .eq('processing_status', 'success')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error('Error fetching tracked items:', itemsError);
      return NextResponse.json({ error: 'Error fetching tracked items' }, { status: 500 });
    }

    // Procesar los resultados para un formato más amigable
    const processedItems = trackedItems.map(item => {
      const latestData = item.tracked_items_data && item.tracked_items_data.length > 0
        ? item.tracked_items_data[0] // Asumimos que el más reciente viene primero
        
        : null;

      return {
        id: item.id,
        item_id: item.item_id,
        notes: item.notes,
        created_at: item.created_at,
        data: latestData
      };
    });

    // Calcular información de paginación
    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      trackedItems: processedItems,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error processing tracked items request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Añade un nuevo item para trackear
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
    const { itemId, notes } = await request.json();
    
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
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
      .select('access_token, token_expiry')
      .eq('id', selectedStoreId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verificar si el token ha expirado
    if (new Date(storeData.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }

    // Comprobar si el item ya está siendo trackeado por este usuario en esta tienda
    const { data: existingItem } = await supabase
      .from('tracked_items_config')
      .select('id')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .eq('item_id', itemId)
      .single();

    if (existingItem) {
      return NextResponse.json({ 
        error: 'Item already being tracked', 
        itemId: existingItem.id 
      }, { status: 409 });
    }
  // Ahora, primero obtenemos los datos del ítem antes de insertarlo
    // para asegurarnos de tener toda la información desde el principio
    let itemData;
    let salePriceData = null;
    let sellerNickname = '';
    let brand = null;

    try {
      // Obtener información del producto de Mercado Libre
      const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${storeData.access_token}`
        }
      });

      if (!itemResponse.ok) {
        return NextResponse.json({ 
          error: `Error fetching item: ${itemResponse.statusText}` 
        }, { status: itemResponse.status });
      }

      itemData = await itemResponse.json();

      // Obtener información del vendedor
      if (itemData.seller_id) {
        const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${itemData.seller_id}`, {
          headers: {
            'Authorization': `Bearer ${storeData.access_token}`
          }
        });
        
        if (sellerResponse.ok) {
          const sellerData = await sellerResponse.json();
          sellerNickname = sellerData.nickname || '';
        }
      }

      // Obtener información del precio de venta
      const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
        headers: {
          'Authorization': `Bearer ${storeData.access_token}`
        }
      });

      if (salePriceResponse.ok) {
        salePriceData = await salePriceResponse.json();
      }

      // Extraer la marca de los atributos si existe
      if (itemData.attributes && Array.isArray(itemData.attributes)) {
        const brandAttribute = itemData.attributes.find((attr: any) => attr.id === 'BRAND'); 
        if (brandAttribute && brandAttribute.value_name) {
          brand = brandAttribute.value_name;
        }
      }
    } catch (error) {
      console.error(`Error fetching item data: ${error}`);
      return NextResponse.json({ 
        error: 'Error fetching item information from Mercado Libre' 
      }, { status: 500 });
    }

    // Ahora que tenemos todos los datos, añadimos la configuración con la información del vendedor
    const { data: newItem, error: insertError } = await supabase
      .from('tracked_items_config')
      .insert({
        user_id: authUserId,
        store_id: selectedStoreId,
        item_id: itemId,
        notes: notes || null,
        seller_id: itemData.seller_id || '',
        seller_nickname: sellerNickname || '',
        processing_status: 'success' // Marcar como éxito en lugar de 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting tracked item:', insertError);
      return NextResponse.json({ error: 'Error adding item to track' }, { status: 500 });
    }

    // Guardar los datos en tracked_items_data
    await supabase
      .from('tracked_items_data')
      .insert({
        config_id: newItem.id,
        item_id: itemId,
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

    return NextResponse.json({
      success: true,
      message: 'Item added to tracking',
      item: {
        ...newItem,
        data: {
          title: itemData.title,
          price: itemData.price,
          status: itemData.status,
          seller_nickname: sellerNickname
        }
      }
    });
  } catch (error) {
    console.error('Error processing add tracked item request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// DELETE: Elimina un item de la lista de trackeo
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    
    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;  

    if (!selectedStoreId) {
      return NextResponse.json({ error: 'ID de tienda no proporcionado' }, { status: 400 });
    }

    // Obtener el ID del item a eliminar desde el cuerpo de la solicitud
    const { itemId } = await request.json();

    if (!itemId) {
      return NextResponse.json({ error: 'ID de item no proporcionado' }, { status: 400 });
    }
    
    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();

    // Eliminar el item de la base de datos
    const { error: deleteError } = await supabase
      .from('tracked_items')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId);

    if (deleteError) {
      console.error('Error eliminando el item de seguimiento:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar el item de seguimiento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Item eliminado de seguimiento' });
  } catch (error) {
    console.error('Error procesando la solicitud de eliminación de item:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
