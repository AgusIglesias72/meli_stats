// src/app/api/tracked-items/bulk/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Configuración para Edge Runtime
export const runtime = 'edge';
export const preferredRegion = 'auto';

/**
 * GET: Obtiene el estado actual del procesamiento por lotes de items
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = request.cookies.get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = request.cookies.get('selected_store_id')?.value;
    
    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
    }

    // Obtener parámetros opcionales
    const url = new URL(request.url);
    const batchId = url.searchParams.get('batch_id');
    const status = url.searchParams.get('status');
    
    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Comenzar a construir la consulta
    let query = supabase
      .from('tracked_items_config')
      .select('id, item_id, processing_status, processing_message')
      .eq('store_id', selectedStoreId);
      
    // Filtrar por estado específico si se proporciona
    if (status) {
      query = query.eq('processing_status', status);
    }
    
    // Obtener todos los elementos para contar manualmente por estado
    const { data: allItems, error: countsError } = await supabase
      .from('tracked_items_config')
      .select('processing_status')
      .eq('store_id', selectedStoreId);
      
    if (countsError) {
      console.error('Error fetching items for status counts:', countsError);
    }
    
    // Formatear recuentos en un formato más amigable
    const counts = {
      pending: 0,
      success: 0,
      error: 0,
      error_data: 0,
      total: 0
    };
    
    if (allItems) {
      // Contar manualmente por cada estado
      allItems.forEach((item: any) => {
        if (item.processing_status && counts.hasOwnProperty(item.processing_status)) {
          counts[item.processing_status as keyof typeof counts]++;
        }
        counts.total++;
      });
    }
    
    // Si solo queremos los recuentos, devuelve aquí
    if (url.searchParams.get('counts_only') === 'true') {
      return NextResponse.json({
        status: 'success',
        counts
      });
    }
    
    // Aplicar paginación
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    // Obtener los elementos con paginación
    const { data: items, error: itemsError, count } = await query
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
      .limit(limit);
      
    if (itemsError) {
      console.error('Error fetching tracked items status:', itemsError);
      return NextResponse.json({ error: 'Error fetching tracking status' }, { status: 500 });
    }
    
    // Calcular información de paginación
    const totalPages = Math.ceil((count || 0) / limit);
    
    return NextResponse.json({
      status: 'success',
      counts,
      items,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching bulk import status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}

/**
 * POST: Reintentar procesamiento de items fallidos
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = request.cookies.get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = request.cookies.get('selected_store_id')?.value;
    
    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
    }

    // Obtener datos del cuerpo
    const { itemIds } = await request.json();
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Item IDs array is required' }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario tiene acceso a esta tienda
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }
    
    // Verificar si el usuario tiene permisos
    if (userAccess.role === 'viewer') {
      return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
    }

    // Resetear el estado de los items para ser reprocesados
    const { error: updateError } = await supabase
      .from('tracked_items_config')
      .update({
        processing_status: 'pending',
        processing_message: null
      })
      .in('item_id', itemIds)
      .eq('store_id', selectedStoreId);

    if (updateError) {
      console.error('Error resetting items for retry:', updateError);
      return NextResponse.json({ error: 'Error resetting items for retry' }, { status: 500 });
    }

    // Iniciar procesamiento en segundo plano
    // Nota: Aquí podríamos implementar una cola real de procesamiento,
    // pero para esta demo simplemente devolveremos éxito

    return NextResponse.json({
      success: true,
      message: 'Items reset for reprocessing',
      count: itemIds.length
    });
  } catch (error: any) {
    console.error('Error processing retry request:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}