// app/api/data/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// change to your tab name & range
const SHEET_RANGE = 'Sheet1!A1:Z2000';

export async function GET() {
  try {
    if (!SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID env not set');
    }

    // parse service account from env (Vercel)
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT env not set (in Vercel)');
    }
    const creds = JSON.parse(raw);
    if (creds.private_key) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }

    const jwt = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    await jwt.authorize();

    const sheets = google.sheets({ version: 'v4', auth: jwt });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const values = resp.data.values || [];
    const [header, ...rows] = values;

    const data = rows.map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });

    return NextResponse.json({
      ok: true,
      rows: data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('API ERROR /api/data:', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'unknown' },
      { status: 500 }
    );
  }
}
