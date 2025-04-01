// src/app/api/import-errors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Maneja la solicitud GET para obtener errores de importación
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener filtro de la URL
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all';
    
    // Crear cliente de Supabase
    const supabase = createServerSupabaseClient();
    
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
    
    // El usuario ML será el asociado a la tienda
    const userId = storeData.ml_user_id;

    if (!userId) {
      return NextResponse.json(
        { error: 'No se pudo obtener el ID de usuario de Mercado Libre para la tienda.' },
        { status: 400 }
      );
    }
    
    // Consultar errores de importación
    let query = supabase
      .from('import_errors')
      .select('*')
      .eq('user_id', userId);
    
    // Aplicar filtro
    if (filter === 'resolved') {
      query = query.eq('resolved', true);
    } else if (filter === 'unresolved') {
      query = query.eq('resolved', false);
    }
    
    // Ordenar por fecha de creación (más recientes primero)
    query = query.order('created_at', { ascending: false });
    
    const { data: errors, error } = await query;
    
    if (error) {
      console.error('Error al consultar errores de importación:', error);
      return NextResponse.json(
        { error: 'Error al cargar los errores de importación' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ errors: errors || [] });
    
  } catch (error: any) {
    console.error('Error en la API de errores de importación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar errores de importación' },
      { status: 500 }
    );
  }
}