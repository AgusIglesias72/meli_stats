// src/app/api/meli/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { processOrderNotification, processShipmentNotification } from '@/lib/meliOrders';
import { meliCache } from '@/lib/cache';

export const maxDuration = 60; // Máximo 60 segundos para procesar grandes cantidades de datos
export const runtime = 'nodejs'; // Node.js runtime para mejor performance y mayor timeout

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
 * Con caché de 1 hora (las tarifas no cambian frecuentemente)
 */
async function getFeeDetails(
  accessToken: string,
  price: number,
  categoryId: string,
  tags: string[],
  listingTypeId: string
): Promise<any> {
  // Crear clave de caché basada en parámetros que afectan las fees
  const tagsString = tags.sort().join(','); // Sort para consistencia
  const cacheKey = `fees:${categoryId}:${listingTypeId}:${tagsString}`;

  return meliCache.getOrFetch(
    cacheKey,
    async () => {
      try {
        const siteId = 'MLA'; // Asumiendo que es Argentina
        const tagsParam = tags.join(',');

        console.log(`[CACHE] ⬇️ Fetching fee details para ${categoryId}...`);

        const response = await fetch(
          `https://api.mercadolibre.com/sites/${siteId}/listing_prices?price=${price}&category_id=${categoryId}&tags=${tagsParam}&listing_type_id=${listingTypeId}`,
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
    },
    3600 // 1 hora de TTL
  );
}

export async function POST(request: NextRequest) {
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

    console.log('notification', notification);

    // Si el topic no contiene "items", simplemente devolvemos éxito
    // Esto incluye topics como "orders", "shipments", etc.

    // Dentro de la función handleNotification, reemplazar la parte que mencionas:
    if (!notification.topic.includes('items')) {
      // Si el topic es orders_v2 o shipments, procesar la notificación
      if (notification.topic === 'orders_v2') {
        await processOrderNotification(notification)
          .then(success => {
            if (success) {
              console.log(`Notificación de orden procesada con éxito: ${notification.resource}`);
            } else {
              console.error(`Error procesando notificación de orden: ${notification.resource}`);
            }
          })
          .catch(err => console.error('Error en procesamiento de orden:', err));
        return;
      } else if (notification.topic === 'shipments') {
        await processShipmentNotification(notification)
          .then(success => {
            if (success) {
              console.log(`Notificación de envío procesada con éxito: ${notification.resource}`);
            } else {
              console.error(`Error procesando notificación de envío: ${notification.resource}`);
            }
          })
          .catch(err => console.error('Error en procesamiento de envío:', err));
        return;
      }

      // Ignorar notificaciones de payments - orders_v2 ya contiene toda la info de pagos
      // Procesar payments es costoso e innecesario (hace llamadas API pesadas)
      console.log(`[WEBHOOK] ⏭️ Notificación ignorada para topic: ${notification.topic}`);
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
 * Procesa la actualización de un item con comparación inteligente
 * Solo llama a sync-sheet si hay cambios reales
 */
async function processItemUpdate(user_id: string, itemId: string) {
  const startTime = Date.now();

  try {
    console.log(`[WEBHOOK] 🚀 Iniciando procesamiento de ${itemId} para usuario ${user_id}`);

    const supabase = createServerSupabaseClient();

    // Buscar la tienda del usuario para obtener el access_token
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, ml_user_id, access_token')
      .eq('ml_user_id', user_id)
      .single();

    if (storeError || !store) {
      console.error(`[WEBHOOK] ❌ No se encontró la tienda para el usuario ${user_id}:`, storeError);
      return;
    }

    // Primero verificar si el item ya existe en DB para optimización de caché
    const { data: existingItem } = await supabase
      .from('items')
      .select('*')
      .eq('item_id', itemId)
      .eq('store_id', store.id)
      .maybeSingle();

    // Obtener los datos actualizados del item desde la API de Mercado Libre
    const fetchStart = Date.now();
    const newItemData = await fetchItemFromMeli(itemId, store.access_token, existingItem);
    const fetchDuration = Date.now() - fetchStart;

    console.log(`[WEBHOOK] ⏱️ Fetch de MercadoLibre tomó ${fetchDuration}ms`);

    if (!newItemData) {
      console.error(`[WEBHOOK] ❌ No se pudo obtener información del item ${itemId}`);
      return;
    }

    // ✅ NUEVA LÓGICA: Comparar con datos existentes
    const dbStart = Date.now();
    const updateResult = await updateItemInDatabaseWithComparison(itemId, newItemData, store.id, existingItem);
    const dbDuration = Date.now() - dbStart;

    console.log(`[WEBHOOK] ⏱️ Operación DB tomó ${dbDuration}ms`);

    // ✅ Solo encolar para sync a Sheets si hay cambios relevantes
    if (updateResult.hasSheetsChanges) {
      console.log(`[WEBHOOK] 📊 Item ${itemId} tiene cambios comerciales, encolando para sync a Sheets...`);
      console.log(`[WEBHOOK] 📝 Campos cambiados para Sheets: ${updateResult.sheetsFields.join(', ')}`);

      try {
        // En lugar de sync síncrono, insertar en cola (UPSERT para evitar duplicados)
        await supabase
          .from('pending_sheet_syncs')
          .upsert({
            item_id: itemId,
            store_id: store.id,
            item_data: newItemData,
            change_type: updateResult.changeType,
            changed_fields: updateResult.sheetsFields,
            status: 'pending',
            attempts: 0
          }, {
            onConflict: 'item_id,store_id',
            ignoreDuplicates: false // Actualizar si ya existe
          });

        console.log(`[WEBHOOK] ✅ Item ${itemId} encolado para sync a Sheets (procesará en batch)`);
      } catch (err) {
        console.error(`[WEBHOOK] ❌ Error encolando item para Sheets:`, err);
      }
    } else if (updateResult.hasDbChanges) {
      console.log(`[WEBHOOK] 🗄️ Item ${itemId} actualizado en DB (solo cambios internos: ${updateResult.dbFields.join(', ')})`);
    } else {
      console.log(`[WEBHOOK] ⏭️ Item ${itemId} sin cambios, omitiendo actualizaciones`);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[WEBHOOK] ✅ Item ${itemId} procesado correctamente en ${totalDuration}ms`);

    // Alertar si es muy lento
    if (totalDuration > 10000) {
      console.warn(`[WEBHOOK] ⚠️ SLOW PROCESSING: ${itemId} tomó ${totalDuration}ms (>10s)`);
    }

    // Logging de estadísticas de caché (cada 10 items procesados)
    if (Math.random() < 0.1) { // 10% de probabilidad
      meliCache.logStats();
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[WEBHOOK] ❌ Error procesando actualización del item ${itemId} después de ${totalDuration}ms:`, error);
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
 * Con caché de 15 minutos (las campañas pueden cambiar)
 */
async function getCampaignInfo(itemId: string, accessToken: string): Promise<any> {
  const cacheKey = `campaign:${itemId}`;

  return meliCache.getOrFetch(
    cacheKey,
    async () => {
      try {
        console.log(`[CACHE] ⬇️ Fetching campaign info para ${itemId}...`);
        return await fetchCampaignInfoFromAPI(itemId, accessToken);
      } catch (error) {
        console.error(`Error fetching campaign info for item ${itemId}:`, error);
        return {
          promotion_id: null,
          campaign_type: null,
          meli_percentage_cashback: null,
          seller_percentage: null
        };
      }
    },
    900 // 15 minutos de TTL
  );
}

/**
 * Función interna que hace el fetch real de campaign info
 */
async function fetchCampaignInfoFromAPI(itemId: string, accessToken: string): Promise<any> {
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

    const promotionsArray = await fetch(`https://api.mercadolibre.com/seller-promotions/items/${itemId}?app_version=v2`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!promotionsArray.ok) {
      return {
        promotion_id: null,
        campaign_type: null,
        meli_percentage_cashback: null,
        seller_percentage: null
      };
    }

    const promotionsData = await promotionsArray.json();

    // Iterar el array de promociones y obtener el que tenga el type "PRE_NEGOTIATED" si es que existe. Sino vamos a usar el promotionId y campaignId que viene en el salePriceResponse
    const preNegotiatedPromotion = promotionsData.find((promotion: any) => promotion.type === "PRE_NEGOTIATED");
    if (preNegotiatedPromotion) {
      const promotionId = preNegotiatedPromotion.id;

      const negotiatedPromotion = await fetch(`https://api.mercadolibre.com/seller-promotions/promotions/${promotionId}/items?item_id=${itemId}&promotion_type=${preNegotiatedPromotion.type}&app_version=v2`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!negotiatedPromotion.ok) {
        return {
          promotion_id: null,
          campaign_type: null,
          meli_percentage_cashback: null,
          seller_percentage: null
        };
      }

      const negotiatedPromotionData = await negotiatedPromotion.json();
      const negotiatedPromotionItem = negotiatedPromotionData.results[0];

      return {
        promotion_id: promotionId,
        campaign_type: preNegotiatedPromotion.type,
        meli_percentage_cashback: negotiatedPromotionItem.meli_percentage,
        seller_percentage: negotiatedPromotionItem.seller_percentage
      };
    } else if (!preNegotiatedPromotion) {

      const salePriceData = await salePriceResponse.json();

      if (!salePriceData.metadata.promotion_id) {
        return {
          promotion_id: null,
          campaign_type: null,
          meli_percentage_cashback: null,
          seller_percentage: null
        };
      }

      const promotionId = salePriceData.metadata?.promotion_id;
      const campaignId = salePriceData.metadata?.campaign_id;

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

      const itemPromotion = itemPromotionData?.results?.[0];

      return {
        promotion_id: promotionId,
        campaign_type: promotionType,
        meli_percentage_cashback: itemPromotion?.meli_percentage || null,
        seller_percentage: itemPromotion?.seller_percentage || null
      }
    }

  } catch (error) {
    throw error; // Re-lanzar para que getCampaignInfo lo maneje
  }
}

/**
 * Obtiene los datos actualizados del item desde la API de Mercado Libre
 * Con optimización de llamadas condicionales
 */
async function fetchItemFromMeli(itemId: string, accessToken: string, existingItem?: any) {
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


    // ✅ OPTIMIZACIÓN CONDICIONAL: Solo hacer llamadas si hay cambios relevantes
    const price = salePrices.amount || data.price;

    // Verificar qué campos cambiaron para decidir qué APIs llamar
    const priceChanged = !existingItem || existingItem.price !== price || existingItem.base_price !== data.base_price;
    const tagsChanged = !existingItem || JSON.stringify(existingItem.item_tags) !== JSON.stringify(data.tags);
    const shippingChanged = !existingItem || existingItem.shipping_mode !== data.shipping?.mode;

    let feeDetails, shippingCosts, campaignInfo;

    if (!existingItem) {
      // Item nuevo - obtener todo
      console.log(`[CACHE] 🆕 Item nuevo ${itemId} - fetching all data`);
      [feeDetails, shippingCosts, campaignInfo] = await Promise.all([
        getFeeDetails(accessToken, price, data.category_id, data.tags || [], data.listing_type_id),
        getShippingCosts(itemId, data.seller_id, accessToken),
        getCampaignInfo(itemId, accessToken)
      ]);
    } else {
      // Item existente - solo llamar APIs si cambió algo relevante
      const apiCalls: Promise<any>[] = [];
      const apiTypes: string[] = [];

      if (priceChanged || tagsChanged) {
        apiCalls.push(getFeeDetails(accessToken, price, data.category_id, data.tags || [], data.listing_type_id));
        apiTypes.push('fees');
      } else {
        apiCalls.push(Promise.resolve({
          meli_percentage_fee: existingItem.meli_percentage_fee,
          percentage_fee: existingItem.percentage_fee,
          financing_add_on_fee: existingItem.financing_add_on_fee,
          fixed_fee: existingItem.fixed_fee,
          sale_fee_amount: existingItem.sale_fee_amount
        }));
        apiTypes.push('fees-cached');
      }

      if (shippingChanged) {
        apiCalls.push(getShippingCosts(itemId, data.seller_id, accessToken));
        apiTypes.push('shipping');
      } else {
        apiCalls.push(Promise.resolve({
          shipping_list_cost: existingItem.shipping_list_cost,
          shipping_discount_rate: existingItem.shipping_discount_rate,
          shipping_promoted_amount: existingItem.shipping_promoted_amount
        }));
        apiTypes.push('shipping-cached');
      }

      if (priceChanged || tagsChanged) {
        apiCalls.push(getCampaignInfo(itemId, accessToken));
        apiTypes.push('campaign');
      } else {
        apiCalls.push(Promise.resolve({
          promotion_id: existingItem.promotion_id,
          campaign_type: existingItem.campaign_type,
          meli_percentage_cashback: existingItem.meli_percentage_cashback,
          seller_percentage: existingItem.seller_percentage
        }));
        apiTypes.push('campaign-cached');
      }

      console.log(`[CACHE] 🔄 Item ${itemId} - API calls: ${apiTypes.join(', ')}`);
      [feeDetails, shippingCosts, campaignInfo] = await Promise.all(apiCalls);
    }

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
 * Actualiza el item en la base de datos con comparación inteligente
 * Retorna información sobre si hubo cambios y de qué tipo
 */
async function updateItemInDatabaseWithComparison(
  itemId: string,
  newItemData: any,
  storeId: string,
  existingItem?: any
): Promise<{
  hasDbChanges: boolean;
  hasSheetsChanges: boolean;
  changeType: 'created' | 'updated' | 'no-change';
  dbFields: string[];
  sheetsFields: string[];
  existingItem?: any;
}> {
  try {
    const supabase = createServerSupabaseClient();

    // Si no se pasó existingItem, buscarlo
    if (!existingItem) {
      const { data: foundItem, error: findError } = await supabase
        .from('items')
        .select('*')
        .eq('item_id', itemId)
        .eq('store_id', storeId)
        .maybeSingle(); // ✅ Ahora es seguro gracias al constraint unique_item_per_store_v2

      if (findError) {
        console.error(`[WEBHOOK] ❌ Error buscando item ${itemId}:`, findError);
        throw findError;
      }

      existingItem = foundItem;
    }

    // Preparar datos completos para upsert
    const updateData = {
      ...newItemData,
      store_id: storeId,
      last_updated: new Date().toISOString()
    };

    // ✅ UPSERT - Maneja race conditions automáticamente
    // Si dos webhooks llegan simultáneamente, el constraint único previene duplicados
    const { error: upsertError } = await supabase
      .from('items')
      .upsert(updateData, {
        onConflict: 'item_id,store_id', // Usa el constraint unique_item_per_store_v2
        ignoreDuplicates: false          // Actualiza si existe
      });

    if (upsertError) {
      console.error(`[WEBHOOK] ❌ Error en upsert para ${itemId}:`, upsertError);
      throw upsertError;
    }

    // Si no existía, es creación nueva
    if (!existingItem) {
      console.log(`[WEBHOOK] 🆕 Item ${itemId} creado en DB`);
      return {
        hasDbChanges: true,
        hasSheetsChanges: true, // Items nuevos siempre van a Sheets
        changeType: 'created',
        dbFields: ['all'],
        sheetsFields: ['all']
      };
    }

    // ✅ Item existe - comparar campos con lógica separada
    const comparison = compareItemData(existingItem, updateData);

    if (!comparison.hasDbChanges) {
      // No hay cambios en absoluto
      console.log(`[WEBHOOK] 💤 Item ${itemId} sin cambios`);
      return {
        hasDbChanges: false,
        hasSheetsChanges: false,
        changeType: 'no-change',
        dbFields: [],
        sheetsFields: [],
        existingItem
      };
    }

    // Hay cambios
    console.log(`[WEBHOOK] 🔄 Item ${itemId} actualizado - DB: ${comparison.dbFields.length} campos, Sheets: ${comparison.sheetsFields.length} campos`);

    return {
      hasDbChanges: true,
      hasSheetsChanges: comparison.hasSheetsChanges,
      changeType: 'updated',
      dbFields: comparison.dbFields,
      sheetsFields: comparison.sheetsFields,
      existingItem
    };

  } catch (error) {
    console.error(`[WEBHOOK] ❌ Error en updateItemInDatabaseWithComparison para ${itemId}:`, error);
    throw error;
  }
}

/**
 * Compara dos objetos de item y retorna información sobre cambios
 * Separa entre campos que ameritan DB vs Sheets
 */
function compareItemData(existingItem: any, newItem: any): {
  dbFields: string[];
  sheetsFields: string[];
  hasDbChanges: boolean;
  hasSheetsChanges: boolean;
} {
  const dbFields: string[] = [];
  const sheetsFields: string[] = [];
  
  // ✅ Campos que ameritan actualización en DB (incluye available_quantity)
  const dbOnlyFields = [
    'available_quantity',  // Stock - importante para DB pero no para Sheets
    'thumbnail',           // URL de imagen
    'permalink',           // URL del producto
    'last_updated'         // Timestamp interno
  ];
  
  // ✅ Campos que ameritan sync con Sheets (campos comerciales importantes)
  const sheetsRelevantFields = [
    'title',
    'price',
    'base_price',
    'status',
    'amount',               // precio promocional
    'regular_amount',       // precio regular
    'listing_type_id',
    'free_shipping',
    'installments_quantity',
    'sale_fee_amount',
    'percentage_fee',
    'meli_percentage_fee',
    'shipping_list_cost',
    'promotion_id',
    'campaign_type',
    'meli_percentage_cashback',
    'seller_percentage',
    'sku'
  ];

  // ✅ Verificar cambios en campos solo de DB
  for (const field of dbOnlyFields) {
    const existingValue = existingItem[field];
    const newValue = newItem[field];

    if (!areValuesEqual(existingValue, newValue)) {
      dbFields.push(field);
      console.log(`🗄️ Campo DB cambiado ${field}: ${existingValue} → ${newValue}`);
    }
  }

  // ✅ Verificar cambios en campos relevantes para Sheets
  for (const field of sheetsRelevantFields) {
    const existingValue = existingItem[field];
    const newValue = newItem[field];

    if (!areValuesEqual(existingValue, newValue)) {
      dbFields.push(field);      // También va a DB
      sheetsFields.push(field);  // Y también a Sheets
      console.log(`📊 Campo Sheets cambiado ${field}: ${existingValue} → ${newValue}`);
    }
  }

  return {
    dbFields,
    sheetsFields,
    hasDbChanges: dbFields.length > 0,
    hasSheetsChanges: sheetsFields.length > 0
  };
}

/**
 * Compara dos valores de manera inteligente
 * Maneja casos edge como null vs undefined, números vs strings, etc.
 */
function areValuesEqual(value1: any, value2: any): boolean {
  // Normalizar null/undefined
  const norm1 = value1 === null || value1 === undefined ? null : value1;
  const norm2 = value2 === null || value2 === undefined ? null : value2;

  // Si ambos son null/undefined
  if (norm1 === null && norm2 === null) {
    return true;
  }

  // Si uno es null y el otro no
  if (norm1 === null || norm2 === null) {
    return false;
  }

  // Comparación de números (maneja string vs number)
  if (typeof norm1 === 'number' || typeof norm2 === 'number') {
    return Number(norm1) === Number(norm2);
  }

  // Comparación de booleans
  if (typeof norm1 === 'boolean' || typeof norm2 === 'boolean') {
    return Boolean(norm1) === Boolean(norm2);
  }

  // Comparación de strings (trim para evitar espacios)
  if (typeof norm1 === 'string' || typeof norm2 === 'string') {
    return String(norm1).trim() === String(norm2).trim();
  }

  // Comparación directa para otros tipos
  return norm1 === norm2;
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
