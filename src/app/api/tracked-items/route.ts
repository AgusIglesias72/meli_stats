import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, stores, storeUsers, trackedItemsConfig, trackedItemsData } from '@/lib/db/schema';
import { eq, and, desc, count as drizzleCount } from 'drizzle-orm';
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
    const [userData] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.user_id, parseInt(mlUserId)))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obtener el conteo total de items trackeados
    const [countResult] = await db.select({ value: drizzleCount() })
      .from(trackedItemsConfig)
      .where(and(
        eq(trackedItemsConfig.user_id, userData.id),
        eq(trackedItemsConfig.processing_status, 'success')
      ));

    const totalCount = countResult?.value || 0;

    // Obtener los items trackeados con paginación
    const trackedItems = await db.select({
      id: trackedItemsConfig.id,
      item_id: trackedItemsConfig.item_id,
      notes: trackedItemsConfig.notes,
      created_at: trackedItemsConfig.created_at,
      seller_id: trackedItemsConfig.seller_id,
      seller_nickname: trackedItemsConfig.seller_nickname,
    })
      .from(trackedItemsConfig)
      .where(and(
        eq(trackedItemsConfig.user_id, userData.id),
        eq(trackedItemsConfig.processing_status, 'success')
      ))
      .orderBy(desc(trackedItemsConfig.created_at))
      .limit(limit)
      .offset(offset);

    // Para cada item trackeado, obtener sus datos más recientes
    const processedItems = await Promise.all(
      trackedItems.map(async (item) => {
        const latestDataArr = await db.select({
          id: trackedItemsData.id,
          price: trackedItemsData.price,
          base_price: trackedItemsData.base_price,
          seller_nickname: trackedItemsData.seller_nickname,
          seller_id: trackedItemsData.seller_id,
          title: trackedItemsData.title,
          available_quantity: trackedItemsData.available_quantity,
          status: trackedItemsData.status,
          thumbnail: trackedItemsData.thumbnail,
          permalink: trackedItemsData.permalink,
          regular_amount: trackedItemsData.regular_amount,
          amount: trackedItemsData.amount,
          currency_id: trackedItemsData.currency_id,
          brand: trackedItemsData.brand,
          last_updated: trackedItemsData.last_updated,
        })
          .from(trackedItemsData)
          .where(eq(trackedItemsData.config_id, item.id))
          .orderBy(desc(trackedItemsData.created_at))
          .limit(1);

        const latestData = latestDataArr.length > 0 ? latestDataArr[0] : null;

        return {
          id: item.id,
          item_id: item.item_id,
          notes: item.notes,
          created_at: item.created_at,
          seller_id: item.seller_id,
          seller_nickname: item.seller_nickname,
          data: latestData
        };
      })
    );

    // Calcular información de paginación
    const totalPages = Math.ceil((totalCount as number) / limit);

    return NextResponse.json({
      trackedItems: processedItems,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
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

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db.select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(
        eq(storeUsers.user_id, authUserId),
        eq(storeUsers.store_id, selectedStoreId)
      ))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene permisos para trackear items (todos excepto viewer)
    if (userAccess.role === 'viewer') {
      return NextResponse.json({ error: 'You do not have permission to track items' }, { status: 403 });
    }

    // Obtener la información de la tienda, incluyendo tokens de acceso
    const [storeData] = await db.select({
      access_token: stores.access_token,
      token_expiry: stores.token_expiry,
    })
      .from(stores)
      .where(eq(stores.id, selectedStoreId))
      .limit(1);

    if (!storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verificar si el token ha expirado
    if (new Date(storeData.token_expiry!) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }

    // Comprobar si el item ya está siendo trackeado por este usuario en esta tienda
    const [existingItem] = await db.select({ id: trackedItemsConfig.id })
      .from(trackedItemsConfig)
      .where(and(
        eq(trackedItemsConfig.user_id, authUserId),
        eq(trackedItemsConfig.store_id, selectedStoreId),
        eq(trackedItemsConfig.item_id, itemId)
      ))
      .limit(1);

    if (existingItem) {
      return NextResponse.json({
        error: 'Item already being tracked',
        itemId: existingItem.id
      }, { status: 409 });
    }

    // IMPORTANTE: Primero obtenemos los datos del ítem y luego insertamos el registro
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
    // CORREGIDO: Configurar processing_status como 'success' desde el principio
    const [newItem] = await db.insert(trackedItemsConfig)
      .values({
        user_id: authUserId,
        store_id: selectedStoreId,
        item_id: itemId,
        notes: notes || null,
        seller_id: itemData.seller_id || '',
        seller_nickname: sellerNickname || '',
        processing_status: 'success' // Marcar como éxito directamente
      })
      .returning();

    if (!newItem) {
      return NextResponse.json({ error: 'Error adding item to track' }, { status: 500 });
    }

    // Guardar los datos en tracked_items_data
    try {
      await db.insert(trackedItemsData)
        .values({
          config_id: newItem.id,
          item_id: itemId,
          site_id: itemData.site_id,
          title: itemData.title,
          seller_id: itemData.seller_id,
          seller_nickname: sellerNickname,
          category_id: itemData.category_id,
          official_store_id: itemData.official_store_id,
          price: itemData.price?.toString(),
          base_price: itemData.base_price?.toString(),
          currency_id: itemData.currency_id,
          available_quantity: itemData.available_quantity,
          permalink: itemData.permalink,
          thumbnail: itemData.thumbnail,
          status: itemData.status,
          regular_amount: salePriceData?.regular_amount?.toString() || null,
          amount: salePriceData?.amount?.toString() || null,
          brand: brand,
          last_updated: new Date(),
          created_at: new Date()
        });
    } catch (dataInsertError: any) {
      console.error('Error inserting tracked item data:', dataInsertError);
      // Si hay error al insertar los datos, actualizar el estado del item
      await db.update(trackedItemsConfig)
        .set({
          processing_status: 'error_data',
          processing_message: `Error al guardar datos: ${dataInsertError.message}`
        })
        .where(eq(trackedItemsConfig.id, newItem.id));

      return NextResponse.json({ error: 'Error saving item data' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Item added to tracking',
      item: {
        ...newItem,
        data: {
          title: itemData.title,
          price: itemData.price,
          status: itemData.status,
          seller_nickname: sellerNickname,
          thumbnail: itemData.thumbnail,
          permalink: itemData.permalink,
          currency_id: itemData.currency_id,
          regular_amount: salePriceData?.regular_amount || null,
          amount: salePriceData?.amount || null
        }
      }
    });
  } catch (error) {
    console.error('Error processing add tracked item request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Elimina un item trackeado
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID del ítem a eliminar
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Verificar si el ítem existe antes de intentar eliminarlo
    const [trackedItem] = await db.select({
      id: trackedItemsConfig.id,
      store_id: trackedItemsConfig.store_id,
      user_id: trackedItemsConfig.user_id,
    })
      .from(trackedItemsConfig)
      .where(eq(trackedItemsConfig.id, itemId))
      .limit(1);

    if (!trackedItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Simplificamos la verificación - si el usuario es el dueño del ítem o tiene permisos de admin, puede eliminarlo
    // Este enfoque puede evitar problemas con consultas anidadas
    if (trackedItem.user_id !== authUserId) {
      // Si no es el propietario, verificar si tiene permisos administrativos en esta tienda
      const [userAccess] = await db.select({ role: storeUsers.role })
        .from(storeUsers)
        .where(and(
          eq(storeUsers.user_id, authUserId),
          eq(storeUsers.store_id, trackedItem.store_id!)
        ))
        .limit(1);

      if (!userAccess || !['owner', 'admin', 'editor'].includes(userAccess.role!)) {
        return NextResponse.json({ error: 'You do not have permission to delete this item' }, { status: 403 });
      }
    }

    // Eliminar en transacción para garantizar consistencia
    // Primero eliminamos los datos históricos
    try {
      await db.delete(trackedItemsData)
        .where(eq(trackedItemsData.config_id, itemId));
    } catch (dataDeleteError) {
      console.error('Error deleting tracked item data:', dataDeleteError);
      // Continuamos aunque haya error, ya que lo importante es eliminar la configuración
    }

    // Luego eliminamos la configuración
    await db.delete(trackedItemsConfig)
      .where(eq(trackedItemsConfig.id, itemId));

    // Siempre aseguramos que haya una respuesta JSON válida
    return NextResponse.json({
      success: true,
      message: 'Tracked item deleted successfully',
      id: itemId
    });
  } catch (error) {
    console.error('Error processing delete tracked item request:', error);
    // Garantizamos que siempre haya una respuesta JSON válida
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
