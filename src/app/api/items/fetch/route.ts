import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const maxDuration = 20; // Reduced from 59 to 20 seconds to save costs

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

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el itemId del cuerpo de la solicitud
    const { itemId } = await request.json();
    
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Obtener el token de acceso del usuario desde la base de datos
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

    // Hacer la solicitud a la API de Mercado Libre para obtener la información del ítem
    const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${userData.access_token}`
      }
    });

    if (!itemResponse.ok) {
      return NextResponse.json(
        { error: 'Error fetching item from Mercado Libre' },
        { status: itemResponse.status }
      );
    }

    const itemData = await itemResponse.json();

    // Obtener información del vendedor
    let sellerNickname = '';
    try {
      const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${itemData.seller_id}`, {
        headers: {
          'Authorization': `Bearer ${userData.access_token}`
        }
      });
      
      if (sellerResponse.ok) {
        const sellerData = await sellerResponse.json();
        sellerNickname = sellerData.nickname || '';
      }
    } catch (error) {
      console.error('Error fetching seller info:', error);
      // Continuamos incluso si hay error al obtener datos del vendedor
    }

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

    // Determinar free_shipping
    const freeShipping = determineFreeShipping(itemData.shipping || {});
    
    // Determinar installments_quantity
    const installmentsQuantity = determineInstallmentsQuantity(
      itemData.listing_type_id,
      itemData.tags || []
    );
    
    // Obtener detalles de tarifas
    const price = salePriceData?.amount || itemData.price;
    const feeDetails = await getFeeDetails(
      userData.access_token,
      price,
      itemData.category_id,
      itemData.tags || [],
      itemData.listing_type_id
    );
    
    // Obtener costos de envío
    const shippingCosts = await getShippingCosts(itemId, mlUserId, userData.access_token);
    
    // Obtener información de campaña
    const campaignInfo = await getCampaignInfo(itemId, userData.access_token);

    // Crear el objeto de item que vamos a guardar
    const itemToSave = {
      item_id: itemId,
      user_id: userData.id,
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
      // Nuevos campos
      listing_type_id: itemData.listing_type_id,
      shipping_mode: itemData.shipping?.mode || null,
      free_shipping: freeShipping,
      shipping_logistic_type: itemData.shipping?.logistic_type || null,
      item_tags: itemData.tags ? JSON.stringify(itemData.tags) : null,
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
      last_updated: new Date().toISOString()
    };

    // Crear o actualizar el ítem en la base de datos
    const { data: existingItem } = await supabase
      .from('items')
      .select('id')
      .eq('item_id', itemId)
      .eq('user_id', userData.id)
      .single();

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

    return NextResponse.json({
      success: true,
      message: existingItem ? 'Item updated' : 'Item created',
      item: {
        ...itemData,
        sale_price: salePriceData,
        free_shipping: freeShipping,
        installments_quantity: installmentsQuantity,
        fees: feeDetails,
        shipping_costs: shippingCosts,
        campaign: campaignInfo
      }
    });
  } catch (error) {
    console.error('Error processing fetch item request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}