// src/app/api/stores/select/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// POST: Selecciona una tienda y establece las cookies de sesión
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda a seleccionar
    const { store_id } = await request.json();
    
    if (!store_id) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario tiene acceso a esta tienda
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', store_id)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener la información de la tienda
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select('ml_user_id')
      .eq('id', store_id)
      .single();

    if (storeError || !storeInfo) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Establecer cookies para mantener la sesión
    (await cookies()).set('selected_store_id', store_id, {
      path: '/',
      maxAge: 60 * 60 * 24, // 1 día
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  
    (await cookies()).set('ml_user_id', storeInfo.ml_user_id, {
      path: '/',
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    return NextResponse.json({
      success: true,
      message: 'Store selected successfully',
      store_id: store_id,
      role: userAccess.role
    });
  } catch (error) {
    console.error('Error selecting store:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}