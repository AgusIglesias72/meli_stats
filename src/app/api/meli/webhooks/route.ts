// src/app/api/meli/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { syncItemToSheet } from '@/lib/syncItemToSheet';

export const runtime = 'edge';

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

/**
 * Determina la cantidad de cuotas disponibles basado en el tipo de publicación y etiquetas
 */
function determineInstallmentsQuantity(listingTypeId: string, tags: string[]): number {
  if (listingTypeId === "gold_special") {
    // Por defecto 1 cuota para gold_special
    if (tags.includes("pcj-co-funded")) return 12; // 3 a 12 cuotas con interés bajo
    if (tags.includes("cuota-simple-paid-by-buyer")) return 1; // Vendedor tiene habilitado Cuota Simple
    return 1; // No quiere agregar cuotas
  }
  
  if (listingTypeId === "gold_pro") {
    // Por defecto 6 cuotas para gold_pro
    if (tags.includes("3x_campaign")) return 3; // 3 cuotas al mismo precio que publicaste
    if (tags.includes("cuota-simple-3")) return 3; // 3 cuotas - Cuota Simple
    if (tags.includes("cuota-simple-6")) return 6; // 6 cuotas - Cuota Simple
    if (tags.includes("9x_campaign")) return 9; // 9 cuotas al mismo precio que publicaste
    if (tags.includes("cuota-simple-12")) return 12; // 12 cuotas - Cuota Simple
    if (tags.includes("12x_campaign")) return 12; // 12 cuotas al mismo precio que publicaste
    return 6; // Valor por defecto para gold_pro
  }
  
  return 1; // Valor por defecto para otros tipos de listing
}

/**
 * Determina si el envío es gratuito basado en los datos de envío
 */
function determineFreeShipping(shippingData: any): boolean {
  if (shippingData?.tags && shippingData.tags.includes("mandatory_free_shipping")) {
    return true;
  }
  return shippingData?.free_shipping || false;
}

/**
 * Obtiene los detalles de tarifas de Mercado Libre
 */
async function getFeeDetails(
  accessToken: string,
  price: number, 
  categoryId: string, 
  tags: string[], 
  listingTypeId: string
): Promise<any> {
  try {
    const tagsString = tags.join(',');
    const siteId = 'MLA'; // Asumiendo que es Argentina
    
    const response = await fetch(
      `https://api.mercadolibre.com/sites/${siteId}/listing_prices?price=${price}&category_id=${categoryId}&tags=${tagsString}&listing_type_id=${listingTypeId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      console.error(`Error fetching fee details: ${response.status} - ${response.statusText}`);
      return {
        meli_percentage_fee: 0,
        percentage_fee: 0,
        financing_add_on_fee: 0,
        fixed_fee: 0,
        sale_fee_amount: 0
      };
    }

    const data = await response.json();
    
    return {
      meli_percentage_fee: data.sale_fee_details?.meli_percentage_fee || 0,
      percentage_fee: data.sale_fee_details?.percentage_fee || 0,
      financing_add_on_fee: data.sale_fee_details?.financing_add_on_fee || 0,
      fixed_fee: data.sale_fee_details?.fixed_fee || 0,
      sale_fee_amount: data.sale_fee_amount || 0
    };
  } catch (error) {
    console.error('Error fetching fee details:', error);
    return {
      meli_percentage_fee: 0,
      percentage_fee: 0,
      financing_add_on_fee: 0,
      fixed_fee: 0,
      sale_fee_amount: 0
    };
  }
}

export async function POST(request: NextRequest) {
  const start = performance.now();

  try {
    // Extraer la notificación del cuerpo de la solicitud
    const notification: MercadoLibreNotification = await request.json();

    // Devolver respuesta inmediata para cumplir con el SLA de Mercado Libre (<500ms)
    const response = NextResponse.json(
      { success: true, message: 'Notificación recibida' },
      { status: 200 }
    );

    // Procesar en segundo plano usando `after()` (recomendado para Next.js App Router)
    after(async () => handleNotification(notification));

    const end = performance.now();
    console.log(`Respuesta enviada en ${end - start} ms`);

    return response;
  } catch (error) {
    console.error('Error procesando webhook:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Lógica principal para procesar la notificación de Mercado Libre
 */
async function handleNotification(notification: MercadoLibreNotification) {
  try {
    // Validar que todos los campos necesarios estén presentes
    if (!notification.topic || !notification.resource || !notification.user_id) {
      console.warn('Notificación incompleta:', notification);
      return;
    }

    // Si el topic no contiene "items", simplemente devolvemos éxito
    // Esto incluye topics como "orders", "shipments", etc.
    if (!notification.topic.includes('items')) {
      console.log(`Notificación ignorada para topic: ${notification.topic}`);
      return;
    }

    // A partir de aquí sabemos que es un topic relacionado con items (items, items_prices, etc.)
    // Extraer el ID del producto del resource (formato: '/items/MLA1234567')
    const itemIdMatch = notification.resource.match(/\/items\/([A-Za-z0-9]+)/);
    if (!itemIdMatch) {
      console.error(`Formato de resource inválido para topic de items: ${notification.resource}`);
      return;
    }

    const itemId = itemIdMatch[1];

    // Procesar la actualización del item
    await processItemUpdate(notification.user_id.toString(), itemId);

  } catch (err) {
    console.error('Error en el procesamiento de la notificación:', err);
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

    console.log('sku', itemData.sku);

    // Actualizar la hoja de cálculo de Google Sheets
    try {
      await fetch(`${process.env.SELF_BASE_URL}/api/internal/sync-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
    } catch (err) {
      console.error('Error sincronizando con Google Sheets:', err);
    }
    console.log(`Item ${itemId} actualizado correctamente`);
  } catch (error) {
    console.error(`Error procesando actualización del item ${itemId}:`, error);
    throw error;
  }
}

