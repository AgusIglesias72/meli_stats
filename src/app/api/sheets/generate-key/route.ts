// src/app/api/sheets/generate-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determinar si es una regeneración forzada
    const body = await request.json().catch(() => ({}));
    const forceReset = body?.reset === true;

    // Obtener el usuario desde la base de datos
    const supabase = createServerSupabaseClient();
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, sheets_api_key')
      .eq('user_id', mlUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verificar si ya tiene una API key y no se solicita regeneración
    if (userData.sheets_api_key && !forceReset) {
      return NextResponse.json({
        apiKey: userData.sheets_api_key,
        message: 'API key already exists'
      });
    }

    // Generar una nueva API key
    const newApiKey = generateApiKey(mlUserId);

    // Actualizar la API key del usuario
    const { error: updateError } = await supabase
      .from('users')
      .update({
        sheets_api_key: newApiKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id);

    if (updateError) {
      console.error('Error updating API key:', updateError);
      return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
    }

    return NextResponse.json({
      apiKey: newApiKey,
      message: forceReset ? 'API key regenerated' : 'API key generated'
    });
  } catch (error) {
    console.error('Error generating sheets API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Genera una API key segura basada en el ID de usuario y un componente aleatorio
 */
function generateApiKey(userId: string): string {
  // Combinar el ID de usuario con un timestamp y un componente aleatorio
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const baseString = `${userId}-${timestamp}-${randomBytes}`;
  
  // Generar un hash SHA-256 del string base
  const hash = crypto.createHash('sha256').update(baseString).digest('hex');
  
  // Devolver los primeros 32 caracteres del hash para una API key más manejable
  return hash.substring(0, 32);
}