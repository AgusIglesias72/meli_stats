// src/app/api/sheets/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;
    
    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
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

    // Obtener información de la tienda
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('gsheets_api_key, store_id')
      .eq('id', selectedStoreId)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!storeData.gsheets_api_key) {
      return NextResponse.json({ error: 'API key not generated' }, { status: 400 });
    }

    // Obtener datos de prueba para verificar que todo funciona
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, item_id, title')
      .eq('store_id', selectedStoreId)
      .limit(5);

    if (itemsError) {
      console.error('Error fetching test items:', itemsError);
      return NextResponse.json({ error: 'Error fetching test data' }, { status: 500 });
    }

    const { data: trackedItems, error: trackedError } = await supabase
      .from('tracked_items_config')
      .select('id, item_id, notes')
      .eq('store_id', selectedStoreId)
      .limit(5);

    if (trackedError) {
      console.error('Error fetching test tracked items:', trackedError);
      return NextResponse.json({ error: 'Error fetching test data' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      storeId: storeData.store_id,
      items,
      tracked_items: trackedItems
    });
  } catch (error) {
    console.error('Error testing sheets connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}