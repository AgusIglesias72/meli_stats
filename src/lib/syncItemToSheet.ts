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
