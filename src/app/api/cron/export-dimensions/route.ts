// src/app/api/cron/export-dimensions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/googleSheetsClient';

export const maxDuration = 59; // Máximo tiempo de ejecución

// Palabras clave para identificar atributos de dimensiones
const DIMENSION_KEYWORDS = [
  // Dimensiones básicas en inglés
  'DEPTH', 'WIDTH', 'HEIGHT', 'LENGTH', 
  'DIAMETER', 'THICKNESS', 'SIZE', 'DIMENSION',
  // Dimensiones básicas en español
  'ALTO', 'ANCHO', 'LARGO', 'PROFUNDIDAD',
  'ESPESOR', 'DIAMETRO', 'TAMAÑO', 'MEDIDA',
  // Medidas adicionales
  'RADIUS', 'PERIMETER', 'VOLUME', 'WEIGHT',
  'PROFUNDO', 'GRUESO', 'PESO', 'CAPACIDAD',
  'CIRCUNFERENCIA', 'AREA', 'SUPERFICIE',
  // Variaciones comunes
  'DISTANCIA', 'EXTENSION', 'ALCANCE', 'APERTURA',
  'GROSOR', 'CALIBRE', 'TALLA', 'MEDIDAS',
  // Términos específicos
  'ENVERGADURA', 'ESLORA', 'MANGA', 'CALADO',
  'SPAN', 'GAUGE', 'BORE', 'STROKE'
];

// Función para verificar si un atributo es de dimensión
function isDimensionAttribute(attributeId: string): boolean {
  const upperCaseId = attributeId.toUpperCase();
  return DIMENSION_KEYWORDS.some(keyword => upperCaseId.includes(keyword));
}

// Función para extraer valor de dimensión formateado
function extractDimensionValue(attribute: any): string {
  if (!attribute.values || attribute.values.length === 0) return '';
  
  const value = attribute.values[0];
  
  // Si tiene estructura con número y unidad
  if (value.struct && value.struct.number !== undefined) {
    return `${value.struct.number} ${value.struct.unit || ''}`.trim();
  }
  
  // Si es solo un string pero value_name está presente
  if (attribute.value_name) {
    return attribute.value_name;
  }
  
  // Si es solo un string en value.name
  return value.name || '';
}