/**
 * Obtiene los costos de envío para el vendedor
 */
async function getShippingCosts(itemId: string, userId: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/users/${userId}/shipping_options/free?item_id=${itemId}&verbose=TRUE`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      console.error(`Error fetching shipping costs: ${response.status} - ${response.statusText}`);
      return {
        shipping_list_cost: null,
        shipping_discount_rate: null,
        shipping_promoted_amount: null
      };
    }

    const data = await response.json();
    
    // Extraer los datos que nos interesan
    return {
      shipping_list_cost: data.coverage?.all_country?.list_cost || null,
      shipping_discount_rate: data.coverage?.all_country?.discount?.rate || null,
      shipping_promoted_amount: data.coverage?.all_country?.discount?.promoted_amount || null
    };
  } catch (error) {
    console.error(`Error fetching shipping costs for item ${itemId}:`, error);
    return {
      shipping_list_cost: null,
      shipping_discount_rate: null,
      shipping_promoted_amount: null
    };
  }
}

/**
 * Obtiene información sobre la campaña/promoción aplicada al producto
 */
async function getCampaignInfo(itemId: string, accessToken: string): Promise<any> {
  try {
    // 1. Primero obtener información del precio de venta para obtener el promotion_id
    const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!salePriceResponse.ok) {
      return {
        promotion_id: null,
        campaign_type: null,
        meli_percentage_cashback: null,
        seller_percentage: null
      };
    }

    const salePriceData = await salePriceResponse.json();
    const promotionId = salePriceData.metadata?.promotion_id;
    const campaignId = salePriceData.metadata?.campaign_id;

    if (!promotionId) {
      return {
        promotion_id: null,
        campaign_type: null,
        meli_percentage_cashback: null,
        seller_percentage: null
      };
    }

    // 2. Obtener información de la oferta
    const offerResponse = await fetch(
      `https://api.mercadolibre.com/seller-promotions/offers/${promotionId}?app_version=v2`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!offerResponse.ok) {
      console.error(`Error fetching offer info: ${offerResponse.status} - ${offerResponse.statusText}`);
      return {
        promotion_id: promotionId,
        campaign_type: null,
        meli_percentage_cashback: null,
        seller_percentage: null
      };
    }

    const offerData = await offerResponse.json();
    const promotionType = offerData.type;


    // 3. Obtener detalles específicos del item en la promoción
    const itemPromotionResponse = await fetch(
      `https://api.mercadolibre.com/seller-promotions/promotions/${campaignId}/items?item_id=${itemId}&promotion_type=${promotionType}&app_version=v2`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!itemPromotionResponse.ok) {
      console.error(`Error fetching item promotion: ${itemPromotionResponse.status} - ${itemPromotionResponse.statusText}`);
      return {
        promotion_id: promotionId,
        campaign_type: promotionType,
        meli_percentage_cashback: null,
        seller_percentage: null
      };
    }

    const itemPromotionData = await itemPromotionResponse.json();

    const itemPromotion = itemPromotionData.results[0];
    
    return {
      promotion_id: promotionId,
      campaign_type: promotionType,
      meli_percentage_cashback: itemPromotion.meli_percentage || null,
      seller_percentage: itemPromotion.seller_percentage || null
    };
  } catch (error) {
    console.error(`Error fetching campaign info for item ${itemId}:`, error);
    return {
      promotion_id: null,
      campaign_type: null,
      meli_percentage_cashback: null,
      seller_percentage: null
    };
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
    
    // Intentar obtener los precios de venta
    let salePrices = { amount: null, regular_amount: null };
    if (responseSalePrices.ok) {
      salePrices = await responseSalePrices.json();
    }

    // Determinar free_shipping
    const freeShipping = determineFreeShipping(data.shipping || {});
    
    // Determinar installments_quantity
    const installmentsQuantity = determineInstallmentsQuantity(
      data.listing_type_id,
      data.tags || []
    );

    // Extraer el SKU de los atributos
    let sku = extractSkuFromAttributes(data.attributes);

    if (!sku) {
      const related_item_id = data?.variations?.[0]?.user_product_id;
      if (!related_item_id) {
        console.error(`No se encontró un item relacionado para el item ${itemId}`);
        return null;
      }
      const related_response = await fetch(`https://api.mercadolibre.com/user-products/${related_item_id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!related_response.ok) {
        console.error(`Error fetching related items: ${related_response.status} - ${related_response.statusText}`);
        return null;
      }

      const related_data = await related_response.json();

      if (!related_data.attributes || !Array.isArray(related_data.attributes)) {
        return null;
      }
      
      // Buscar el atributo con id "SELLER_SKU"
      const skuAttribute = related_data.attributes.find((attr: any) => attr.id === "SELLER_SKU");
      const skuValue = skuAttribute.values[0].name;
      
      // Si lo encontramos, devolver su value_name
      if (skuAttribute && skuAttribute.name) {
        sku = skuValue;
      }

    }
  
    
    // Obtener detalles de tarifas
    const price = salePrices.amount || data.price;
    const feeDetails = await getFeeDetails(
      accessToken,
      price,
      data.category_id,
      data.tags || [],
      data.listing_type_id
    );
    
    // Obtener costos de envío
    const shippingCosts = await getShippingCosts(itemId, data.seller_id, accessToken);
    
    // Obtener información de campaña/promoción
    const campaignInfo = await getCampaignInfo(itemId, accessToken);

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
      sku: sku,
      // Datos de precios promocionales
      amount: salePrices.amount,
      regular_amount: salePrices.regular_amount,
      base_price: data.base_price || data.price,
      // Nuevos campos
      listing_type_id: data.listing_type_id,
      shipping_mode: data.shipping?.mode || null,
      free_shipping: freeShipping,
      shipping_logistic_type: data.shipping?.logistic_type || null,
      item_tags: data.tags ? JSON.stringify(data.tags) : null,
      installments_quantity: installmentsQuantity,
      // Campos de tarifas
      meli_percentage_fee: feeDetails.meli_percentage_fee,
      percentage_fee: feeDetails.percentage_fee,
      financing_add_on_fee: feeDetails.financing_add_on_fee,
      fixed_fee: feeDetails.fixed_fee,
      sale_fee_amount: feeDetails.sale_fee_amount,
      // Costos de envío
      shipping_list_cost: shippingCosts.shipping_list_cost,
      shipping_discount_rate: shippingCosts.shipping_discount_rate,
      shipping_promoted_amount: shippingCosts.shipping_promoted_amount,
      // Información de campaña
      promotion_id: campaignInfo.promotion_id,
      campaign_type: campaignInfo.campaign_type,
      meli_percentage_cashback: campaignInfo.meli_percentage_cashback,
      seller_percentage: campaignInfo.seller_percentage,
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

    // Preparar datos completos para actualización
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


// Añadir esta función al inicio del archivo
function extractSkuFromAttributes(attributes: any[]): string | null {
  if (!attributes || !Array.isArray(attributes)) {
    return null;
  }
  
  // Buscar el atributo con id "SELLER_SKU"
  const skuAttribute = attributes.find(attr => attr.id === "SELLER_SKU");
  
  // Si lo encontramos, devolver su value_name
  if (skuAttribute && skuAttribute.value_name) {
    return skuAttribute.value_name;
  }
  
  return null;
}
