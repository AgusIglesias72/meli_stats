import { google } from 'googleapis';

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

export function getSheetsClient() {
  const credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes,
  });

  return google.sheets({ version: 'v4', auth });
}
