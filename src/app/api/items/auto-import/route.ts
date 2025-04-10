// Import necesario para Next.js API route
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

export const maxDuration = 59; // This function can run for a maximum of 59 seconds

// Tipo para la respuesta de la API de Mercado Libre
interface MLAPISearchResponse {
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
  results: Array<{
    id: string;
    title: string;
    // otros campos
  }>;
}

interface MLAPIItemsResponse {
  code: number;
  body: {
    id: string;
    site_id: string;
    title: string;
    seller_id: string;
    category_id: string;
    official_store_id: string | null;
    price: number;
    base_price: number;
    currency_id: string;
    available_quantity: number;
    status: string;
    permalink: string;
    thumbnail: string;
    listing_type_id: string;
    tags: string[];
    shipping: {
      mode: string;
      free_shipping: boolean;
      logistic_type: string;
      tags: string[];
    };
    seller_custom_field: any;
    catalog_listing: boolean;
  }[] | any;
}

// Modelo para errores de importación
interface ImportError {
  item_id: string;
  error_message: string;
  created_at: Date;
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

/**
 * Maneja la solicitud POST para auto-importar productos desde Mercado Libre.
 * Recopila todos los IDs de productos y los importa en lotes.
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener IDs de usuario y tienda seleccionada de las cookies
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;

    if (!authUserId) {
      console.log('No autorizado. Usuario no identificado.');
      return NextResponse.json(
        { error: 'No autorizado. Usuario no identificado.' },
        { status: 401 }
      );
    }
    
    if (!selectedStoreId) {
      return NextResponse.json(
        { error: 'No hay tienda seleccionada.' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener información de la tienda seleccionada
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .single();
    
    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    if (userAccess.role === 'viewer') {
      return NextResponse.json({ error: 'You do not have permission to import items' }, { status: 403 });
    }

    // Obtener usuario de Mercado Libre asociado a la tienda
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry')
      .eq('id', selectedStoreId)
      .single();
    
    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (new Date(storeData.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }
    
    const accessToken = storeData.access_token;
    const userId = storeData.ml_user_id;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autorizado. Falta token de acceso.' },
        { status: 401 }
      );
    }

    // Recopilar todos los IDs de productos disponibles
    const allProductIds = await getAllProductIds(accessToken, userId);
    
    // Obtener IDs que ya existen en la base de datos para evitar duplicados
    const { data: existingItems } = await supabase
      .from('items')
      .select('item_id')
      .eq('user_id', userId);
    
    // Crear un Set para búsqueda eficiente
    const existingItemIds = new Set(existingItems?.map(item => item.item_id) || []);
      
    // Filtrar para procesar solo los nuevos
    const newItemIds = allProductIds.filter((id: string) => !existingItemIds.has(id));
    
    if (newItemIds.length === 0) {
      return Response.json({
        imported: 0,
        failed: 0,
        total: 0,
        message: 'No hay nuevos productos para importar'
      });
    }
    
    // Variables para seguimiento
    const itemsToInsert = [];
    const failedItems = [];
    
    // Procesar los productos en lotes de 20
    const batchSize = 20;
    for (let i = 0; i < newItemIds.length; i += batchSize) {
      const batch = newItemIds.slice(i, i + batchSize);
      
      // Obtener los precios de venta para este lote
      const priceDataMap = await getProductsSalePrices(batch, accessToken);
      
      // Obtener información detallada de los productos
      const itemInfoResponse = await fetch(`https://api.mercadolibre.com/items?ids=${batch.join(',')}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!itemInfoResponse.ok) {
        // Si falla todo el lote, añadir todos los IDs a fallidos
        failedItems.push(...batch);
        continue;
      }
      
      const itemsData = await itemInfoResponse.json();
      
      // Procesar cada producto
      for (const itemData of itemsData) {
        if (itemData.code !== 200 || !itemData.body) {
          failedItems.push(itemData.id || 'unknown');
          continue;
        }
        
        const item = itemData.body;
        const priceData = priceDataMap[item.id];
        
        // Determinar free_shipping
        const freeShipping = determineFreeShipping(item.shipping);
        
        // Determinar installments_quantity
        const installmentsQuantity = determineInstallmentsQuantity(
          item.listing_type_id,
          item.tags || []
        );
        
        // Obtener detalles de tarifas
        const feeDetails = await getFeeDetails(
          accessToken,
          priceData?.amount || item.price,
          item.category_id,
          item.tags || [],
          item.listing_type_id
        );

        
        // Extraer el SKU de los atributos
        const sku = extractSkuFromAttributes(item.attributes);

/*
        if (!sku) {
          const related_item_id = item.item_relations[0].id;
          const related_response = await fetch(`https://api.mercadolibre.com/items/${related_item_id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (!related_response.ok) {
            console.error(`Error fetching related items: ${related_response.status} - ${related_response.statusText}`);
            continue;
          }
          
          const related_data = await related_response.json();
          sku = extractSkuFromAttributes(related_data.attributes);
        }
*/
        
        // Obtener costos de envío para el vendedor
        const shippingCosts = await getShippingCosts(item.id, userId, accessToken);
        
        // Obtener información de campaña/promoción
        const campaignInfo = await getCampaignInfo(item.id, accessToken);
        
