// src/app/api/stores/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// Forzar runtime NodeJS (Serverless)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verificar clave de API para seguridad
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const apiKey = authHeader.split(' ')[1];
    if (apiKey !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    
    // Obtener el ID de la tienda de los parámetros de la URL
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    
    if (!storeId) {
      return NextResponse.json({ error: 'store_id is required' }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Buscar la tienda por store_id (el ID externo de Mercado Libre)
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('access_token, token_expiry, ml_user_id')
      .eq('store_id', storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Simplemente devolver el token actual sin intentar renovarlo
    return NextResponse.json({
      access_token: store.access_token,
      seller_id: store.ml_user_id,
      expires_at: store.token_expiry
    });
    
  } catch (error) {
    console.error('Error getting store token:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}