import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const maxDuration = 10; // Reduced from 59 to 10 seconds to save costs


export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener parámetros de paginación
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Obtener el usuario desde la base de datos
    const supabase = createServerSupabaseClient();
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', mlUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obtener los items del usuario
    const { data: items, error: itemsError, count } = await supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('user_id', userData.id)
      .order('last_updated', { ascending: false })
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ error: 'Error fetching items' }, { status: 500 });
    }

    // Calcular información de paginación
    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error processing list items request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}