        // Preparar el objeto para insertar, incluyendo datos de precios y nuevos campos
        itemsToInsert.push({
          item_id: item.id,
          user_id: authUserId,
          store_id: selectedStoreId,
          site_id: item.site_id,
          title: item.title,
          seller_id: item.seller_id,
          category_id: item.category_id,
          official_store_id: item.official_store_id,
          price: item.price,
          base_price: item.base_price,
          regular_amount: priceData?.regular_amount || null,
          amount: priceData?.amount || null,
          currency_id: item.currency_id,
          available_quantity: item.available_quantity,
          permalink: item.permalink,
          thumbnail: item.thumbnail,
          status: item.status,
          sku: sku,
          // Nuevos campos
          listing_type_id: item.listing_type_id,
          shipping_mode: item.shipping?.mode || null,
          free_shipping: freeShipping,
          shipping_logistic_type: item.shipping?.logistic_type || null,
          item_tags: item.tags ? JSON.stringify(item.tags) : null,
          installments_quantity: installmentsQuantity,
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
          last_updated: new Date().toISOString()
        });
      }
    }
    
    // Insertar en la base de datos
    const { error: insertError, data: insertedItems } = await supabase
      .from('items')
      .insert(itemsToInsert)
      .select();
    
    // Obtener el número de elementos insertados
    const count = insertedItems ? insertedItems.length : 0;
    
    if (insertError) {
      console.error('Error al insertar items:', insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }
    
    return Response.json({
      imported: count,
      failed: failedItems.length,
      total: newItemIds.length
    });
  } catch (error) {
    console.error('Error en auto-import:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
   
/**
 * Obtiene todos los IDs de productos disponibles usando paginación con scroll_id.
 * Esta función maneja correctamente grandes volúmenes de productos (más de 1000).
 */
async function getAllProductIds(accessToken: string, userId: string): Promise<string[]> {
  const allIds: Set<string> = new Set(); // Usamos un Set para evitar duplicados automáticamente
  let scrollId: string | null = null;
  let hasMore = true;
  
  while (hasMore) {
    try {
      // Construir URL de consulta
      let url = `https://api.mercadolibre.com/users/${userId}/items/search?search_type=scan&limit=100`;
      
      // Añadir scroll_id si existe
      if (scrollId) {
        url += `&scroll_id=${encodeURIComponent(scrollId)}`;
      }
      
      // Consultar productos con paginación
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error al obtener productos: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Guardar IDs de esta página
      const pageIds = data.results || [];
      pageIds.forEach((id: string) => allIds.add(id));
      
      // Verificar si hay más páginas
      if (data.scroll_id && data.scroll_id !== scrollId && data.scroll_id !== "") {
        // Actualizar scrollId para la siguiente iteración
        scrollId = data.scroll_id;
      } else {
        // No hay más páginas para procesar
        hasMore = false;
      }
      
      // Esperar un poco entre solicitudes para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`Obtenidos ${pageIds.length} productos. Total acumulado: ${allIds.size}`);
      
    } catch (error) {
      console.error(`Error al obtener página de productos:`, error);
      hasMore = false; // Detener el bucle en caso de error
      break;
    }
  }
  
  return Array.from(allIds); // Convertir el Set a Array
}

/**
 * Consulta un lote de productos (hasta 20) en una sola llamada API.
 */
async function fetchItemsBatch(accessToken: string, itemIds: string[]): Promise<any[]> {
  if (itemIds.length === 0) {
    return [];
  }
  
  // Preparar IDs separados por comas
  const idsParam = itemIds.join(',');
  
  const response = await fetch(
    `https://api.mercadolibre.com/items?ids=${idsParam}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Error al obtener lote de items: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Filtrar solo los resultados exitosos y extraer los cuerpos
  return data
    .filter((result: any) => result.code === 200)
    .map((result: any) => result.body);
}

/**
 * Consulta un único producto en caso de error con el lote.
 */
async function fetchSingleItem(accessToken: string, itemId: string): Promise<any> {
  const response = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Error al obtener item individual: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Obtiene los precios de venta para un lote de productos.
 */
async function getProductsSalePrices(itemIds: string[], accessToken: string) {
  const priceDataMap: { [key: string]: any } = {};
  
  // Procesar en lotes más pequeños para evitar sobrecargar la API
  const batchSize = 20;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    
    // Realizar consultas en paralelo para mayor eficiencia
    const pricePromises = batch.map(async (itemId: string) => {
      try {
        const response = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (response.ok) {
          const priceData = await response.json();
          return { itemId, priceData };
        }
        return { itemId, priceData: null };
      } catch (error) {
        console.error(`Error al obtener precio de venta para el ítem ${itemId}:`, error);
        return { itemId, priceData: null };
      }
    });
    
    const priceResults = await Promise.all(pricePromises);
    
    // Añadir resultados al mapa
    for (const result of priceResults) {
      priceDataMap[result.itemId] = result.priceData;
    }
  }
  
  return priceDataMap;
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
 * Extrae el SKU del vendedor desde el array de atributos del producto
 * @param attributes Array de atributos del producto de Mercado Libre
 * @returns El valor del SKU si existe, o null si no se encuentra
 */
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