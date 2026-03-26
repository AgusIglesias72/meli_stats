// src/app/api/tracked-items/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, trackedItemsConfig, trackedItemsData } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

// POST: Actualiza todos los items trackeados
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;

    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el usuario desde la base de datos
    const [userData] = await db.select()
      .from(users)
      .where(eq(users.user_id, parseInt(mlUserId)))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verificar si el token ha expirado
    // Note: access_token and token_expiry may exist on the DB table but not in Drizzle schema
    const userDataAny = userData as any;
    if (new Date(userDataAny.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }

    // Obtener todos los items trackeados por el usuario
    const trackedItems = await db.select({
      id: trackedItemsConfig.id,
      item_id: trackedItemsConfig.item_id,
    })
      .from(trackedItemsConfig)
      .where(eq(trackedItemsConfig.user_id, userData.id));

    if (!trackedItems || trackedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tracked items to update',
        updated: 0,
        failed: 0
      });
    }

    // Actualizar cada item trackeado
    const updateResults = await Promise.allSettled(
      trackedItems.map(async (trackedItem) => {
        try {
          // Obtener información del ítem de la API de Mercado Libre
          const itemResponse = await fetch(`https://api.mercadolibre.com/items/${trackedItem.item_id}`, {
            headers: {
              'Authorization': `Bearer ${userDataAny.access_token}`
            }
          });

          if (!itemResponse.ok) {
            throw new Error(`Error fetching item ${trackedItem.item_id}: ${itemResponse.statusText}`);
          }

          const itemData = await itemResponse.json();

          // Obtener información del vendedor
          const sellerId = itemData.seller_id;
          let sellerNickname = '';

          try {
            const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
              headers: {
                'Authorization': `Bearer ${userDataAny.access_token}`
              }
            });

            if (sellerResponse.ok) {
              const sellerData = await sellerResponse.json();
              sellerNickname = sellerData.nickname || '';

              // Actualizar información del vendedor en tracked_items_config
              await db.update(trackedItemsConfig)
                .set({
                  seller_id: sellerId,
                  seller_nickname: sellerNickname
                })
                .where(eq(trackedItemsConfig.id, trackedItem.id));
            }
          } catch (error) {
            console.error(`Error fetching seller info for item ${trackedItem.item_id}:`, error);
            // Continuamos incluso si hay error al obtener datos del vendedor
          }

          // Obtener información del precio de venta
          const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${trackedItem.item_id}/sale_price`, {
            headers: {
              'Authorization': `Bearer ${userDataAny.access_token}`
            }
          });

          let salePriceData = null;
          if (salePriceResponse.ok) {
            salePriceData = await salePriceResponse.json();
          }

          // Extraer la marca de los atributos si existe
          let brand = null;
          if (itemData.attributes && Array.isArray(itemData.attributes)) {
            const brandAttribute = itemData.attributes.find((attr: any) => attr.id === 'BRAND');
            if (brandAttribute && brandAttribute.value_name) {
              brand = brandAttribute.value_name;
            }
          }

          // Guardar los datos actualizados en tracked_items_data
          await db.insert(trackedItemsData)
            .values({
              config_id: trackedItem.id,
              item_id: trackedItem.item_id,
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

          return {
            success: true,
            item_id: trackedItem.item_id
          };
        } catch (error: any) {
          console.error(`Error updating tracked item ${trackedItem.item_id}:`, error);
          return {
            success: false,
            item_id: trackedItem.item_id,
            error: error.message || 'Unknown error'
          };
        }
      })
    );

    // Contar los éxitos y fallos
    const successful = updateResults.filter(
      result => result.status === 'fulfilled' && (result.value as any).success
    ).length;

    const failed = updateResults.filter(
      result => result.status === 'rejected' || !(result.value as any).success
    ).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successful} items. Failed: ${failed}`,
      updated: successful,
      failed: failed,
      total: trackedItems.length
    });
  } catch (error) {
    console.error('Error updating tracked items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
