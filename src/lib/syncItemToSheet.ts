// lib/syncItemToSheet.ts
import { getSheetsClient } from './googleSheetsClient';

const SPREADSHEET_ID = '1uESNvCVtMssb56eop9FhisZPNLMPssUDdhonmXI_2b0';
const SHEET_NAME = 'Items'; // Nombre de la hoja/tab

export async function syncItemToSheet(itemData: any) {
  const sheets = getSheetsClient();

  const values = [
    [
      itemData.item_id,
      itemData.title,
      itemData.price,
      itemData.currency_id,
      itemData.available_quantity,
      itemData.status,
      itemData.permalink,
      itemData.last_updated,
    ]
  ];

  try {
    // Buscar si ya existe una fila con ese item_id
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:A`,
    });

    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex(([id]) => id === itemData.item_id);

    const range = rowIndex !== -1
      ? `${SHEET_NAME}!A${rowIndex + 2}` // Actualizar fila existente
      : `${SHEET_NAME}!A${rows.length + 2}`; // Agregar al final

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log(`Google Sheet actualizado para item ${itemData.item_id}`);
  } catch (err) {
    console.error('Error actualizando Google Sheet:', err);
  }
}
