import { getSheetsClient, getSheetsClientBackup } from './googleSheetsClient';
import { sheets_v4 } from 'googleapis';

const ITEMS_SPREADSHEET_ID = process.env.ITEMS_SPREADSHEET_ID;
const SHEET_NAME = 'Items';

// Cache para mantener índice de items en memoria
interface CacheEntry {
  row: number;
  timestamp: number;
  lastValues?: string[]; // Opcional: mantener últimos valores para comparación rápida
}

class SheetCache {
  private cache = new Map<string, CacheEntry>();
  private lastFullScan: number = 0;
  private totalRows: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly FULL_SCAN_INTERVAL = 30 * 60 * 1000; // 30 minutos

  isStale(): boolean {
    return Date.now() - this.lastFullScan > this.FULL_SCAN_INTERVAL;
  }

  get(itemId: string): CacheEntry | undefined {
    const entry = this.cache.get(itemId);
    if (!entry) return undefined;
    
    // Verificar si la entrada está expirada
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(itemId);
      return undefined;
    }
    
    return entry;
  }

  set(itemId: string, row: number, lastValues?: string[]): void {
    this.cache.set(itemId, {
      row,
      timestamp: Date.now(),
      lastValues
    });
  }

  setTotalRows(rows: number): void {
    this.totalRows = rows;
  }

  getTotalRows(): number {
    return this.totalRows;
  }

  updateLastFullScan(): void {
    this.lastFullScan = Date.now();
  }

  clear(): void {
    this.cache.clear();
    this.lastFullScan = 0;
    this.totalRows = 0;
  }
}

// Instancias de cache para cada cliente
const primaryCache = new SheetCache();
const backupCache = new SheetCache();

// Helper functions (mantener las mismas)
function formatToBuenosAires(datetime: string): string {
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

function itemToRowValues(itemData: any): string[] {
  return [
    itemData.item_id || '',
    formatToBuenosAires(itemData.last_updated) || '',
    itemData.title || '',
    itemData.seller_id || '',
    itemData.category_id || '',
    itemData.status || '',
    itemData.listing_type_id || '',
    itemData.regular_amount ?? '',
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

function hasChanges(existingRow: string[], newRow: string[]): boolean {
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

function normalizeForComparison(value: any): string {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value).trim();
  
  if (isMoneyValue(stringValue)) {
    return normalizeMoneyValue(stringValue);
  }
  
  if (stringValue.toLowerCase() === 'true' || stringValue === '1') return 'TRUE';
  if (stringValue.toLowerCase() === 'false' || stringValue === '0') return 'FALSE';
  
  return stringValue;
}

function isMoneyValue(value: string): boolean {
  return /^[\$]?[\d.,]+$/.test(value.replace(/\s/g, ''));
}

function normalizeMoneyValue(value: string): string {
  let cleaned = value.replace(/[\$\s]/g, '');
  
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }
  else if (cleaned.includes('.') && cleaned.split('.')[1]?.length > 2) {
    cleaned = cleaned.replace(/\./g, '');
  }
  
  const number = parseFloat(cleaned);
  return isNaN(number) ? '0' : number.toString();
}

/**
 * Búsqueda optimizada del item en la hoja
 */
async function findItemInSheet(
  sheets: sheets_v4.Sheets, 
  itemId: string, 
  cache: SheetCache
): Promise<{ row: number; exists: boolean; existingValues?: string[] }> {
  
  // 1. Verificar cache primero
  const cached = cache.get(itemId);
  if (cached) {
    console.log(`📍 Item ${itemId} found in cache at row ${cached.row}`);
    
    // Verificación rápida que la fila sigue siendo correcta
    try {
      const verifyResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${cached.row}:AA${cached.row}`,
      });
      
      const rowData = verifyResponse.data.values?.[0];
      if (rowData && rowData[0] === itemId) {
        return { row: cached.row, exists: true, existingValues: rowData };
      }
      
      console.log(`⚠️ Cache miss: Item ${itemId} no longer at row ${cached.row}`);
    } catch (error) {
      console.log(`⚠️ Error verifying cache for ${itemId}:`, error);
    }
  }

  // 2. Si el cache está muy desactualizado, hacer scan completo
  if (cache.isStale()) {
    console.log(`🔄 Cache stale, performing full scan...`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: ITEMS_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`, // Solo columna de IDs para el índice
    });
    
    const allIds = response.data.values || [];
    cache.setTotalRows(allIds.length);
    cache.updateLastFullScan();
    
    // Actualizar cache con todas las posiciones
    allIds.forEach((row, index) => {
      if (row[0] && index > 0) { // Saltar header
        cache.set(row[0], index + 1);
      }
    });
    
    // Verificar si encontramos nuestro item
    const foundIndex = allIds.findIndex(row => row[0] === itemId);
    if (foundIndex > 0) {
      // Obtener valores completos de la fila
      const rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${foundIndex + 1}:AA${foundIndex + 1}`,
      });
      
      return { 
        row: foundIndex + 1, 
        exists: true, 
        existingValues: rowResponse.data.values?.[0] 
      };
    }
    
    return { row: allIds.length + 1, exists: false };
  }

  // 3. Búsqueda por chunks (más eficiente que leer toda la hoja)
  const totalRows = cache.getTotalRows() || 10000; // Estimación inicial
  const CHUNK_SIZE = 1000;
  
  for (let start = 2; start <= totalRows; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, totalRows);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: ITEMS_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${start}:AA${end}`,
    });
    
    const chunk = response.data.values || [];
    const foundIndex = chunk.findIndex(row => row[0] === itemId);
    
    if (foundIndex !== -1) {
      const actualRow = start + foundIndex;
      cache.set(itemId, actualRow, chunk[foundIndex]);
      
      return { 
        row: actualRow, 
        exists: true, 
        existingValues: chunk[foundIndex] 
      };
    }
  }
  
  // No encontrado, será nueva fila
  return { row: totalRows + 1, exists: false };
}

