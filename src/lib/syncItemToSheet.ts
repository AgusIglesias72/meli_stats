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

// PASO 1: Solo cambiar a Promise.all (sin detección de cambios)
export async function syncItemToSheet(itemData: any) {
  const sheets = getSheetsClient();

  const values = [
    [
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
    ],
  ];

  try {
    // OPTIMIZACIÓN 1: Usar Promise.all para hacer llamadas en paralelo
    const [existing, sheetInfo] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:A`,
      }),
      sheets.spreadsheets.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        ranges: [SHEET_NAME],
        includeGridData: false,
      })
    ]);

    // Obtener información de la hoja
    const sheet = sheetInfo.data.sheets?.[0];
    if (!sheet || !sheet.properties) {
      throw new Error(`No se pudo obtener información de la hoja "${SHEET_NAME}"`);
    }

    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex(([id]) => id === itemData.item_id);

    // Determinar la fila donde se escribirá (existente o nueva)
    const targetRow = rowIndex !== -1 ? rowIndex + 2 : rows.length + 2;
    const range = `${SHEET_NAME}!A${targetRow}`;

    // Número actual de filas en la hoja
    const currentRows = sheet.properties.gridProperties?.rowCount || 0;

    // Comprobar si necesitamos expandir la hoja
    if (targetRow >= currentRows) {
      console.log(`Expandiendo hoja: fila objetivo ${targetRow}, filas actuales ${currentRows}`);
      
      // Expandir la hoja añadiendo 100 filas más (margen de seguridad)
      const newRowCount = targetRow + 100;
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheet.properties.sheetId,
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

    // Ahora podemos proceder con seguridad a escribir los datos
    await sheets.spreadsheets.values.update({
      spreadsheetId: ITEMS_SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    const action = rowIndex !== -1 ? 'updated' : 'inserted';
    console.log(`✅ Item ${itemData.item_id} ${action} in row ${targetRow}`);

    return { success: true, message: `Google Sheet actualizado para item ${itemData.item_id} en la fila ${targetRow}` };
  } catch (err) {
    return { success: false, message: `Error al actualizar Google Sheet para item ${itemData.item_id}: ${err}` };
  }
}

export async function syncItemToSheetBackup(itemData: any) {
  const sheets = getSheetsClientBackup();

  const values = [
    [
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
    ],
  ];

  try {
    // OPTIMIZACIÓN 1: Usar Promise.all para hacer llamadas en paralelo
    const [existing, sheetInfo] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:A`,
      }),
      sheets.spreadsheets.get({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        ranges: [SHEET_NAME],
        includeGridData: false,
      })
    ]);

    // Obtener información de la hoja
    const sheet = sheetInfo.data.sheets?.[0];
    if (!sheet || !sheet.properties) {
      throw new Error(`No se pudo obtener información de la hoja "${SHEET_NAME}"`);
    }

    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex(([id]) => id === itemData.item_id);

    // Determinar la fila donde se escribirá (existente o nueva)
    const targetRow = rowIndex !== -1 ? rowIndex + 2 : rows.length + 2;
    const range = `${SHEET_NAME}!A${targetRow}`;

    // Número actual de filas en la hoja
    const currentRows = sheet.properties.gridProperties?.rowCount || 0;

    // Comprobar si necesitamos expandir la hoja
    if (targetRow >= currentRows) {
      console.log(`Expandiendo hoja backup: fila objetivo ${targetRow}, filas actuales ${currentRows}`);
      
      const newRowCount = targetRow + 100;
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ITEMS_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheet.properties.sheetId,
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

    await sheets.spreadsheets.values.update({
      spreadsheetId: ITEMS_SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    const action = rowIndex !== -1 ? 'updated' : 'inserted';
    console.log(`✅ [BACKUP] Item ${itemData.item_id} ${action} in row ${targetRow}`);

    return { success: true, message: `Google Sheet actualizado para item ${itemData.item_id} en la fila ${targetRow}` };
  } catch (err) {
    return { success: false, message: `Error al actualizar el Backup para item ${itemData.item_id}: ${err}` };
  }
}