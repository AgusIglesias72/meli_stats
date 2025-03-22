// src/app/api/sheets-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Obtener la API key del header de autorización
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    // Obtener el ID de la tienda desde los parámetros
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Crear cliente Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si la API key es válida para la tienda proporcionada
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('store_id', storeId)
      .eq('gsheets_api_key', apiKey)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Invalid API key or store ID' }, { status: 401 });
    }

    // Obtener el tipo de datos solicitados (items, tracked_items o ambos)
    const dataType = searchParams.get('type') || 'all';
    const response: any = { store_id: storeId };

    // Obtener items de la tienda si se solicitan
    if (dataType === 'all' || dataType === 'items') {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('store_id', storeData.id)
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
        .eq('store_id', storeData.id)
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