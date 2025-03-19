// src/app/api/sheets/test/route.ts
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

    // Obtener parámetros
    const searchParams = request.nextUrl.searchParams;
    const userIdParam = searchParams.get('user_id');
    
    // Verificar que el user_id del parámetro coincida con el autenticado
    if (userIdParam !== mlUserId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
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

    if (!userData.sheets_api_key) {
      return NextResponse.json({ error: 'API key not generated' }, { status: 400 });
    }

    // Obtener datos de prueba para verificar que todo funciona
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, item_id, title')
      .eq('user_id', userData.id)
      .limit(5);

    if (itemsError) {
      console.error('Error fetching test items:', itemsError);
      return NextResponse.json({ error: 'Error fetching test data' }, { status: 500 });
    }

    const { data: trackedItems, error: trackedError } = await supabase
      .from('tracked_items_config')
      .select('id, item_id, notes')
      .eq('user_id', userData.id)
      .limit(5);

    if (trackedError) {
      console.error('Error fetching test tracked items:', trackedError);
      return NextResponse.json({ error: 'Error fetching test data' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      items,
      tracked_items: trackedItems
    });
  } catch (error) {
    console.error('Error testing sheets connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}