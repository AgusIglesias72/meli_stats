// src/app/api/stores/current/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET: Obtiene la información de la tienda actual seleccionada
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda seleccionada de las cookies
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;
    
    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 404 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar que el usuario tiene acceso a esta tienda y obtener el rol
    const { data: storeAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .single();

    console.log('storeAccess', storeAccess);

    if (accessError || !storeAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener información básica de la tienda
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select('id, name, store_id, ml_user_id')
      .eq('id', selectedStoreId)
      .single();

    if (storeError || !storeInfo) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      store: {
        id: storeInfo.id,
        name: storeInfo.name,
        store_id: storeInfo.store_id
      },
      role: storeAccess.role
    });
  } catch (error) {
    console.error('Error fetching current store:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}