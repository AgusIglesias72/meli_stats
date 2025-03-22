// src/app/api/stores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Interfaces para tipar los datos
interface StoreData {
  id: string;
  store_id: string;
  name: string;
  ml_user_id: string;
  created_at: string;
  updated_at: string;
}

interface StoreUserData {
  id: string;
  role: string;
  store: StoreData;
}

interface FormattedStore {
  id: string;
  store_id: string;
  name: string;
  ml_user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

// GET: Obtiene todas las tiendas a las que tiene acceso el usuario
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener todas las tiendas a las que tiene acceso el usuario
    const { data: userStores, error: storesError } = await supabase
      .from('store_users')
      .select(`
        id,
        role,
        store:store_id (
          id,
          store_id,
          name,
          ml_user_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false });

    if (storesError) {
      console.error('Error fetching user stores:', storesError);
      return NextResponse.json({ error: 'Error fetching stores' }, { status: 500 });
    }

    // Formatear la respuesta
    const formattedStores: FormattedStore[] = (userStores as unknown as StoreUserData[]).map(item => ({
      id: item.store?.id || '',
      store_id: item.store?.store_id || '',
      name: item.store?.name || '',
      ml_user_id: item.store?.ml_user_id || '',
      role: item.role,
      created_at: item.store?.created_at || '',
      updated_at: item.store?.updated_at || ''
    }));

    return NextResponse.json({
      stores: formattedStores
    });
  } catch (error) {
    console.error('Error processing stores request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}