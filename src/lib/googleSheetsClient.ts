// googleSheetsClient.ts
import { google, sheets_v4 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library'; // Necesario para tipar correctamente el cliente de autenticación

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

// Variables para almacenar los clientes cacheados con sus tipos
let authClient: GoogleAuth | null = null;
let sheetsApiClient: sheets_v4.Sheets | null = null;

let authClientBackup: GoogleAuth | null = null;
let sheetsApiClientBackup: sheets_v4.Sheets | null = null;

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

/**
 * Carga y valida las credenciales de las variables de entorno.
 * Lanza un error si alguna variable requerida no está presente.
 */
function loadCredentialsFromEnv(emailEnvVar: string, keyEnvVar: string): ServiceAccountCredentials {
  const client_email = process.env[emailEnvVar];
  const private_key_raw = process.env[keyEnvVar];

  if (!client_email) {
    throw new Error(`Error: La variable de entorno '${emailEnvVar}' es requerida y no está definida.`);
  }
  if (!private_key_raw) {
    throw new Error(`Error: La variable de entorno '${keyEnvVar}' es requerida y no está definida.`);
  }

  return {
    client_email,
    private_key: private_key_raw.replace(/\\n/g, '\n'), // Reemplaza los literales \n por saltos de línea reales
  };
}

export function getSheetsClient(): sheets_v4.Sheets {
  // Si el cliente de autenticación no existe, créalo
  if (!authClient) {
    const credentials = loadCredentialsFromEnv('GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY');
    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });
  }

  // Si el cliente de la API de Sheets no existe, créalo usando el cliente de autenticación
  // En este punto, 'authClient' está garantizado que no es null.
  if (!sheetsApiClient) {
    sheetsApiClient = google.sheets({ version: 'v4', auth: authClient });
  }

  // En este punto, 'sheetsApiClient' está garantizado que no es null.
  return sheetsApiClient;
}

export function getSheetsClientBackup(): sheets_v4.Sheets {
  // Si el cliente de autenticación de respaldo no existe, créalo
  if (!authClientBackup) {
    const credentials = loadCredentialsFromEnv('GOOGLE_CLIENT_EMAIL_BACKUP', 'GOOGLE_PRIVATE_KEY_BACKUP');
    authClientBackup = new google.auth.GoogleAuth({
      credentials,
      scopes,
    });
  }

  // Si el cliente de la API de Sheets de respaldo no existe, créalo
  // En este punto, 'authClientBackup' está garantizado que no es null.
  if (!sheetsApiClientBackup) {
    sheetsApiClientBackup = google.sheets({ version: 'v4', auth: authClientBackup });
  }

  // En este punto, 'sheetsApiClientBackup' está garantizado que no es null.
  return sheetsApiClientBackup;
}