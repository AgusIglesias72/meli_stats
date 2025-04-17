import { getSheetsClient } from './googleSheetsClient';

const SPREADSHEET_ID = '1uESNvCVtMssb56eop9FhisZPNLMPssUDdhonmXI_2b0';
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
    ],
  ];

  try {
    // Primero, verificar las dimensiones actuales de la hoja para poder expandirla si es necesario
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [SHEET_NAME],
      includeGridData: false,
    });

    // Obtener información de la hoja
    const sheet = sheetInfo.data.sheets?.[0];
    if (!sheet || !sheet.properties) {
      throw new Error(`No se pudo obtener información de la hoja "${SHEET_NAME}"`);
    }

    // Verificar si el item ya existe para actualizarlo
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:A`,
    });

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
        spreadsheetId: SPREADSHEET_ID,
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
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    console.log(`Google Sheet actualizado para item ${itemData.item_id} en la fila ${targetRow}`);
  } catch (err) {
    console.error('Error actualizando Google Sheet:', err);
    throw err; // Re-lanzar el error para manejarlo en el siguiente nivel
  }
}