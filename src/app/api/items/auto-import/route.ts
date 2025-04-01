// Import necesario para Next.js API route
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

export const maxDuration = 59; // This function can run for a maximum of 5 seconds

// Tipo para la respuesta de la API de Mercado Libre
interface MLAPISearchResponse {
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
  results: Array<{
    id: string;
    title: string;
    // otros campos
  }>;
}

interface MLAPIItemsResponse {
  code: number;
  body: {
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
    status: string;
    permalink: string;
    thumbnail: string;
    seller_custom_field: any;
    catalog_listing: boolean;
  }[] | any;
}

// Modelo para errores de importación
interface ImportError {
  item_id: string;
  error_message: string;
  created_at: Date;
}

/**
 * Maneja la solicitud POST para auto-importar productos desde Mercado Libre.
 * Recopila todos los IDs de productos y los importa en lotes.
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener IDs de usuario y tienda seleccionada de las cookies
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;

    if (!authUserId) {
      console.log('No autorizado. Usuario no identificado.');
      return NextResponse.json(
        { error: 'No autorizado. Usuario no identificado.' },
        { status: 401 }
      );
    }
    
    if (!selectedStoreId) {
      return NextResponse.json(
        { error: 'No hay tienda seleccionada.' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener información de la tienda seleccionada
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', selectedStoreId)
      .single();
    
    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    if (userAccess.role === 'viewer') {
      return NextResponse.json({ error: 'You do not have permission to import items' }, { status: 403 });
    }

    // Obtener usuario de Mercado Libre asociado a la tienda
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry')
      .eq('id', selectedStoreId)
      .single();
    
      if (storeError || !storeData) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (new Date(storeData.token_expiry) < new Date()) {
      return NextResponse.json({ error: 'Token expired, please re-authenticate' }, { status: 401 });
    }
    
    const accessToken = storeData.access_token;
    const userId = storeData.ml_user_id;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autorizado. Falta token de acceso.' },
        { status: 401 }
      );
    }

    
       // Recopilar todos los IDs de productos disponibles
       const allProductIds = await getAllProductIds(accessToken, userId);
    
       // Obtener IDs que ya existen en la base de datos para evitar duplicados
       const { data: existingItems } = await supabase
         .from('items')
         .select('item_id')
         .eq('user_id', userId);
       
       // Crear un Set para búsqueda eficiente
       const existingItemIds = new Set(existingItems?.map(item => item.item_id) || []);
         
    // Filtrar para procesar solo los nuevos
    const newItemIds = allProductIds.filter((id: string) => !existingItemIds.has(id));
    
    if (newItemIds.length === 0) {
      return Response.json({
        imported: 0,
        failed: 0,
        total: 0,
        message: 'No hay nuevos productos para importar'
      });
    }
    
    // Variables para seguimiento
    const itemsToInsert = [];
    const failedItems = [];
    
    // Procesar los productos en lotes de 20
    const batchSize = 20;
    for (let i = 0; i < newItemIds.length; i += batchSize) {
      const batch = newItemIds.slice(i, i + batchSize);
      
      // Obtener los precios de venta para este lote
      const priceDataMap = await getProductsSalePrices(batch, accessToken);
      
      // Obtener información detallada de los productos
      const itemInfoResponse = await fetch(`https://api.mercadolibre.com/items?ids=${batch.join(',')}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!itemInfoResponse.ok) {
        // Si falla todo el lote, añadir todos los IDs a fallidos
        failedItems.push(...batch);
        continue;
      }
      
      const itemsData = await itemInfoResponse.json();
      
      // Procesar cada producto
      for (const itemData of itemsData) {
        if (itemData.code !== 200 || !itemData.body) {
          failedItems.push(itemData.id || 'unknown');
          continue;
        }
        
        const item = itemData.body;
        const priceData = priceDataMap[item.id];
        
        // Preparar el objeto para insertar, incluyendo datos de precios
        itemsToInsert.push({
          item_id: item.id,
          user_id: authUserId,
          store_id: selectedStoreId,
          site_id: item.site_id,
          title: item.title,
          seller_id: item.seller_id,
          category_id: item.category_id,
          official_store_id: item.official_store_id,
          price: item.price,
          base_price: item.base_price,
          regular_amount: priceData?.regular_amount || null,
          amount: priceData?.amount || null,
          currency_id: item.currency_id,
          available_quantity: item.available_quantity,
          permalink: item.permalink,
          thumbnail: item.thumbnail,
          status: item.status,
          last_updated: new Date().toISOString()
        });
      }
    }
    
    // Insertar en la base de datos
    const { error: insertError, data: insertedItems } = await supabase
      .from('items')
      .insert(itemsToInsert)
      .select();
    
    // Obtener el número de elementos insertados
    const count = insertedItems ? insertedItems.length : 0;
    
    if (insertError) {
      console.error('Error al insertar items:', insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }
    
    return Response.json({
      imported: count,
      failed: failedItems.length,
      total: newItemIds.length
    });
  } catch (error) {
    console.error('Error en auto-import:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
   
   /**
    * Obtiene todos los IDs de productos disponibles usando paginación con scroll_id.
    * Esta función maneja correctamente grandes volúmenes de productos (más de 1000).
    */
   async function getAllProductIds(accessToken: string, userId: string): Promise<string[]> {
     let allIds: Set<string> = new Set(); // Usamos un Set para evitar duplicados automáticamente
     let scrollId: string | null = null;
     let hasMore = true;
     
     while (hasMore) {
       try {
         // Construir URL de consulta
         let url = `https://api.mercadolibre.com/users/${userId}/items/search?search_type=scan&limit=100`;
         
         // Añadir scroll_id si existe
         if (scrollId) {
           url += `&scroll_id=${encodeURIComponent(scrollId)}`;
         }
         
         // Consultar productos con paginación
         const response = await fetch(url, {
           headers: {
             'Authorization': `Bearer ${accessToken}`
           }
         });
         
         if (!response.ok) {
           throw new Error(`Error al obtener productos: ${response.status} ${response.statusText}`);
         }
         
         const data = await response.json();
         
         // Guardar IDs de esta página
         const pageIds = data.results || [];
         pageIds.forEach((id: string) => allIds.add(id));
         
         // Verificar si hay más páginas
         if (data.scroll_id && data.scroll_id !== scrollId && data.scroll_id !== "") {
           // Actualizar scrollId para la siguiente iteración
           scrollId = data.scroll_id;
         } else {
           // No hay más páginas para procesar
           hasMore = false;
         }
         
         // Esperar un poco entre solicitudes para no sobrecargar la API
         await new Promise(resolve => setTimeout(resolve, 100));
         
         console.log(`Obtenidos ${pageIds.length} productos. Total acumulado: ${allIds.size}`);
         
       } catch (error) {
         console.error(`Error al obtener página de productos:`, error);
         hasMore = false; // Detener el bucle en caso de error
         break;
       }
     }
     
     return Array.from(allIds); // Convertir el Set a Array
   }
   
   /**
    * Consulta un lote de productos (hasta 20) en una sola llamada API.
    */
   async function fetchItemsBatch(accessToken: string, itemIds: string[]): Promise<any[]> {
     if (itemIds.length === 0) {
       return [];
     }
     
     // Preparar IDs separados por comas
     const idsParam = itemIds.join(',');
     
     const response = await fetch(
       `https://api.mercadolibre.com/items?ids=${idsParam}`,
       {
         headers: {
           'Authorization': `Bearer ${accessToken}`
         }
       }
     );
     
     if (!response.ok) {
       throw new Error(`Error al obtener lote de items: ${response.status} ${response.statusText}`);
     }
     
     const data = await response.json();

    
    
     // Filtrar solo los resultados exitosos y extraer los cuerpos
     return data
       .filter((result: any) => result.code === 200)
       .map((result: any) => result.body);
   }
   
   /**
    * Consulta un único producto en caso de error con el lote.
    */
   async function fetchSingleItem(accessToken: string, itemId: string): Promise<any> {
     const response = await fetch(
       `https://api.mercadolibre.com/items/${itemId}`,
       {
         headers: {
           'Authorization': `Bearer ${accessToken}`
         }
       }
     );
     
     if (!response.ok) {
       throw new Error(`Error al obtener item individual: ${response.status} ${response.statusText}`);
     }
     
     return response.json();
   }

   async function getProductsSalePrices(itemIds: string[], accessToken: string) {
    const priceDataMap: { [key: string]: any } = {};
    
    // Procesar en lotes más pequeños para evitar sobrecargar la API
    const batchSize = 20;
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);
      
      // Realizar consultas en paralelo para mayor eficiencia
      const pricePromises = batch.map(async (itemId: string) => {
        try {
          const response = await fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (response.ok) {
            const priceData = await response.json();
            return { itemId, priceData };
          }
          return { itemId, priceData: null };
        } catch (error) {
          console.error(`Error al obtener precio de venta para el ítem ${itemId}:`, error);
          return { itemId, priceData: null };
        }
      });
      
      const priceResults = await Promise.all(pricePromises);
      
      // Añadir resultados al mapa
      for (const result of priceResults) {
        priceDataMap[result.itemId] = result.priceData;
      }
    }
    
    return priceDataMap;
  }
  