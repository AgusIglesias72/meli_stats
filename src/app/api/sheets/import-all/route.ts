// src/app/api/sheets/import-all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/googleSheetsClient';

export const maxDuration = 59; // 5 minutos para procesar grandes cantidades de datos

// Formatea una fecha al formato de Buenos Aires (GMT-3)
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
      
    // Obtener datos del cuerpo
        const { store_id } = await request.json();
    
    if (!store_id) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar que la tienda existe
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('store_id', store_id)
      .single();
      
    if (storeError || !storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Obtener todos los productos de la tienda
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('seller_id', store_id)
      .order('last_updated', { ascending: true })
      

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ error: 'Error fetching items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No items found to sync', 
        synced: 0 
      });
    }

    // Preparar los datos para la inserción masiva
    const SPREADSHEET_ID = '1uESNvCVtMssb56eop9FhisZPNLMPssUDdhonmXI_2b0';
    const SHEET_NAME = 'Items';
    
    // Primero, añadimos los encabezados
    const headers = [
      'ID',
      'Última Actualización',
      'Título',
      'ID Vendedor',
      'Categoría',
      'Estado',
      'Tipo de Listing',
      'Precio Regular',
      'Precio Final',
      'Modo de Envío',
      'Tipo Logístico',
      'Envío Gratis',
      'Cuotas',
      'Tarifa Total',
      'Porcentaje Tarifa',
      'Porcentaje MELI',
      'Tarifa Financiación',
      'Tarifa Fija',
      'Costo de Envío',
      'Tasa de Descuento Envío',
      'Monto Promocionado Envío',
      'ID Promoción',
      'Tipo de Campaña',
      'Cashback MELI %',
      'Porcentaje Vendedor',
      'URL',
      'SKU',
    ];
       
    try {
        const sheets = getSheetsClient();
        
        // Verificar si la hoja existe, si no existe la creamos
        const existingIdsMap = new Map();
        let lastRow = 1; // Por defecto empezamos después de los encabezados
        
        try {
          // Intentar leer la hoja
          const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:A`, // Solo leemos la columna de IDs
          });
          
          // Si hay datos, extraer los IDs existentes
          if (sheetData.data.values && sheetData.data.values.length > 0) {
            // La primera fila son los encabezados
            if (sheetData.data.values[0][0] !== 'MLA Producto') {
              // Si no hay encabezados, los añadimos
              await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                  values: [headers]
                }
              });
              lastRow = 1;
            } else {
              // Extraer los IDs existentes (saltando la fila de encabezados)
              for (let i = 1; i < sheetData.data.values.length; i++) {
                if (sheetData.data.values[i][0]) {
                  existingIdsMap.set(sheetData.data.values[i][0], i + 1); // i+1 es el número de fila en la hoja
                }
              }
              lastRow = sheetData.data.values.length;
            }
          } else {
            // La hoja está vacía, añadir encabezados
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_NAME}!A1`,
              valueInputOption: 'RAW',
              requestBody: {
                values: [headers]
              }
            });
            lastRow = 1;
          }
        } catch (err) {
          // Si la hoja no existe, crear una nueva
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
          
         
          lastRow = 1;
        }
        
        // Filtrar para obtener solo los items que no están en la hoja
        const newItems = items.filter(item => !existingIdsMap.has(item.item_id));
        
        if (newItems.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'All items are already in the sheet',
            total: items.length,
            synced: 0,
            existing: items.length
          });
        }
        
        // Preparar filas para los nuevos items
        const newRows = newItems.map(item => [
          item.item_id || '',
          formatToBuenosAires(item.last_updated) || '',
          item.title || '',
          item.seller_id || '',
          item.category_id || '',
          item.status || '',
          item.listing_type_id || '',
          item.regular_amount ?? '',
          item.amount ?? '',
          item.shipping_mode || '',
          item.shipping_logistic_type || '',
          item.free_shipping || '',
          item.installments_quantity || '',
          item.sale_fee_amount || '',
          item.percentage_fee || '',
          item.meli_percentage_fee || '',
          item.financing_add_on_fee || '',
          item.fixed_fee || '',
          item.shipping_list_cost || '',
          item.shipping_discount_rate || '',
          item.shipping_promoted_amount || '',
          item.promotion_id || '',
          item.campaign_type || '', 
          item.meli_percentage_cashback || '',
          item.seller_percentage || '',
          item.permalink || '',
          item.sku || '',
        ]);
        
        // Añadir las nuevas filas al final
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A${lastRow + 1}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: newRows
          }
        });
        
        return NextResponse.json({
          success: true,
          message: 'New items synced to Google Sheets',
          total: items.length,
          synced: newItems.length,
          existing: items.length - newItems.length
        });
        
      } catch (sheetError) {
        console.error('Error syncing to Google Sheets:', sheetError);
        return NextResponse.json({ 
          error: 'Error syncing to Google Sheets',
          message: sheetError instanceof Error ? sheetError.message : 'Unknown error' 
        }, { status: 500 });
      }
      
    } catch (error) {
      console.error('Error in sheets import-all:', error);
      return NextResponse.json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }