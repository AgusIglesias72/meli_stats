// src/app/api/stores/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = (await params).id;
    
    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario tiene acceso a esta tienda
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', storeId)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener la información de la tienda
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select(`
        id,
        store_id,
        name,
        ml_user_id,
        token_expiry,
        created_at,
        updated_at,
        seller_first_name,
        seller_last_name,
        seller_email,
        seller_identification_number
      `)
      .eq('id', storeId)
      .single();

    if (storeError || !storeInfo) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      store: storeInfo,
      user_role: userAccess.role
    });
  } catch (error) {
    console.error('Error getting store information:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// src/app/api/stores/[id]/route.ts - Método PATCH
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      // Verificar autenticación
      const authUserId = (await cookies()).get('auth_user_id')?.value;
      
      if (!authUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
  
      const storeId = (await params).id;
      
      // Obtener datos a actualizar
      const {
        name,
        seller_first_name,
        seller_last_name,
        seller_email,
        seller_identification_number
      } = await request.json();
      
      // Crear conexión a Supabase
      const supabase = createServerSupabaseClient();
      
      // Verificar si el usuario tiene acceso a esta tienda
      const { data: userAccess, error: accessError } = await supabase
        .from('store_users')
        .select('role')
        .eq('user_id', authUserId)
        .eq('store_id', storeId)
        .single();
  
      if (accessError || !userAccess) {
        return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
      }
  
      // Verificar si el usuario tiene permisos para actualizar (owner o admin)
      if (!['owner', 'admin'].includes(userAccess.role)) {
        return NextResponse.json({ error: 'You do not have permission to update store information' }, { status: 403 });
      }
  
      // Actualizar la información de la tienda
      const { data: updatedStore, error: updateError } = await supabase
        .from('stores')
        .update({
          name: name,
          seller_first_name: seller_first_name,
          seller_last_name: seller_last_name,
          seller_email: seller_email,
          seller_identification_number: seller_identification_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId)
        .select()
        .single();
  
      if (updateError) {
        console.error('Error updating store:', updateError);
        return NextResponse.json({ error: 'Error updating store' }, { status: 500 });
      }
  
      return NextResponse.json({
        success: true,
        store: updatedStore
      });
    } catch (error) {
      console.error('Error updating store:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }