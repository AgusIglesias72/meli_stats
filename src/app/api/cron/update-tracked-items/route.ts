// src/app/api/cron/update-tracked-items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// Definición de tipos para una mejor tipificación
interface TrackedItem {
  id: string;
  item_id: string;
  store_id: string;
  user_id?: string;
}

interface StoreData {
  id?: string;
  access_token: string;
  token_expiry: string;
  ml_user_id?: string;
}

interface ItemData {
  id: string;
  site_id: string;
  title: string;
  seller_id: string;
  category_id: string;
  official_store_id: string | null;
  price: number;
  base_price: number;
  currency_id: string;
  available_quantity: number;
  permalink: string;
  thumbnail: string;
  status: string;
  attributes?: Array<{
    id: string;
    name: string;
    value_id?: string;
    value_name?: string;
  }>;
}

interface SalePriceData {
  regular_amount: number | null;
  amount: number | null;
}

interface ProcessResult {
  store_id: string;
  error?: string;
  processed?: number;
  total?: number;
}

interface ItemProcessResult {
  success: boolean;
  error?: any;
}

// Clave secreta para autorizar peticiones externas
const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    // Verificar la autorización mediante clave secreta
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ') || authorization.split(' ')[1] !== API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    
    // Obtener todos los items a trackear
    const { data: trackedItems, error: trackedError } = await supabase
      .from('tracked_items_config')
      .select('id, item_id, store_id');

    if (trackedError) {
      console.error('Error fetching tracked items:', trackedError);
      return NextResponse.json({ error: 'Error fetching tracked items' }, { status: 500 });
    }

    if (!trackedItems || trackedItems.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No tracked items found' 
      });
    }

    // Agrupar por tienda para usar los tokens correctos
    const itemsByStore: Record<string, TrackedItem[]> = {};
    trackedItems.forEach((item: TrackedItem) => {
      if (!itemsByStore[item.store_id]) {
        itemsByStore[item.store_id] = [];
      }
      itemsByStore[item.store_id].push(item);
    });

    // Procesar cada tienda
    const results: ProcessResult[] = [];
    for (const storeId of Object.keys(itemsByStore)) {
      // Obtener token para la tienda
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('access_token, token_expiry')
        .eq('id', storeId)
        .single();
        
      if (storeError || !storeData) {
        results.push({
          store_id: storeId,
          error: 'Store not found or no access token',
          processed: 0
        });
        continue;
      }
      
      // Verificar si el token ha expirado
      if (new Date(storeData.token_expiry) < new Date()) {
        results.push({
          store_id: storeId,
          error: 'Token expired',
          processed: 0
        });
        continue;
      }
      
      // Procesar items de esta tienda en lotes
      const items = itemsByStore[storeId];
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (item) => {
            try {
              // Obtener datos del item desde la API de ML
              const { itemData, salePriceData } = await fetchItemData(item.item_id, storeData.access_token);
              
              // Guardar en tracked_items_data
              await saveItemData(supabase, item.id, { itemData, salePriceData });
              
              return { success: true } as ItemProcessResult;
            } catch (error) {
              console.error(`Error processing item ${item.item_id}:`, error);
              return { success: false, error } as ItemProcessResult;
            }
          })
        );
        
        // Contar los éxitos
        processed += batchResults.filter(r => 
          r.status === 'fulfilled' && (r.value as ItemProcessResult).success
        ).length;
        
        // Pausa para no sobrecargar la API
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      results.push({
        store_id: storeId,
        processed,
        total: items.length
      });
    }

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Función para obtener datos de un item desde la API de ML
async function fetchItemData(itemId: string, accessToken: string): Promise<{ itemData: ItemData; salePriceData: SalePriceData | null }> {
  const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!itemResponse.ok) {
    throw new Error(`Error fetching item ${itemId}: ${itemResponse.statusText}`);
  }

  const itemData = await itemResponse.json() as ItemData;
  
  // Obtener información del precio de venta
  const salePriceResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  let salePriceData: SalePriceData | null = null;
  if (salePriceResponse.ok) {
    salePriceData = await salePriceResponse.json() as SalePriceData;
  }
  
  return { itemData, salePriceData };
}

// Función para guardar datos en tracked_items_data
async function saveItemData(
  supabase: any,
  configId: string, 
  { itemData, salePriceData }: { itemData: ItemData; salePriceData: SalePriceData | null }
) {
  let brand: string | null = null;
  if (itemData.attributes && Array.isArray(itemData.attributes)) {
    const brandAttribute = itemData.attributes.find(attr => attr.id === 'BRAND'); 
    if (brandAttribute && brandAttribute.value_name) {
      brand = brandAttribute.value_name;
    }
  }

  return supabase
    .from('tracked_items_data')
    .insert({
      config_id: configId,
      item_id: itemData.id,
      site_id: itemData.site_id,
      title: itemData.title,
      seller_id: itemData.seller_id,
      category_id: itemData.category_id,
      official_store_id: itemData.official_store_id,
      price: itemData.price,
      base_price: itemData.base_price,
      currency_id: itemData.currency_id,
      available_quantity: itemData.available_quantity,
      permalink: itemData.permalink,
      thumbnail: itemData.thumbnail,
      status: itemData.status,
      regular_amount: salePriceData?.regular_amount || null,
      amount: salePriceData?.amount || null,
      brand: brand,
      last_updated: new Date().toISOString()
    });
}