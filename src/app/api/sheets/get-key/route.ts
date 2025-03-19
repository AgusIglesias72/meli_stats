// src/app/api/sheets/get-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return NextResponse.json({
      apiKey: userData.sheets_api_key || null
    });
  } catch (error) {
    console.error('Error getting sheets API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}