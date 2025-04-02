// src/app/api/meli/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const runtime = 'edge'

// Interfaz para las notificaciones de Mercado Libre
interface MercadoLibreNotification {
  id: string;
  topic: string;
  resource: string;
  user_id: number | string;
  application_id: number;
  sent: string;
  attempts: number;
  received: string;
  actions: any[];
}

export async function POST(request: NextRequest) {
  try {
    // Extraer la notificación del cuerpo de la solicitud
    const notification: MercadoLibreNotification = await request.json();
    // Registrar la notificación recibida para depuración
    console.log('Received notification:', notification);
    
    // Validar que todos los campos necesarios estén presentes
    if (!notification.topic || !notification.resource || !notification.user_id) {
      return NextResponse.json(
        { error: 'Notificación incompleta' },
        { status: 400 }
      );
    }
    
    // Si el topic no contiene "items", simplemente devolvemos éxito
    // Esto incluye topics como "orders", "shipments", etc.
    if (!notification.topic.includes('items')) {
      console.log(`Notificación ignorada para topic: ${notification.topic}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Notificación recibida pero ignorada (topic no relacionado con items)' 
      });
    }
    
    // A partir de aquí sabemos que es un topic relacionado con items (items, items_prices, etc.)
    // Extraer el ID del producto del resource (formato: '/items/MLA1234567')
    const itemIdMatch = notification.resource.match(/\/items\/([A-Za-z0-9]+)/);
    if (!itemIdMatch) {
      console.error(`Formato de resource inválido para topic de items: ${notification.resource}`);
      return NextResponse.json(
        { error: 'Formato de resource inválido para items' },
        { status: 400 }
      );
    }
    
    const itemId = itemIdMatch[1];
     // Procesar la actualización del item
     await processItemUpdate(notification.user_id.toString(), itemId);
  
     console.log(`Notificación de item procesada correctamente: ${itemId}`);
     return NextResponse.json({ 
       success: true, 
       message: 'Notificación de item procesada correctamente',
       itemId: itemId,
       topic: notification.topic
     });
    
  } catch (error) {
    console.error('Error procesando webhook:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Procesa la actualización de un item
 * @param user_id ID del usuario de Mercado Libre
 * @param itemId ID del item a actualizar
 */
async function processItemUpdate(user_id: string, itemId: string) {
  try {
    // Inicializar cliente de Supabase
    const supabase = createServerSupabaseClient();
    
    // Buscar la tienda del usuario para obtener el access_token
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, ml_user_id, access_token')
      .eq('ml_user_id', user_id)
      .single();
    
    if (storeError || !store) {
      console.error(`No se encontró la tienda para el usuario ${user_id}:`, storeError);
      return;
    }
    
    // Obtener los datos actualizados del item desde la API de Mercado Libre
    const itemData = await fetchItemFromMeli(itemId, store.access_token);
    
    if (!itemData) {
      console.error(`No se pudo obtener información del item ${itemId}`);
      return;
    }
    
    // Actualizar el item en nuestra base de datos
    await updateItemInDatabase(itemId, itemData, store.id);
    
    // Actualizar cualquier tracked_item relacionado
    // await updateTrackedItem(itemId, itemData);
    
    console.log(`Item ${itemId} actualizado correctamente`);
    
  } catch (error) {
    console.error(`Error procesando actualización del item ${itemId}:`, error);
    throw error;
  }
}

/**
 * Obtiene los datos actualizados del item desde la API de Mercado Libre
 */
async function fetchItemFromMeli(itemId: string, accessToken: string) {
  try {
    // Hacer petición a la API de Mercado Libre para obtener datos del item y los precios de venta simultáneamente
    const [response, responseSalePrices] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }),
      fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
    ]);
    
    if (!response.ok) {
      throw new Error(`Error al obtener datos del item: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const salePrices = await responseSalePrices.json();
    
    // Extraer solo los datos que nos interesan para la actualización
    return {
      item_id: data.id,
      title: data.title,
      price: data.price,
      currency_id: data.currency_id,
      available_quantity: data.available_quantity,
      status: data.status,
      permalink: data.permalink,
      thumbnail: data.thumbnail,
      // Extraer los precios promocionales si existen
      amount: salePrices.amount,
      regular_amount: salePrices.regular_amount,  
      base_price: data.base_price || data.price,
      // Propiedades adicionales que pueden ser útiles
      category_id: data.category_id,
      seller_id: data.seller_id,
      seller_nickname: data.seller?.nickname,
      last_updated: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error(`Error obteniendo datos del item ${itemId} desde Mercado Libre:`, error);
    return null;
  }
}

/**
 * Actualiza la información del item en la base de datos
 */
async function updateItemInDatabase(itemId: string, itemData: any, storeId: string) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Buscar si el item ya existe en la base de datos
    const { data: existingItem, error: findError } = await supabase
      .from('items')
      .select('id')
      .eq('item_id', itemId)
      .eq('store_id', storeId)
      .maybeSingle();
    
    if (findError) {
      console.error(`Error buscando item ${itemId}:`, findError);
      return;
    }
    
    // Preparar datos para la actualización
    const updateData = {
      ...itemData,
      store_id: storeId,
      last_updated: new Date().toISOString()
    };
    
    if (existingItem) {
      // Actualizar item existente
      const { error: updateError } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', existingItem.id);
      
      if (updateError) {
        console.error(`Error actualizando item ${itemId}:`, updateError);
      }
      
    } else {
      // Crear nuevo item
      const { error: insertError } = await supabase
        .from('items')
        .insert(updateData);
      
      if (insertError) {
        console.error(`Error insertando item ${itemId}:`, insertError);
      }
    }
    
  } catch (error) {
    console.error(`Error en la actualización del item ${itemId} en la base de datos:`, error);
    throw error;
  }
}
