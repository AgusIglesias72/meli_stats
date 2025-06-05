import { getSheetsClient, getSheetsClientBackup } from './googleSheetsClient';

const ITEMS_SPREADSHEET_ID = process.env.ITEMS_SPREADSHEET_ID;
const SHEET_NAME = 'Items';

function formatToBuenosAires(datetime: string) {
    const date = new Date(datetime);
  
    // Convertimos a horario de Buenos Aires (GMT-3)
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

/**
 * Convierte itemData a array de valores para la hoja
 */
function itemToRowValues(itemData: any): string[] {
  return [
    itemData.item_id || '',
    formatToBuenosAires(itemData.last_updated) || '',
    itemData.title || '',
    itemData.seller_id || '',
    itemData.category_id || '',
    itemData.status || '',
    itemData.listing_type_id || '',
    itemData.regular_amount ?? '', // null-aware
    itemData.amount ?? '',
    itemData.shipping_mode || '',
    itemData.shipping_logistic_type || '',
    itemData.free_shipping || '',
    itemData.installments_quantity || '',
    itemData.sale_fee_amount || '',
    itemData.percentage_fee || '',
    itemData.meli_percentage_fee || '',
    itemData.financing_add_on_fee || '',
    itemData.fixed_fee || '',
    itemData.shipping_list_cost || '',
    itemData.shipping_discount_rate || '',
    itemData.shipping_promoted_amount || '',
    itemData.promotion_id || '',
    itemData.campaign_type || '', 
    itemData.meli_percentage_cashback || '',
    itemData.seller_percentage || '',
    itemData.permalink || '',
    itemData.sku || '',
  ];
}


/**
 * Compara dos filas para detectar cambios REALES
 * Excluye: timestamp (índice 1) y normaliza valores para comparación correcta
 */
function hasChanges(existingRow: string[], newRow: string[]): boolean {
  // Índices a comparar (saltear ID=0 y timestamp=1)
  const fieldsToCompare = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  
  for (const fieldIndex of fieldsToCompare) {
    const existing = normalizeForComparison(existingRow[fieldIndex]);
    const newValue = normalizeForComparison(newRow[fieldIndex]);
    
    if (existing !== newValue) {
      console.log(`🔄 Change detected in column ${fieldIndex}: "${existingRow[fieldIndex]}" → "${newRow[fieldIndex]}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * Normaliza valores para comparación consistente
 */
function normalizeForComparison(value: any): string {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value).trim();
  
  // Si es un número o string que representa dinero, normalizarlo
  if (isMoneyValue(stringValue)) {
    return normalizeMoneyValue(stringValue);
  }
  
  // Para boolean, normalizar a TRUE/FALSE
  if (stringValue.toLowerCase() === 'true' || stringValue === '1') return 'TRUE';
  if (stringValue.toLowerCase() === 'false' || stringValue === '0') return 'FALSE';
  
  return stringValue;
}

/**
 * Detecta si un valor es monetario
 */
function isMoneyValue(value: string): boolean {
  // Detectar formatos como: $20.890,00, 20890, 20890.50, etc.
  return /^[\$]?[\d.,]+$/.test(value.replace(/\s/g, ''));
}

/**
 * Normaliza valores monetarios para comparación
 */
function normalizeMoneyValue(value: string): string {
  // Remover símbolos de moneda y espacios
  let cleaned = value.replace(/[\$\s]/g, '');
  
  // Si tiene punto y coma (formato argentino: 20.890,50)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // 20.890,50 → 20890.50
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Si solo tiene coma (20890,50)
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // 20890,50 → 20890.50
    cleaned = cleaned.replace(',', '.');
  }
  // Si solo tiene punto pero más de 3 dígitos después (20.890)
  else if (cleaned.includes('.') && cleaned.split('.')[1]?.length > 2) {
    // Es separador de miles, remover
    cleaned = cleaned.replace(/\./g, '');
  }
  
  // Convertir a número y volver a string para normalizar
  const number = parseFloat(cleaned);
  return isNaN(number) ? '0' : number.toString();
}



export async function syncItemToSheet(itemData: any) {
  const sheets = getSheetsClient();
  const newRowValues = itemToRowValues(itemData);

  try {
    // UNA SOLA llamada paralela - sin batchGet
    const [valuesResponse, sheetResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:AA`,  // Todos los datos
      }),
      sheets.spreadsheets.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        ranges: [SHEET_NAME],
        includeGridData: false,
      })
    ]);

    const allData = valuesResponse.data.values || [];
    const sheetInfo = sheetResponse.data.sheets?.[0];
    
    if (!sheetInfo || !sheetInfo.properties) {
      throw new Error(`No se pudo obtener información de la hoja "${SHEET_NAME}"`);
    }

    // Buscar si el item existe (saltar header row si existe)
    const dataRows = allData.length > 0 && allData[0][0] === 'ID' ? allData.slice(1) : allData;
    const existingRowIndex = dataRows.findIndex(row => row[0] === itemData.item_id);
    
    let targetRow: number;
    let action: 'insert' | 'update' | 'skip';
    
    if (existingRowIndex === -1) {
      // Item no existe, insertar al final
      targetRow = allData.length + 1;
      action = 'insert';
    } else {
      // Item existe, verificar si hay cambios
      const existingRow = dataRows[existingRowIndex];
      
      if (!hasChanges(existingRow, newRowValues)) {
        console.log(`⏭️ No changes detected for item ${itemData.item_id}, skipping update`);
        return { 
          success: true, 
          message: `No changes detected for item ${itemData.item_id}`,
          action: 'skipped'
        };
      }
      
      // Hay cambios, actualizar
      // +1 por ser 1-indexed, +1 más si hay header
      targetRow = existingRowIndex + (allData.length > 0 && allData[0][0] === 'ID' ? 2 : 1);
      action = 'update';
    }

    // Verificar si necesitamos expandir la hoja
    const currentRows = sheetInfo.properties.gridProperties?.rowCount || 0;
    
    if (targetRow > currentRows) {
      console.log(`Expandiendo hoja: fila objetivo ${targetRow}, filas actuales ${currentRows}`);
      
      const newRowCount = targetRow + 100;
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetInfo.properties.sheetId,
                  gridProperties: {
                    rowCount: newRowCount,
                  },
                },
                fields: 'gridProperties.rowCount',
              },
            },
          ],
        },
      });
      
      console.log(`Hoja expandida a ${newRowCount} filas`);
    }

    // Actualizar la fila
    const range = `${SHEET_NAME}!A${targetRow}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: ITEMS_SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [newRowValues] },
    });

    const actionEmoji = action === 'insert' ? '➕' : '🔄';
    console.log(`${actionEmoji} Item ${itemData.item_id} ${action}ed in row ${targetRow}`);

    return { 
      success: true, 
      message: `Google Sheet actualizado para item ${itemData.item_id} en la fila ${targetRow}`,
      action 
    };

  } catch (err) {
    console.error(`❌ Error syncing item ${itemData.item_id}:`, err);
    return { 
      success: false, 
      message: `Error al actualizar Google Sheet para item ${itemData.item_id}: ${err}` 
    };
  }
}

export async function syncItemToSheetBackup(itemData: any) {
  const sheets = getSheetsClientBackup();
  const newRowValues = itemToRowValues(itemData);

  try {
    // UNA SOLA llamada paralela - sin batchGet
    const [valuesResponse, sheetResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:AA`,  // Todos los datos
      }),
      sheets.spreadsheets.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        ranges: [SHEET_NAME],
        includeGridData: false,
      })
    ]);

    const allData = valuesResponse.data.values || [];
    const sheetInfo = sheetResponse.data.sheets?.[0];
    
    if (!sheetInfo || !sheetInfo.properties) {
      throw new Error(`No se pudo obtener información de la hoja "${SHEET_NAME}"`);
    }

    // Buscar si el item existe (saltar header row si existe)
    const dataRows = allData.length > 0 && allData[0][0] === 'ID' ? allData.slice(1) : allData;
    const existingRowIndex = dataRows.findIndex(row => row[0] === itemData.item_id);
    
    let targetRow: number;
    let action: 'insert' | 'update' | 'skip';
    
    if (existingRowIndex === -1) {
      // Item no existe, insertar al final
      targetRow = allData.length + 1;
      action = 'insert';
    } else {
      // Item existe, verificar si hay cambios
      const existingRow = dataRows[existingRowIndex];
      
      if (!hasChanges(existingRow, newRowValues)) {
        console.log(`⏭️ No changes detected for item ${itemData.item_id}, skipping backup update`);
        return { 
          success: true, 
          message: `No changes detected for item ${itemData.item_id}`,
          action: 'skipped'
        };
      }
      
      // Hay cambios, actualizar
      targetRow = existingRowIndex + (allData.length > 0 && allData[0][0] === 'ID' ? 2 : 1);
      action = 'update';
    }

    // Verificar si necesitamos expandir la hoja
    const currentRows = sheetInfo.properties.gridProperties?.rowCount || 0;
    
    if (targetRow > currentRows) {
      console.log(`Expandiendo hoja backup: fila objetivo ${targetRow}, filas actuales ${currentRows}`);
      
      const newRowCount = targetRow + 100;
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetInfo.properties.sheetId,
                  gridProperties: {
                    rowCount: newRowCount,
                  },
                },
                fields: 'gridProperties.rowCount',
              },
            },
          ],
        },
      });
      
      console.log(`Hoja backup expandida a ${newRowCount} filas`);
    }

    // Actualizar la fila
    const range = `${SHEET_NAME}!A${targetRow}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: ITEMS_SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [newRowValues] },
    });

    const actionEmoji = action === 'insert' ? '➕' : '🔄';
    console.log(`${actionEmoji} [BACKUP] Item ${itemData.item_id} ${action}ed in row ${targetRow}`);

    return { 
      success: true, 
      message: `Backup Google Sheet actualizado para item ${itemData.item_id} en la fila ${targetRow}`,
      action 
    };

  } catch (err) {
    console.error(`❌ Error syncing item to backup ${itemData.item_id}:`, err);
    return { 
      success: false, 
      message: `Error al actualizar el Backup para item ${itemData.item_id}: ${err}` 
    };
  }
}
  

