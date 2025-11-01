// pages/api/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// sheet ranges
const RAW_SERVICE_RANGE = `'Raw Data - Service'!A:Z`;
const ALL_MAPPING_RANGE = `'All Mapping'!A:T`;
const MANAGER_TARGETS_RANGE = `'Manager Targets'!A:E`;

// SMs you want
const SM_NAMES = [
  'Manpreet Kaur Sidhu',
  'Manpreet Kaur Dhillon',
  'Palak Thakur',
  'Nandini Soti',
  'Santdeep Singh',
];

// column indexes in All Mapping (0-based)
const ALL_MAPPING_COLS = {
  seniorManager: 12,      // M
  yesterday: 14,          // O
  wtd: 15,                // P
  mtd: 16,                // Q
};

// helpers
function normName(s: any): string {
  return (s ?? '').toString().trim().toLowerCase();
}

function toNum(x: any): number {
  if (x == null) return 0;
  const s = x.toString().replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function lakhs(n: number): number {
  // divide by 1,00,000 and show 1 decimal
  return Number((n / 100000).toFixed(1));
}

function buildSmDashboard(
  allMapping: string[][],
  managerTargets: string[][],
  dateKey: 'yesterday' | 'wtd' | 'mtd'
) {
  // --- 1) build lookup from Manager Targets ---
  // structure:
  // A: SM
  // B: Service Target
  // C: Service Tgt Corrected  <-- use THIS
  const mgrBody = managerTargets.length > 0 ? managerTargets.slice(1) : [];

  const mgrMap: Record<string, number> = {};
  for (const row of mgrBody) {
    const nameNorm = normName(row[0]);
    const serviceTgtCorrected = toNum(row[2]); // col C
    if (nameNorm) {
      mgrMap[nameNorm] = serviceTgtCorrected; // still in rupees
    }
  }

  // --- 2) pick the correct column in All Mapping ---
  let colIdx = ALL_MAPPING_COLS.yesterday;
  if (dateKey === 'wtd') colIdx = ALL_MAPPING_COLS.wtd;
  if (dateKey === 'mtd') colIdx = ALL_MAPPING_COLS.mtd;

  // skip header in All Mapping
  const [, ...allRows] = allMapping;

  // --- 3) build rows for each SM ---
  const out = SM_NAMES.map((sm) => {
    const smNorm = normName(sm);

    // ACHIEVED = SUMIFS(All Mapping!O:O, All Mapping!M:M, SM) / 100000
    let achievedRaw = 0;
    for (const row of allRows) {
      const rowSmNorm = normName(row[ALL_MAPPING_COLS.seniorManager]);
      if (rowSmNorm === smNorm) {
        const val = toNum(row[colIdx]);
        achievedRaw += val;
      }
    }
    const achievedLakhs = lakhs(achievedRaw);

    // MONTH TARGET = VLOOKUP(SM, 'Manager Targets'!A:C, 3, 0) / 100000
    const monthTargetRaw = mgrMap[smNorm] ?? 0;
    const monthTargetLakhs = lakhs(monthTargetRaw);

    // DAILY TARGET = monthTarget / 26
    const dailyTargetLakhs = Number((monthTargetLakhs / 26).toFixed(1));

    // which target to show
    let targetToShow = dailyTargetLakhs; // yesterday
    if (dateKey === 'mtd') {
      targetToShow = monthTargetLakhs;
    } else if (dateKey === 'wtd') {
      // you can change this later to actual week logic
      targetToShow = Number((monthTargetLakhs / 4).toFixed(1));
    }

    const achievedPct =
      targetToShow > 0
        ? Number(((achievedLakhs / targetToShow) * 100).toFixed(1))
        : 0;

    return {
      name: sm,
      achieved: achievedLakhs,
      target: targetToShow,
      achievedPct,
      monthTarget: monthTargetLakhs,
    };
  });

  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!SHEET_ID) {
      return res
        .status(500)
        .json({ ok: false, error: 'GOOGLE_SHEET_ID env not set' });
    }

    const rawCreds = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!rawCreds) {
      return res
        .status(500)
        .json({ ok: false, error: 'GOOGLE_SERVICE_ACCOUNT env not set' });
    }

    const creds = JSON.parse(rawCreds);
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

    // get all 3 sheets in one call
    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: [RAW_SERVICE_RANGE, ALL_MAPPING_RANGE, MANAGER_TARGETS_RANGE],
    });

    const vr = resp.data.valueRanges || [];
    const rawServiceSheet = vr[0]?.values || [];
    const allMappingSheet = vr[1]?.values || [];
    const managerTargetsSheet = vr[2]?.values || [];

    // date param
    const dateParam = (req.query.date as string) || 'yesterday';
    const dateKey: 'yesterday' | 'wtd' | 'mtd' =
      dateParam === 'wtd' || dateParam === 'mtd' ? (dateParam as any) : 'yesterday';

    const smDashboard = buildSmDashboard(
      allMappingSheet,
      managerTargetsSheet,
      dateKey
    );

    // raw service (limit for UI)
    const [, ...rawRows] = rawServiceSheet;
    const limitParam = req.query.limit ? Number(req.query.limit) : null;
    const limitedRaw =
      limitParam && !Number.isNaN(limitParam)
        ? rawRows.slice(0, limitParam)
        : rawRows;

    return res.status(200).json({
      ok: true,
      dateKey,
      fetchedAt: new Date().toISOString(),
      rawService: {
        headers: rawServiceSheet[0] || [],
        rows: limitedRaw,
        totalRows: rawRows.length,
      },
      smDashboard,
      debug: {
        allMappingRows: allMappingSheet.length,
        managerTargetsRows: managerTargetsSheet.length,
      },
    });
  } catch (err: any) {
    console.error('API ERROR /api/data', err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message ?? 'unknown' });
  }
}
