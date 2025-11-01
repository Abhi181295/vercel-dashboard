// pages/api/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// 3 real sheets
const RAW_SERVICE_RANGE = `'Raw Data - Service'!A:Z`;
const ALL_MAPPING_RANGE = `'All Mapping'!A:T`;
const MANAGER_TARGETS_RANGE = `'Manager Targets'!A:E`;

// SMs to show
const SM_NAMES = [
  'Manpreet Kaur Sidhu',
  'Manpreet Kaur Dhillon',
  'Palak Thakur',
  'Nandini Soti',
  'Santdeep Singh',
];

// columns in All Mapping
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
  // manager targets: A:SM, B:Service Target, C:Service Tgt Corrected, D:ACC, E:Commerce Tgt
  const mgrBody =
    managerTargetsSheet.length > 0 ? managerTargetsSheet.slice(1) : [];

  // make lookup: name -> monthTargetRaw
  const mgrMap: Record<string, number> = {};
  mgrBody.forEach((row) => {
    const name = (row[0] || '').trim();
    const serviceTgtCorrected = row[2] ? Number(row[2]) : 0;
    if (name) {
      mgrMap[name] = serviceTgtCorrected; // still in rupees
    }
  });

  const [_, ...allMapRows] = allMappingSheet;

  // pick correct service column
  let colIdx = ALL_MAPPING_COLS.service_yesterday;
  if (dateKey === 'wtd') colIdx = ALL_MAPPING_COLS.service_wtd;
  if (dateKey === 'mtd') colIdx = ALL_MAPPING_COLS.service_mtd;

  return SM_NAMES.map((smName) => {
    // 1) ACHIEVED = SUMIFS('All Mapping'!O:O, 'All Mapping'!M:M, smName)/100000
    let achievedRaw = 0;
    allMapRows.forEach((row) => {
      const rowSm = (row[ALL_MAPPING_COLS.seniorManager] || '').trim();
      if (rowSm === smName) {
        const val = row[colIdx] ? Number(row[colIdx]) : 0;
        achievedRaw += val;
      }
    });
    const achieved = achievedRaw / 100000;

    // 2) MONTH TARGET = VLOOKUP(smName, 'Manager Targets'!A:C, 3, 0)/100000
    const monthTargetRaw = mgrMap[smName] || 0;
    const monthTarget = monthTargetRaw / 100000;

    // 3) DAILY TARGET = monthTarget / 26
    const dailyTarget = monthTarget / 26;

    // which target to show
    let targetToShow = dailyTarget; // yesterday
    if (dateKey === 'mtd') {
      targetToShow = monthTarget;
    } else if (dateKey === 'wtd') {
      // rough week split; we can refine
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

    // just 3 ranges now
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
      smDashboard,
      debug: {
        rawServiceRows: rawServiceSheet.length,
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
