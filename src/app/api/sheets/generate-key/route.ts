// src/app/api/sheets/generate-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
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

    // Determinar si es una regeneración forzada
    const body = await request.json().catch(() => ({}));
    const forceReset = body?.reset === true;

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

    // Verificar si el usuario tiene rol suficiente para generar API key (owner o admin)
    if (!['owner', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'You do not have permission to generate API keys' }, { status: 403 });
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

    // Verificar si ya tiene una API key y no se solicita regeneración
    if (storeData.gsheets_api_key && !forceReset) {
      return NextResponse.json({
        apiKey: storeData.gsheets_api_key,
        storeId: storeData.store_id,
        message: 'API key already exists'
      });
    }

    // Generar una nueva API key
    const newApiKey = generateApiKey(storeData.store_id);

    // Actualizar la API key de la tienda
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        gsheets_api_key: newApiKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedStoreId);

    if (updateError) {
      console.error('Error updating API key:', updateError);
      return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
    }

    return NextResponse.json({
      apiKey: newApiKey,
      storeId: storeData.store_id,
      message: forceReset ? 'API key regenerated' : 'API key generated'
    });
  } catch (error) {
    console.error('Error generating sheets API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Genera una API key segura basada en el ID de tienda y un componente aleatorio
 */
function generateApiKey(storeId: string): string {
  // Combinar el ID de tienda con un timestamp y un componente aleatorio
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const baseString = `${storeId}-${timestamp}-${randomBytes}`;
  
  // Generar un hash SHA-256 del string base
  const hash = crypto.createHash('sha256').update(baseString).digest('hex');
  
  // Devolver los primeros 32 caracteres del hash para una API key más manejable
  return hash.substring(0, 32);
}