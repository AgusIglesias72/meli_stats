// src/app/api/sheets-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// Esta API key será utilizada para autenticar las solicitudes desde Google Apps Script
// En un entorno de producción, deberías usar una solución más robusta
const API_KEY = process.env.NEXT_PUBLIC_SHEETS_API_KEY || 'tu-clave-secreta-aqui';

export async function GET(request: NextRequest) {
  try {
    // Verificar que la solicitud tenga la API key correcta
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de usuario de Mercado Libre desde los parámetros
    const searchParams = request.nextUrl.searchParams;
    const mlUserId = searchParams.get('user_id');
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Obtener datos del usuario desde Supabase
    const supabase = createServerSupabaseClient();
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', mlUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obtener tipos de datos solicitados (items, tracked_items o ambos)
    const dataType = searchParams.get('type') || 'all';
    const response: any = { user_id: mlUserId };

    // Obtener items del usuario si se solicitan
    if (dataType === 'all' || dataType === 'items') {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userData.id)
        .order('last_updated', { ascending: false });

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return NextResponse.json({ error: 'Error fetching items' }, { status: 500 });
      }

      response.items = items || [];
    }

    // Obtener los items trackeados y sus datos más recientes si se solicitan
    if (dataType === 'all' || dataType === 'tracked_items') {
      const { data: trackedItems, error: trackedError } = await supabase
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
            brand,
            last_updated
          )
        `)
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (trackedError) {
        console.error('Error fetching tracked items:', trackedError);
        return NextResponse.json({ error: 'Error fetching tracked items' }, { status: 500 });
      }

      // Procesar los items trackeados para tener un formato más limpio
      const processedTrackedItems = (trackedItems || []).map(item => {
        const latestData = item.tracked_items_data && item.tracked_items_data.length > 0
          ? item.tracked_items_data[0]
          : null;

        return {
          id: item.id,
          item_id: item.item_id,
          notes: item.notes,
          created_at: item.created_at,
          data: latestData
        };
      });

      response.tracked_items = processedTrackedItems;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing sheets data request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}