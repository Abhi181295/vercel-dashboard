// pages/api/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// your actual tab
const SHEET_RANGE = `'Raw Data - Service'!A:Z`;

// small helper to set CORS headers
function setCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // handle preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(200).end();
  }

  try {
    setCors(res);

    if (!SHEET_ID) {
      return res
        .status(500)
        .json({ ok: false, error: 'GOOGLE_SHEET_ID env not set' });
    }

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) {
      return res
        .status(500)
        .json({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT env not set' });
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

    // support ?limit=...
    const limitParam = req.query.limit ? Number(req.query.limit) : null;
    const limitedRows =
      limitParam && !Number.isNaN(limitParam)
        ? rows.slice(0, limitParam)
        : rows;

    const data = limitedRows.map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });

    return res.status(200).json({
      ok: true,
      rows: data,
      totalRows: rows.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('API ERROR /api/data', err);
    setCors(res);
    return res
      .status(500)
      .json({ ok: false, error: err?.message ?? 'unknown' });
  }
}
