// src/app/api/import-errors/[id]/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Maneja la solicitud POST para marcar un error como resuelto
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const errorId = params.id;
    
    if (!errorId) {
      return NextResponse.json(
        { error: 'ID de error no proporcionado' },
        { status: 400 }
      );
    }
    
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
    
    // Obtener datos del cuerpo de la solicitud
    const { notes } = await request.json();
    
    // Actualizar el error
    const { error } = await supabase
      .from('import_errors')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        notes: notes || null
      })
      .eq('id', errorId)
      .eq('user_id', userId); // Asegurar que el error pertenezca al usuario
    
    if (error) {
      console.error('Error al actualizar el error:', error);
      return NextResponse.json(
        { error: 'Error al marcar como resuelto' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Error al marcar como resuelto:', error);
    return NextResponse.json(
      { error: error.message || 'Error al marcar como resuelto' },
      { status: 500 }
    );
  }
}