import { getSheetsClient } from './googleSheetsClient';

const SPREADSHEET_ID = 'TU_SPREADSHEET_ID';
const SHEET_NAME = 'Items';

export async function syncItemToSheet(itemData: any) {
  const sheets = getSheetsClient();

  const values = [
    [
      itemData.item_id || '',
      itemData.last_updated || '',
      itemData.title || '',
      itemData.seller_id || '',
      itemData.category_id || '',
      itemData.status || '',
      itemData.regular_amount ?? '', // null-aware
      itemData.amount ?? '',
      itemData.permalink || '',
    ],
  ];

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:A`,
    });

    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex(([id]) => id === itemData.item_id);

    const range = rowIndex !== -1
      ? `${SHEET_NAME}!A${rowIndex + 2}`
      : `${SHEET_NAME}!A${rows.length + 2}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    console.log(`Google Sheet actualizado para item ${itemData.item_id}`);
  } catch (err) {
    console.error('Error actualizando Google Sheet:', err);
  }
}
