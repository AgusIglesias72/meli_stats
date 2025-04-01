// src/app/api/items/retry-import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Maneja la solicitud POST para reintentar la importación de un item
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener IDs de usuario y tienda seleccionada de las cookies
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;
    
    if (!authUserId) {
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
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', selectedStoreId)
      .single();
    
    if (storeError || !storeData) {
      console.error('Error al obtener información de la tienda:', storeError);
      return NextResponse.json(
        { error: 'Error al obtener información de la tienda' },
        { status: 500 }
      );
    }

    // Obtener usuario de Mercado Libre asociado a la tienda
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', storeData.ml_user_id)
      .single();
    
    if (userError || !userData) {
      console.error('Error al obtener información del usuario:', userError);
      return NextResponse.json(
        { error: 'Error al obtener información del usuario de Mercado Libre' },
        { status: 500 }
      );
    }
    
    const accessToken = userData.access_token;
    const userId = userData.user_id;
    
    // Obtener datos del cuerpo de la solicitud
    const { itemId, errorId } = await request.json();
    
    if (!itemId) {
      return NextResponse.json(
        { error: 'ID de item no proporcionado' },
        { status: 400 }
      );
    }
    
    // Intentar obtener el item desde la API de Mercado Libre
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Error al obtener item: ${response.status} ${response.statusText}`);
    }
    
    const item = await response.json();
    
    // Insertar el item en la base de datos
    const { error: insertError } = await supabase
      .from('items')
      .insert({
        item_id: item.id,
        user_id: userId,
        site_id: item.site_id,
        title: item.title,
        seller_id: item.seller_id,
        category_id: item.category_id,
        official_store_id: item.official_store_id,
        price: item.price,
        base_price: item.base_price,
        currency_id: item.currency_id,
        available_quantity: item.available_quantity,
        status: item.status,
        permalink: item.permalink,
        thumbnail: item.thumbnail
      });
    
    if (insertError) {
      throw new Error(`Error al insertar item: ${insertError.message}`);
    }
    
    // Si se proporcionó un ID de error, marcarlo como resuelto
    if (errorId) {
      await supabase
        .from('import_errors')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          notes: 'Resuelto automáticamente mediante reimportación exitosa'
        })
        .eq('id', errorId)
        .eq('user_id', userId); // Asegurar que el error pertenezca al usuario
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Error al reintentar importación:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al reintentar la importación' },
      { status: 500 }
    );
  }
}