/**
 * Función unificada con manejo inteligente de rate limits
 */
export async function syncItemToSheet(itemData: any, useBackup: boolean = false) {
  const sheets = useBackup ? getSheetsClientBackup() : getSheetsClient();
  const cache = useBackup ? backupCache : primaryCache;
  const clientName = useBackup ? 'backup' : 'primary';
  
  console.log(`🔄 Syncing item ${itemData.item_id} using ${clientName} client`);
  
  const newRowValues = itemToRowValues(itemData);
  let apiCalls = 0;

  try {
    // Búsqueda optimizada
    const searchResult = await findItemInSheet(sheets, itemData.item_id, cache);
    apiCalls += searchResult.exists ? 2 : Math.ceil(cache.getTotalRows() / 1000);
    
    let action: 'insert' | 'update' | 'skip';
    
    if (!searchResult.exists) {
      action = 'insert';
    } else {
      // Verificar cambios
      if (!hasChanges(searchResult.existingValues!, newRowValues)) {
        console.log(`⏭️ No changes detected for item ${itemData.item_id}, skipping update`);
        return { 
          success: true, 
          message: `No changes detected for item ${itemData.item_id}`,
          action: 'skipped',
          apiCalls
        };
      }
      action = 'update';
    }

    // Intentar escribir
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${searchResult.row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [newRowValues] },
      });
      apiCalls++;

      // Actualizar cache
      cache.set(itemData.item_id, searchResult.row, newRowValues);

      console.log(`✅ Item ${itemData.item_id} ${action}ed in row ${searchResult.row}`);
      return { 
        success: true, 
        message: `Item ${action}ed successfully`, 
        action,
        apiCalls
      };

    } catch (updateError: any) {
      // Manejo de expansión de hoja si es necesario
      if (updateError.message?.includes('exceeds grid limits') || 
          updateError.message?.includes('Unable to parse range') ||
          updateError.status === 400) {
        
        console.log(`📏 Sheet expansion needed for row ${searchResult.row}, expanding...`);
        
        // [Código de expansión igual al original]
        const sheetInfo = await sheets.spreadsheets.get({
          spreadsheetId: ITEMS_SPREADSHEET_ID,
          ranges: [SHEET_NAME],
          includeGridData: false,
        });
        apiCalls++;
        
        const sheet = sheetInfo.data.sheets?.[0];
        if (!sheet?.properties) {
          throw new Error('Could not get sheet properties');
        }
        
        const newRowCount = searchResult.row + 100;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: ITEMS_SPREADSHEET_ID,
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: {
                  sheetId: sheet.properties.sheetId,
                  gridProperties: { rowCount: newRowCount },
                },
                fields: 'gridProperties.rowCount',
              },
            }],
          },
        });
        apiCalls++;
        
        cache.setTotalRows(newRowCount);
        
        // Reintentar
        await sheets.spreadsheets.values.update({
          spreadsheetId: ITEMS_SPREADSHEET_ID,
          range: `${SHEET_NAME}!A${searchResult.row}`,
          valueInputOption: 'RAW',
          requestBody: { values: [newRowValues] },
        });
        apiCalls++;

        cache.set(itemData.item_id, searchResult.row, newRowValues);

        return { 
          success: true, 
          message: `Item ${action}ed successfully after sheet expansion`, 
          action,
          apiCalls
        };
      }
      
      // Si es error de rate limit y no estamos usando backup, reintentar con backup
      if (!useBackup && (updateError.code === 429 || updateError.message?.includes('quota'))) {
        console.log(`⚠️ Rate limit hit on primary client, switching to backup...`);
        return syncItemToSheet(itemData, true);
      }
      
      throw updateError;
    }
    
  } catch (err) {
    console.error(`❌ Error syncing item ${itemData.item_id}:`, err);
    
    // Si falla el primario por rate limit, intentar con backup
    if (!useBackup && err instanceof Error && 
        (err.message?.includes('quota') || (err as any).code === 429)) {
      console.log(`🔄 Retrying with backup client...`);
      return syncItemToSheet(itemData, true);
    }
    
    return { 
      success: false, 
      message: `Error: ${err}`,
      apiCalls
    };
  }
}

// Función para limpiar cache periódicamente (opcional)
export function clearSheetCache() {
  primaryCache.clear();
  backupCache.clear();
  console.log('🧹 Sheet cache cleared');
}

// Exportar la función anterior para compatibilidad
export { syncItemToSheet as syncItemToSheetBackup };