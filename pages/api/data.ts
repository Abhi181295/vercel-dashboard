// pages/api/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// change to your sheet/tab range
const SHEET_RANGE = 'Sheet1!A1:Z2000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (!SHEET_ID) {
      return res.status(500).json({ ok: false, error: 'GOOGLE_SHEET_ID not set' });
    }

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) {
      return res
        .status(500)
        .json({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT not set' });
    }

    const creds = JSON.parse(raw);
    if (creds.private_key) {
      // fix \n
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

    res.status(200).json({
      ok: true,
      rows: data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('API ERROR /pages/api/data.ts', err);
    res.status(500).json({ ok: false, error: err?.message ?? 'unknown' });
  }
}
