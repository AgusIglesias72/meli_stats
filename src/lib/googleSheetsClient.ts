// lib/googleSheetsClient.ts
import { google } from 'googleapis';

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

export function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes,
  });

  return google.sheets({ version: 'v4', auth });
}
