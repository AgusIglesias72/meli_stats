// src/app/api/meli/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { stores, items, pendingSheetSyncs } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { processOrderNotification, processShipmentNotification } from '@/lib/meliOrders';
import { meliCache } from '@/lib/cache';

export const maxDuration = 30; // OPTIMIZADO: 30 segundos (reducido de 60) - webhooks deben ser rápidos
export const runtime = 'nodejs'; // Node.js runtime para mejor performance

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
 * Con caché de 24 horas (las tarifas casi nunca cambian)
 * OPTIMIZADO: Extendido TTL para reducir llamadas API
 */
async function getFeeDetails(
  accessToken: string,
  price: number,
  categoryId: string,
  tags: string[],
  listingTypeId: string
): Promise<any> {
  // Crear clave de caché basada en parámetros que afectan las fees
  // OPTIMIZACIÓN: No incluir tags en cacheKey para mayor reuso
  const cacheKey = `fees:${categoryId}:${listingTypeId}`;

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
    86400 // 24 horas de TTL (optimizado de 1 hora)
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
 * OPTIMIZADO: Con deduplicación de webhooks
 */
async function handleNotification(notification: MercadoLibreNotification) {
  try {
    // Validar que todos los campos necesarios estén presentes
    if (!notification.topic || !notification.resource || !notification.user_id) {
      console.warn('[WEBHOOK] ⚠️ Notificación incompleta:', notification);
      return;
    }

    // OPTIMIZACIÓN: Early exit para webhooks duplicados usando caché
    // ML envía múltiples webhooks del mismo item en ráfaga
    const dedupeKey = `webhook:${notification.resource}:${notification.sent}`;
    if (meliCache.get(dedupeKey)) {
      console.log(`[WEBHOOK] ⏭️ Webhook duplicado ignorado: ${notification.resource}`);
      return;
    }
    // Marcar como procesado por 2 minutos
    meliCache.set(dedupeKey, true, 120);

    console.log('[WEBHOOK] 📥 Processing notification:', notification);

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

    // OPTIMIZACIÓN TEMPORAL: Ignorar webhooks de items - clientes no usando el lector
    // Si se necesita reactivar, comentar las siguientes 3 líneas
    console.log(`[WEBHOOK] ⏭️ Webhooks de items deshabilitados temporalmente: ${notification.resource}`);
    return;

    // CÓDIGO DESHABILITADO - descomentar para reactivar
    /*
    // Extraer el ID del producto del resource (formato: '/items/MLA1234567')
    const itemIdMatch = notification.resource.match(/\/items\/([A-Za-z0-9]+)/);
    if (!itemIdMatch) {
      console.error(`Formato de resource inválido para topic de items: ${notification.resource}`);
      return;
    }

    const itemId = itemIdMatch[1];

    // Procesar la actualización del item
    await processItemUpdate(notification.user_id.toString(), itemId);
    */

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

    // OPTIMIZACIÓN: Cachear store lookup (evitar query a DB en cada webhook)
    const storeCacheKey = `store:${user_id}`;
    let store = meliCache.get<any>(storeCacheKey);

    if (!store) {
      console.log(`[CACHE] ⬇️ Fetching store data para usuario ${user_id}...`);
      // Buscar la tienda del usuario para obtener el access_token
      const [storeData] = await db.select({ id: stores.id, ml_user_id: stores.ml_user_id, access_token: stores.access_token }).from(stores).where(eq(stores.ml_user_id, Number(user_id))).limit(1);

      if (!storeData) {
        console.error(`[WEBHOOK] ❌ No se encontró la tienda para el usuario ${user_id}`);
        return;
      }

      store = storeData;
      // Cachear por 1 hora (los tokens duran mucho más)
      meliCache.set(storeCacheKey, store, 3600);
    }

    // Primero verificar si el item ya existe en DB para optimización de caché
    const [existingItem] = await db.select().from(items).where(and(eq(items.item_id, itemId), eq(items.store_id, store.id))).limit(1);

    // OPTIMIZACIÓN CRÍTICA: Early exit si el item fue actualizado muy recientemente
    // Evita llamadas API innecesarias cuando ML envía múltiples webhooks
    if (existingItem && existingItem.last_updated) {
      const lastUpdate = new Date(existingItem.last_updated).getTime();
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdate;

      // Si se actualizó hace menos de 30 segundos, skip
      if (timeSinceUpdate < 30000) {
        console.log(`[WEBHOOK] ⏭️ Item ${itemId} actualizado recientemente (hace ${Math.round(timeSinceUpdate / 1000)}s), omitiendo fetch`);
        return;
      }
    }

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
      console.log(`[WEBHOOK] 📊 Item ${itemId} - Cambios Sheets: ${updateResult.sheetsFields.join(', ')}`);

      // OPTIMIZACIÓN: No hacer DB write si no es necesario
      // Si hay cambios mínimos (ej: solo thumbnail), puede que no valga la pena encolar
      const significantChanges = updateResult.sheetsFields.some(field =>
        ['price', 'status', 'title', 'base_price', 'sale_fee_amount'].includes(field)
      );

      if (significantChanges) {
        try {
          // En lugar de sync síncrono, insertar en cola (UPSERT para evitar duplicados)
          await db.insert(pendingSheetSyncs).values({
            item_id: itemId,
            store_id: store.id,
            item_data: newItemData,
            change_type: updateResult.changeType,
            changed_fields: updateResult.sheetsFields,
            status: 'pending',
            attempts: 0
          } as any).onConflictDoUpdate({
            target: [pendingSheetSyncs.item_id, (pendingSheetSyncs as any).store_id],
            set: {
              item_data: newItemData,
              status: 'pending',
              attempts: 0
            } as any
          });

          console.log(`[WEBHOOK] ✅ Encolado para Sheets (cambios significativos)`);
        } catch (err) {
          console.error(`[WEBHOOK] ❌ Error encolando item para Sheets:`, err);
        }
      } else {
        console.log(`[WEBHOOK] ⏭️ Cambios menores, omitiendo cola Sheets`);
      }
    } else if (updateResult.hasDbChanges) {
      console.log(`[WEBHOOK] 🗄️ Actualizado en DB (solo: ${updateResult.dbFields.join(', ')})`);
    } else {
      console.log(`[WEBHOOK] ⏭️ Sin cambios detectados`);
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
 * OPTIMIZADO: Con caché de 12 horas (los costos de envío rara vez cambian)
 */
async function getShippingCosts(itemId: string, userId: string, accessToken: string): Promise<any> {
  const cacheKey = `shipping:${itemId}`;

  return meliCache.getOrFetch(
    cacheKey,
    async () => {
      try {
        console.log(`[CACHE] ⬇️ Fetching shipping costs para ${itemId}...`);

        const response = await fetch(
          `https://api.mercadolibre.com/users/${userId}/shipping_options/free?item_id=${itemId}&verbose=TRUE`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) {
          // 404 es común cuando no hay opciones de envío - no loguear
          if (response.status !== 404) {
            console.error(`Error fetching shipping costs: ${response.status} - ${response.statusText}`);
          }
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
    },
    43200 // 12 horas de TTL
  );
}

/**
 * OPTIMIZACIÓN: getCampaignInfo ELIMINADA
 * Esta función hacía 3-4 llamadas API pesadas por cada webhook
 * Los datos de campaña raramente cambian y pueden obtenerse bajo demanda
 * Ahorro: ~4 API calls por webhook = ~80% reducción en llamadas
 */

/**
 * Obtiene los datos actualizados del item desde la API de Mercado Libre
 * Con optimización de llamadas condicionales
 */
async function fetchItemFromMeli(itemId: string, accessToken: string, existingItem?: any) {
  try {
    // OPTIMIZACIÓN: Solo obtener datos del item (eliminar sale_price - 1 API call menos)
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos del item: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Determinar free_shipping
    const freeShipping = determineFreeShipping(data.shipping || {});

    // Determinar installments_quantity
    const installmentsQuantity = determineInstallmentsQuantity(
      data.listing_type_id,
      data.tags || []
    );

    // OPTIMIZACIÓN: Extraer SKU de múltiples fuentes SIN llamadas API adicionales
    let sku = extractSkuFromAttributes(data.attributes);

    // Si no está en attributes, buscar en otros campos del item
    if (!sku) {
      sku = data.seller_custom_field ||
            data.catalog_product_id ||
            data.variations?.[0]?.seller_custom_field ||
            '';

      // Log solo si realmente no se encontró SKU
      if (!sku) {
        console.log(`[WEBHOOK] ⚠️ No SKU found for item ${itemId}`);
      }
    }

    // OPTIMIZACIÓN: Usar precio base del item directamente
    const price = data.price;

    // Verificar qué campos cambiaron para decidir qué APIs llamar
    const priceChanged = !existingItem || existingItem.price !== price || existingItem.base_price !== data.base_price;
    const tagsChanged = !existingItem || JSON.stringify(existingItem.item_tags) !== JSON.stringify(data.tags);
    const shippingChanged = !existingItem || existingItem.shipping_mode !== data.shipping?.mode;

    let feeDetails, shippingCosts;

    // OPTIMIZACIÓN: Reducir llamadas API al mínimo
    if (!existingItem) {
      // Item nuevo - obtener solo datos esenciales
      console.log(`[CACHE] 🆕 Item nuevo ${itemId} - fetching essential data`);
      [feeDetails, shippingCosts] = await Promise.all([
        getFeeDetails(accessToken, price, data.category_id, data.tags || [], data.listing_type_id),
        getShippingCosts(itemId, data.seller_id, accessToken)
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

      console.log(`[CACHE] 🔄 Item ${itemId} - API calls: ${apiTypes.join(', ')}`);
      [feeDetails, shippingCosts] = await Promise.all(apiCalls);
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
      // OPTIMIZACIÓN: Precios del item principal (sin llamadas extra)
      amount: data.price, // Usar price del item directamente
      regular_amount: data.original_price || data.price,
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
      // OPTIMIZACIÓN: Información de campaña eliminada (ahorraba 3-4 API calls)
      // Si se necesita, obtener bajo demanda o en batch
      promotion_id: null,
      campaign_type: null,
      meli_percentage_cashback: null,
      seller_percentage: null,
      // Propiedades adicionales que pueden ser útiles
      category_id: data.category_id,
      seller_id: data.seller_id,
      seller_nickname: data.seller?.nickname,
      last_updated: new Date(),
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
    // Si no se pasó existingItem, buscarlo
    if (!existingItem) {
      const [foundItem] = await db.select().from(items).where(and(eq(items.item_id, itemId), eq(items.store_id, storeId))).limit(1);

      existingItem = foundItem || null;
    }

    // Preparar datos completos para upsert
    const updateData = {
      ...newItemData,
      store_id: storeId,
      last_updated: new Date()
    };

    // ✅ UPSERT - Maneja race conditions automáticamente
    // Si dos webhooks llegan simultáneamente, el constraint único previene duplicados
    await db.insert(items).values(updateData).onConflictDoUpdate({
      target: [items.item_id, items.store_id],
      set: updateData
    });

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
 * OPTIMIZADO: Early exit y comparación prioritaria de campos críticos
 */
function compareItemData(existingItem: any, newItem: any): {
  dbFields: string[];
  sheetsFields: string[];
  hasDbChanges: boolean;
  hasSheetsChanges: boolean;
} {
  const dbFields: string[] = [];
  const sheetsFields: string[] = [];

  // OPTIMIZACIÓN: Campos críticos primero (early exit si cambian)
  const criticalSheetsFields = ['price', 'status', 'available_quantity'];

  // ✅ Verificar campos críticos PRIMERO (los que más cambian)
  for (const field of criticalSheetsFields) {
    const existingValue = existingItem[field];
    const newValue = newItem[field];

    if (!areValuesEqual(existingValue, newValue)) {
      if (field === 'available_quantity') {
        // Stock solo va a DB
        dbFields.push(field);
        console.log(`🗄️ [CRITICAL] Stock cambiado: ${existingValue} → ${newValue}`);
      } else {
        // Precio y status van a ambos
        dbFields.push(field);
        sheetsFields.push(field);
        console.log(`📊 [CRITICAL] ${field} cambiado: ${existingValue} → ${newValue}`);
      }
    }
  }

  // ✅ Campos DB menos importantes (solo si vale la pena seguir comparando)
  const dbOnlyFields = [
    'thumbnail',           // URL de imagen
    'permalink',           // URL del producto
    'last_updated'         // Timestamp interno
  ];

  // ✅ Campos Sheets menos críticos
  const otherSheetsFields = [
    'title',
    'base_price',
    'amount',               // precio promocional
    'regular_amount',       // precio regular
    'listing_type_id',
    'free_shipping',
    'installments_quantity',
    'sale_fee_amount',
    'percentage_fee',
    'meli_percentage_fee',
    'shipping_list_cost',
    'sku'
  ];

  // Verificar campos solo de DB
  for (const field of dbOnlyFields) {
    const existingValue = existingItem[field];
    const newValue = newItem[field];

    if (!areValuesEqual(existingValue, newValue)) {
      dbFields.push(field);
    }
  }

  // Verificar otros campos relevantes para Sheets (solo si no es spam de webhooks)
  for (const field of otherSheetsFields) {
    const existingValue = existingItem[field];
    const newValue = newItem[field];

    if (!areValuesEqual(existingValue, newValue)) {
      dbFields.push(field);      // También va a DB
      sheetsFields.push(field);  // Y también a Sheets
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
