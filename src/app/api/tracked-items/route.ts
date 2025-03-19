import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET: Obtiene todos los items trackeados por el usuario
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

    // Obtener los items trackeados y sus datos más recientes
    const { data: trackedItems, error: itemsError, count } = await supabase
      .from('tracked_items_config')
      .select(`
        id,
        item_id,
        notes,
        created_at,
        tracked_items_data (
          id,
          price,
          base_price,
          title,
          available_quantity,
          status,
          thumbnail,
          permalink,
          regular_amount,
          amount,
          currency_id,
          last_updated
        )
      `, { count: 'exact' })
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error('Error fetching tracked items:', itemsError);
      return NextResponse.json({ error: 'Error fetching tracked items' }, { status: 500 });
    }

    // Procesar los resultados para un formato más amigable
    const processedItems = trackedItems.map(item => {
      const latestData = item.tracked_items_data && item.tracked_items_data.length > 0
        ? item.tracked_items_data[0] // Asumimos que el más reciente viene primero
        : null;

      return {
        id: item.id,
        item_id: item.item_id,
        notes: item.notes,
        created_at: item.created_at,
        data: latestData
      };
    });

    // Calcular información de paginación
    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      trackedItems: processedItems,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error processing tracked items request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Añade un nuevo item para trackear
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener datos del cuerpo
    const { itemId, notes } = await request.json();
    
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

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

    // Comprobar si el item ya está siendo trackeado por este usuario
    const { data: existingItem } = await supabase
      .from('tracked_items_config')
      .select('id')
      .eq('user_id', userData.id)
      .eq('item_id', itemId)
      .single();

    if (existingItem) {
      return NextResponse.json({ 
        error: 'Item already being tracked', 
        itemId: existingItem.id 
      }, { status: 409 });
    }

    // Añadir el nuevo item a trackear
    const { data: newItem, error: insertError } = await supabase
      .from('tracked_items_config')
      .insert({
        user_id: userData.id,
        item_id: itemId,
        notes: notes || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting tracked item:', insertError);
      return NextResponse.json({ error: 'Error adding item to track' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Item added to tracking',
      item: newItem
    });
  } catch (error) {
    console.error('Error processing add tracked item request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Elimina un item trackeado
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID del item a eliminar
    const searchParams = request.nextUrl.searchParams;
    const configId = searchParams.get('id');
    
    if (!configId) {
      return NextResponse.json({ error: 'Tracked item ID is required' }, { status: 400 });
    }

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

    // Verificar que el item pertenece al usuario
    const { data: trackedItem } = await supabase
      .from('tracked_items_config')
      .select('id')
      .eq('id', configId)
      .eq('user_id', userData.id)
      .single();

    if (!trackedItem) {
      return NextResponse.json({ error: 'Item not found or not owned by user' }, { status: 404 });
    }

    // Primero, eliminar los datos asociados
    await supabase
      .from('tracked_items_data')
      .delete()
      .eq('config_id', configId);

    // Luego, eliminar la configuración
    const { error: deleteError } = await supabase
      .from('tracked_items_config')
      .delete()
      .eq('id', configId);

    if (deleteError) {
      console.error('Error deleting tracked item:', deleteError);
      return NextResponse.json({ error: 'Error removing tracked item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Item removed from tracking'
    });
  } catch (error) {
    console.error('Error processing delete tracked item request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}