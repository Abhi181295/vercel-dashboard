import { google } from 'googleapis';

export async function getGoogleSheetsClient() {
  try {
    const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT;
    
    if (!serviceAccount) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccount),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('Error initializing Google Sheets client:', error);
    throw error;
  }
}

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;