// Función para formatear fecha a Buenos Aires
function formatToBuenosAires(datetime: string) {
  const date = new Date(datetime);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('es-AR', options);
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value.padStart(2, '0') ?? '--';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verificar la autorización mediante clave secreta
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ') || authorization.split(' ')[1] !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    
    // Obtener todas las tiendas activas con tokens válidos
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, store_id, ml_user_id, access_token, token_expiry, name')
      .gt('token_expiry', new Date().toISOString())
      .order('store_id');

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      return NextResponse.json({ error: 'Error fetching stores' }, { status: 500 });
    }

    if (!stores || stores.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active stores found' 
      });
    }

    console.log(`Processing ${stores.length} stores for dimension export`);

    // Preparar el spreadsheet
    const SPREADSHEET_ID = process.env.DIMENSIONS_SPREADSHEET_ID || '1uESNvCVtMssb56eop9FhisZPNLMPssUDdhonmXI_2b0';
    const sheets = getSheetsClient();
    
    // Mapas globales para estadísticas
    const globalDimensionAttributes = new Set<string>();
    const attributeStats = new Map<string, { name: string, count: number, examples: Set<string> }>();
    const allAttributesFound = new Map<string, { name: string, count: number, isDimension: boolean }>();
    const allStoresData = [];
    
    // Procesar cada tienda
    for (const store of stores) {
      try {
        console.log(`Processing store: ${store.store_id} - ${store.name}`);
        
        // Obtener TODOS los productos de la tienda con paginación
        let allItems: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: items, error: itemsError, count } = await supabase
            .from('items')
            .select('item_id, title, sku, shipping_mode', { count: 'exact' })
            .eq('seller_id', store.ml_user_id)
            .order('title', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (itemsError) {
            console.error(`Error fetching items for store ${store.store_id}:`, itemsError);
            break;
          }

          if (items && items.length > 0) {
            allItems = allItems.concat(items);
            page++;
            
            // Verificar si hay más páginas
            hasMore = items.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        if (allItems.length === 0) {
          console.log(`No items found for store ${store.store_id}`);
          continue;
        }

        console.log(`Found ${allItems.length} items for store ${store.store_id} (fetched in ${page} pages)`);
        
        // Procesar items en lotes
        const batchSize = 20;
        const storeItemsData = [];
        let processedCount = 0;
        
        for (let i = 0; i < allItems.length; i += batchSize) {
          const batch = allItems.slice(i, i + batchSize);
          const itemIds = batch.map(item => item.item_id).join(',');
          processedCount += batch.length;
          
          // Log de progreso cada 100 items
          if (processedCount % 100 === 0) {
            console.log(`  Processing items ${processedCount}/${allItems.length} for store ${store.store_id}...`);
          }
          
          try {
            // Obtener detalles completos de los items
            const response = await fetch(`https://api.mercadolibre.com/items?ids=${itemIds}`, {
              headers: {
                'Authorization': `Bearer ${store.access_token}`
              }
            });

            if (!response.ok) {
              console.error(`Error fetching batch for store ${store.store_id}: ${response.status}`);
              continue;
            }

            const itemsData = await response.json();

            // Procesar cada item
            for (const itemResponse of itemsData) {
              if (itemResponse.code !== 200 || !itemResponse.body) continue;
              
              const itemData = itemResponse.body;
              const originalItem = batch.find(item => item.item_id === itemData.id);
              
              if (!originalItem) continue;

              // Extraer atributos de dimensiones
              const dimensionData: any = {
                store_id: store.ml_user_id,
                store_name: store.name || store.store_id,
                item_id: itemData.id,
                title: originalItem.title,
                sku: originalItem.sku || '',
                shipping_mode: itemData.shipping?.mode || originalItem.shipping_mode || ''
              };

              let hasDimensions = false;

              if (itemData.attributes && Array.isArray(itemData.attributes)) {
                for (const attr of itemData.attributes) {
                  // Registrar TODOS los atributos encontrados
                  if (!allAttributesFound.has(attr.id)) {
                    allAttributesFound.set(attr.id, {
                      name: attr.name || attr.id,
                      count: 0,
                      isDimension: isDimensionAttribute(attr.id)
                    });
                  }
                  allAttributesFound.get(attr.id)!.count++;
                  
                  // Procesar solo si es dimensión
                  if (isDimensionAttribute(attr.id)) {
                    hasDimensions = true;
                    const columnName = attr.id;
                    globalDimensionAttributes.add(columnName);
                    
                    // Actualizar estadísticas del atributo
                    if (!attributeStats.has(columnName)) {
                      attributeStats.set(columnName, {
                        name: attr.name || columnName,
                        count: 0,
                        examples: new Set<string>()
                      });
                    }
                    
                    const stats = attributeStats.get(columnName)!;
                    stats.count++;
                    
                    // Agregar ejemplo de valor (máximo 5 ejemplos únicos)
                    const value = extractDimensionValue(attr);
                    if (value && stats.examples.size < 5) {
                      stats.examples.add(value);
                    }
                    
                    dimensionData[columnName] = value;
                    dimensionData[`${columnName}_NAME`] = attr.name || '';
                  }
                }
              }

              // Solo agregar items que tienen al menos una dimensión
              if (hasDimensions) {
                storeItemsData.push(dimensionData);
              }
            }

            // Pausa entre lotes
            if (i + batchSize < allItems.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }

          } catch (error) {
            console.error(`Error processing batch for store ${store.store_id}:`, error);
            continue;
          }
        }
        
        // Agregar los datos de esta tienda al conjunto global
        allStoresData.push(...storeItemsData);
        console.log(`Processed ${storeItemsData.length} items with dimensions for store ${store.store_id} (${Math.round(storeItemsData.length / allItems.length * 100)}% had dimensions)`);
        
      } catch (error) {
        console.error(`Error processing store ${store.store_id}:`, error);
        continue;
      }
    }

    // Ahora exportar todo a Google Sheets
    if (allStoresData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items with dimensions found across all stores'
      });
    }

    // Ordenar los atributos de dimensiones
    const sortedAttributes = Array.from(globalDimensionAttributes).sort();
    
    // Crear los encabezados
    const headers = ['Tienda ID', 'Tienda Nombre', 'ID Producto', 'Título', 'SKU', 'Modo Envío'];
    
    // Agregar columnas para cada atributo de dimensión
    for (const attr of sortedAttributes) {
      headers.push(attr); // Valor
      headers.push(`${attr}_Descripción`); // Nombre descriptivo
    }
    
    headers.push('Última Actualización');

    // Nombre de la hoja con fecha
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const SHEET_NAME = `Dimensiones_${dateStr}`;

    try {
      // Verificar si la hoja existe
      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1`,
        });
        
        // Si existe, limpiarla
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A:ZZ`,
          requestBody: {}
        });
      } catch (err) {
        // Si no existe, crearla
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: SHEET_NAME
                }
              }
            }]
          }
        });
      }
      
      // Preparar las filas de datos
      const rows = [headers];
      
      for (const item of allStoresData) {
        const row = [
          item.store_id || '',
          item.store_name || '',
          item.item_id || '',
          item.title || '',
          item.sku || '',
          item.shipping_mode || ''
        ];
        
        // Agregar valores para cada atributo de dimensión
        for (const attr of sortedAttributes) {
          row.push(item[attr] || ''); // Valor
          row.push(item[`${attr}_NAME`] || ''); // Nombre descriptivo
        }
        
        row.push(formatToBuenosAires(new Date().toISOString()));
        rows.push(row);
      }
      
      // Insertar todos los datos
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows
        }
      });
      
      // Formatear la hoja principal
      const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_NAME);
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              // Congelar la primera fila
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: 'gridProperties.frozenRowCount'
              }
            },
            {
              // Auto-ajustar columnas
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: headers.length
                }
              }
            }
          ]
        }
      });
      
      // Crear hoja de estadísticas de atributos
      const STATS_SHEET_NAME = 'Atributos';
      
      // Verificar si existe la hoja de atributos
      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${STATS_SHEET_NAME}!A1`,
        });
        
        // Si existe, limpiarla
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${STATS_SHEET_NAME}!A:Z`,
          requestBody: {}
        });
      } catch (err) {
        // Si no existe, crearla
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: STATS_SHEET_NAME
                }
              }
            }]
          }
        });
      }
      
      // Preparar datos de estadísticas
      const statsHeaders = ['ID Atributo', 'Nombre', 'Cantidad de Productos', 'Porcentaje', 'Ejemplos de Valores'];
      const statsRows = [statsHeaders];
      
      // Ordenar atributos por cantidad (descendente)
      const sortedStats = Array.from(attributeStats.entries())
        .sort((a, b) => b[1].count - a[1].count);
      
      for (const [attrId, stats] of sortedStats) {
        const percentage = ((stats.count / allStoresData.length) * 100).toFixed(2);
        const examples = Array.from(stats.examples).join(' | ');
        
        statsRows.push([
          attrId,
          stats.name,
          stats.count.toString(),
          `${percentage}%`,
          examples
        ]);
      }
      
      // Agregar resumen al final
      statsRows.push([]); // Fila vacía
      statsRows.push(['RESUMEN', '', '', '', '']);
      statsRows.push(['Total de productos con dimensiones:', allStoresData.length.toString(), '', '', '']);
      statsRows.push(['Total de atributos únicos:', sortedStats.length.toString(), '', '', '']);
      statsRows.push(['Fecha de generación:', formatToBuenosAires(new Date().toISOString()), '', '', '']);
      
      // Agregar sección de atributos potenciales no capturados
      statsRows.push([]); // Fila vacía
      statsRows.push([]); // Fila vacía
      statsRows.push(['ATRIBUTOS NO CAPTURADOS (Posibles dimensiones perdidas)', '', '', '', '']);
      statsRows.push(['ID Atributo', 'Nombre', 'Cantidad de Productos', 'Sugerencia', '']);
      
      // Filtrar atributos no capturados y ordenar por cantidad
      const nonDimensionAttributes = Array.from(allAttributesFound.entries())
        .filter(([id, data]) => !data.isDimension)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50); // Top 50 atributos no capturados
      
      for (const [attrId, data] of nonDimensionAttributes) {
        // Sugerir si podría ser una dimensión basándose en el nombre
        let suggestion = '';
        const lowerName = (data.name || attrId).toLowerCase();
        
        if (lowerName.includes('medid') || lowerName.includes('dimen') || 
            lowerName.includes('tama') || lowerName.includes('size') ||
            lowerName.includes('largo') || lowerName.includes('ancho') ||
            lowerName.includes('alto') || lowerName.includes('profund') ||
            lowerName.includes('espes') || lowerName.includes('gros') ||
            lowerName.includes('diametr') || lowerName.includes('radio')) {
          suggestion = '⚠️ Posible dimensión';
        }
        
        statsRows.push([
          attrId,
          data.name,
          data.count.toString(),
          suggestion,
          ''
        ]);
      }
      
      // Insertar datos de estadísticas
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STATS_SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: statsRows
        }
      });
      
      // Formatear la hoja de estadísticas
      const statsSheetId = await getSheetId(sheets, SPREADSHEET_ID, STATS_SHEET_NAME);
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              // Congelar la primera fila
              updateSheetProperties: {
                properties: {
                  sheetId: statsSheetId,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: 'gridProperties.frozenRowCount'
              }
            },
            {
              // Auto-ajustar columnas
              autoResizeDimensions: {
                dimensions: {
                  sheetId: statsSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 5
                }
              }
            },
            {
              // Aplicar formato a la columna de porcentaje
              repeatCell: {
                range: {
                  sheetId: statsSheetId,
                  startRowIndex: 1,
                  endRowIndex: sortedStats.length + 1,
                  startColumnIndex: 3,
                  endColumnIndex: 4
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'PERCENT',
                      pattern: '0.00%'
                    }
                  }
                },
                fields: 'userEnteredFormat.numberFormat'
              }
            }
          ]
        }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Dimensions exported successfully',
        stats: {
          totalStores: stores.length,
          totalItemsWithDimensions: allStoresData.length,
          uniqueDimensionAttributes: sortedAttributes.length,
          sheetName: SHEET_NAME,
          statsSheetName: STATS_SHEET_NAME,
          spreadsheetId: SPREADSHEET_ID,
          topAttributes: sortedStats.slice(0, 5).map(([id, stats]) => ({
            id,
            name: stats.name,
            count: stats.count,
            percentage: ((stats.count / allStoresData.length) * 100).toFixed(2) + '%'
          }))
        }
      });
      
    } catch (sheetError) {
      console.error('Error writing to Google Sheets:', sheetError);
      return NextResponse.json({ 
        error: 'Error writing to Google Sheets',
        message: sheetError instanceof Error ? sheetError.message : 'Unknown error' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in cron dimensions export:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Función auxiliar para obtener el ID de una hoja
async function getSheetId(sheets: any, spreadsheetId: string, sheetName: string): Promise<number> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    
    const sheet = response.data.sheets.find((s: any) => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
  } catch (error) {
    console.error('Error getting sheet ID:', error);
    return 0;
  }
}