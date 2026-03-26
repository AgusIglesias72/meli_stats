// src/app/api/tracked-items/bulk/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, trackedItemsConfig } from '@/lib/db/schema';
import { eq, and, or, desc, inArray } from 'drizzle-orm';

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
    const status = url.searchParams.get('status');

    // Obtener todos los elementos para contar manualmente por estado
    // CORREGIDO: Asegurarnos de obtener solo ítems de la tienda actual
    const allItems = await db.select({ processing_status: trackedItemsConfig.processing_status })
      .from(trackedItemsConfig)
      .where(eq(trackedItemsConfig.store_id, selectedStoreId));

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
        // CORREGIDO: Asegurarnos de contar correctamente incluso estados no esperados
        if (item.processing_status === 'pending') counts.pending++;
        else if (item.processing_status === 'success') counts.success++;
        else if (item.processing_status === 'error') counts.error++;
        else if (item.processing_status === 'error_data') counts.error_data++;

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

    // Comenzar a construir las condiciones
    const conditions = [eq(trackedItemsConfig.store_id, selectedStoreId)];

    // Filtrar por estado específico si se proporciona
    if (status) {
      // CORREGIDO: Si el estado es 'error', incluir también 'error_data'
      if (status === 'error') {
        conditions.push(
          or(
            eq(trackedItemsConfig.processing_status, 'error'),
            eq(trackedItemsConfig.processing_status, 'error_data')
          )!
        );
      } else {
        conditions.push(eq(trackedItemsConfig.processing_status, status));
      }
    }

    // Obtener los elementos con paginación
    const items = await db.select({
      id: trackedItemsConfig.id,
      item_id: trackedItemsConfig.item_id,
      processing_status: trackedItemsConfig.processing_status,
      processing_message: trackedItemsConfig.processing_message,
    })
      .from(trackedItemsConfig)
      .where(and(...conditions))
      .orderBy(desc(trackedItemsConfig.id))
      .limit(limit)
      .offset(offset);

    // Calcular información de paginación
    const totalPages = Math.ceil(counts.total / limit);

    return NextResponse.json({
      status: 'success',
      counts,
      items,
      pagination: {
        page,
        limit,
        totalItems: counts.total,
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

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db.select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(
        eq(storeUsers.user_id, authUserId),
        eq(storeUsers.store_id, selectedStoreId)
      ))
      .limit(1);

    if (!userAccess) {
      console.error('Access denied to this store');
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene permisos
    if (userAccess.role === 'viewer') {

      return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
    }

    // Resetear el estado de los items para ser reprocesados
    await db.update(trackedItemsConfig)
      .set({
        processing_status: 'pending',
        processing_message: null
      })
      .where(and(
        inArray(trackedItemsConfig.item_id, itemIds),
        eq(trackedItemsConfig.store_id, selectedStoreId)
      ));

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
