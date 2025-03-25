import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

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

    // Crear o actualizar el ítem en la base de datos
    const { data: existingItem } = await supabase
      .from('items')
      .select('id')
      .eq('item_id', itemId)
      .eq('user_id', userData.id)
      .single();

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
      last_updated: new Date().toISOString()
    };

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
        sale_price: salePriceData
      }
    });
  } catch (error) {
    console.error('Error processing fetch item request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}