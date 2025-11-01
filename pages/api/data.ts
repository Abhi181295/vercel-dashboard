// pages/api/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// our sheets
const RAW_SERVICE_RANGE = `'Raw Data - Service'!A:Z`;
const ALL_MAPPING_RANGE = `'All Mapping'!A:T`;
// we don't know exact name, so we'll request both:
const MANAGER_TARGETS_RANGE_1 = `'Manager Targets'!A:E`; // plural
const MANAGER_TARGETS_RANGE_2 = `'Manager target'!A:E`;  // what you wrote

// SM list you gave
const SM_NAMES = [
  'Manpreet Kaur Sidhu',
  'Manpreet Kaur Dhillon',
  'Palak Thakur',
  'Nandini Soti',
  'Santdeep Singh',
];

// columns in All Mapping (A:T)
// A Emp Code
// B Employee Name
// C Department
// D Designation
// E ACC
// F FLAP
// G Assistant Manager
// H Manager
// I EM
// J FLAP Corrected
// K AM Corrected
// L Manager Corrected
// M Senior Manager
// N Sale Tar.
// O Yesterday
// P WTD
// Q MTD
// R Yesterday (2nd)
// S WTD (2nd)
// T MTD (2nd)
const ALL_MAPPING_COLS = {
  seniorManager: 12,      // M
  service_yesterday: 14,  // O
  service_wtd: 15,        // P
  service_mtd: 16,        // Q
};

function buildSmDashboard(
  allMappingSheet: string[][],
  managerTargetsSheet: string[][],
  dateKey: 'yesterday' | 'wtd' | 'mtd'
) {
  // managerTargetsSheet structure (your description):
  // A: SM
  // B: Service Target
  // C: Service Tgt Corrected  <-- we want this (like VLOOKUP col 3)
  // D: ACC
  // E: Commerce Tgt

  // skip header if present
  const mgrBody =
    managerTargetsSheet.length > 0 ? managerTargetsSheet.slice(1) : [];

  const mgrMap: Record<string, number> = {};
  mgrBody.forEach((row) => {
    const name = (row[0] || '').trim();
    const serviceTgtCorrected = row[2] ? Number(row[2]) : 0;
    if (name) {
      mgrMap[name] = serviceTgtCorrected; // still in rupees
    }
  });

  // split allMapping
  const [allMapHeader, ...allMapRows] = allMappingSheet;

  // pick the right service column
  let colIdx = ALL_MAPPING_COLS.service_yesterday;
  if (dateKey === 'wtd') colIdx = ALL_MAPPING_COLS.service_wtd;
  if (dateKey === 'mtd') colIdx = ALL_MAPPING_COLS.service_mtd;

  const results = SM_NAMES.map((smName) => {
    // 1) ACHIEVED = SUMIFS( All Mapping!O:O , All Mapping!M:M , smName ) / 100000
    let achievedRaw = 0;
    allMapRows.forEach((row) => {
      const rowSm = (row[ALL_MAPPING_COLS.seniorManager] || '').trim();
      if (rowSm === smName) {
        const val = row[colIdx] ? Number(row[colIdx]) : 0;
        achievedRaw += val;
      }
    });
    const achieved = achievedRaw / 100000;

    // 2) MONTH TARGET = VLOOKUP(name, ManagerTargets!A:C,3,0) / 100000
    const monthTargetRaw = mgrMap[smName] || 0;
    const monthTarget = monthTargetRaw / 100000;

    // 3) DAILY TARGET = L8 / 26
    const dailyTarget = monthTarget / 26;

    // what to show as Target depends on date
    let targetToShow = dailyTarget; // yesterday
    if (dateKey === 'mtd') {
      targetToShow = monthTarget;
    } else if (dateKey === 'wtd') {
      // quick approx — you can tell me real logic later
      targetToShow = monthTarget / 4;
    }

    const achievedPct =
      targetToShow > 0 ? (achieved / targetToShow) * 100 : 0;

    return {
      name: smName,
      achieved,
      target: Number(targetToShow.toFixed(4)),
      achievedPct: Number(achievedPct.toFixed(1)),
      rawMonthTarget: monthTarget,
    };
  });

  return results;
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

    // we ask for 4 ranges — some may be empty
    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SHEET_ID,
      ranges: [
        RAW_SERVICE_RANGE,
        ALL_MAPPING_RANGE,
        MANAGER_TARGETS_RANGE_1,
        MANAGER_TARGETS_RANGE_2,
      ],
    });

    const vr = resp.data.valueRanges || [];

    const rawServiceSheet = vr[0]?.values || [];
    const allMappingSheet = vr[1]?.values || [];

    // pick whichever manager targets sheet is non-empty
    const managerTargetsSheet =
      (vr[2]?.values && vr[2].values.length > 0
        ? vr[2].values
        : vr[3]?.values && vr[3].values.length > 0
          ? vr[3].values
          : []) || [];

    // which date?
    const dateParam = (req.query.date as string) || 'yesterday';
    const dateKey: 'yesterday' | 'wtd' | 'mtd' =
      dateParam === 'wtd' || dateParam === 'mtd' ? (dateParam as any) : 'yesterday';

    // build SM dashboard (will never crash even if managerTargetsSheet is empty)
    const smDashboard = buildSmDashboard(
      allMappingSheet,
      managerTargetsSheet,
      dateKey
    );

    // limit raw service for UI
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
      // 👇 this is what your frontend is trying to render
      smDashboard,
      debug: {
        rawServiceRangeRows: rawServiceSheet.length,
        allMappingRows: allMappingSheet.length,
        managerTargets1Rows: vr[2]?.values?.length || 0,
        managerTargets2Rows: vr[3]?.values?.length || 0,
      },
    });
  } catch (err: any) {
    console.error('API ERROR /api/data', err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message ?? 'unknown' });
  }
}
