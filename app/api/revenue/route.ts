import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// --- Read the service account key from the local file ----------------
const serviceAccountPath = path.resolve('app', 'api', 'service-account.json'); // Adjusted path based on your directory structure
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

// --- helpers to normalize the private key coming from env ----------------
function looksLikePem(s: string) {
  return /BEGIN [A-Z ]*PRIVATE KEY/.test(s);
}

function tryBase64(s: string) {
  try {
    const buf = Buffer.from(s, 'base64');
    // If it decodes to readable PEM, great; otherwise throw.
    const txt = buf.toString('utf8');
    if (looksLikePem(txt)) return txt;
  } catch {}
  return null;
}

/** Accepts raw (with real newlines), JSON-escaped (\n), or base64; returns PEM. */
function normalizePrivateKey(raw: string): string {
  let k = raw.trim();

  // If it looks like JSON-escaped, turn \n into real newlines
  if (k.includes('\\n') && !k.includes('\n')) {
    k = k.replace(/\\n/g, '\n');
  }

  // If after that it still doesn't look like PEM, try base64 decode
  if (!looksLikePem(k)) {
    const decoded = tryBase64(k);
    if (decoded) k = decoded;
  }

  // Final guard
  if (!looksLikePem(k)) {
    throw new Error('Service account private_key is not a valid PEM');
  }
  return k;
}

// ------------------ types for our response (unchanged) -------------------
type Metric = { achieved: number; target: number; pct: number };
type Block = { y: Metric; w: Metric; m: Metric };
type Leaf = { id: string; name: string; role: 'AM' | 'FLAP'; service: Block; commerce: Block; };
type Manager = { id: string; name: string; role: 'M'; service: Block; commerce: Block; children: Leaf[]; };
type SM = { id: string; name: string; role: 'SM'; service: Block; commerce: Block; children: Manager[]; };

function num(x: any): number {
  if (x === null || x === undefined) return 0;
  const s = String(x).replace(/[, ]/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function pct(a: number, t: number) { return t ? Math.round((a / t) * 100) : 0; }

function mkBlock(): Block {
  return { y: { achieved: 0, target: 0, pct: 0 }, w: { achieved: 0, target: 0, pct: 0 }, m: { achieved: 0, target: 0, pct: 0 } };
}

function add(b: Block, y: number, w: number, m: number, t: number) {
  b.y.achieved += y; b.w.achieved += w; b.m.achieved += m;
  b.y.target += t;   b.w.target += t;   b.m.target += t;
}

function finalize(b: Block) { b.y.pct = pct(b.y.achieved, b.y.target); b.w.pct = pct(b.w.achieved, b.w.target); b.m.pct = pct(b.m.achieved, b.m.target); }

// --------------------------------- GET -----------------------------------
export async function GET() {
  try {
    const saRaw = serviceAccount;
    const sheetId = process.env.GOOGLE_SHEET_ID || '';
    if (!saRaw || !sheetId) {
      return NextResponse.json({ ok: false, error: 'Missing GOOGLE_SERVICE_ACCOUNT or GOOGLE_SHEET_ID' }, { status: 500 });
    }

    const clientEmail = saRaw.client_email;
    const privateKey = saRaw.private_key ? normalizePrivateKey(saRaw.private_key) : '';

    if (!clientEmail || !privateKey) {
      return NextResponse.json({ ok: false, error: 'client_email/private_key missing or invalid in GOOGLE_SERVICE_ACCOUNT' }, { status: 500 });
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = `'Dietitian Revenue'!A:T`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    const rows = resp.data.values || [];
    if (!rows.length) return NextResponse.json({ ok: true, lastFetched: new Date().toISOString(), data: [] });

    const targetsRange = `'Targets'!A:T`; // Fetch data from the 'Targets' sheet
    const targetsResp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: targetsRange });
    const targetsRows = targetsResp.data.values || [];

    const smMap = new Map<string, SM>();
    const mgrMap = new Map<string, Manager>(); // key: sm|mgr
    const leafMap = new Map<string, Leaf>();   // key: sm|mgr|role|name

    function getSM(name: string): SM {
      const key = name || 'UNKNOWN_SM';
      if (!smMap.has(key)) {
        smMap.set(key, { id: `sm:${key}`, name: key, role: 'SM', service: mkBlock(), commerce: mkBlock(), children: [] });
      }
      return smMap.get(key)!;
    }

    function getMgr(smKey: string, name: string): Manager {
      const key = `${smKey}|${name || 'UNKNOWN_M'}`;
      if (!mgrMap.has(key)) {
        const mgr: Manager = { id: `m:${key}`, name: name || '—', role: 'M', service: mkBlock(), commerce: mkBlock(), children: [] };
        mgrMap.set(key, mgr);
        getSM(smKey).children.push(mgr);
      }
      return mgrMap.get(key)!;
    }

    function getLeaf(smKey: string, mgrKey: string, role: 'AM' | 'FLAP', name: string): Leaf {
      const key = `${smKey}|${mgrKey}|${role}|${name || 'UNKNOWN'}`;
      if (!leafMap.has(key)) {
        const leaf: Leaf = { id: `leaf:${key}`, name: name || '—', role, service: mkBlock(), commerce: mkBlock() };
        leafMap.set(key, leaf);
        getMgr(smKey, mgrKey).children.push(leaf);
      }
      return leafMap.get(key)!;
    }

    for (const r of rows) {
      const row = Array.from({ length: 20 }).map((_, i) => (r[i] ?? ''));

      const smName = String(row[12] || '').trim();
      const mgrName = String(row[11] || '').trim();
      const amCorr  = String(row[10] || '').trim();
      const flapCorr= String(row[9]  || '').trim();

      const saleTar = num(row[13]);
      const yService = num(row[14]), wService = num(row[15]), mService = num(row[16]);
      const yCommerce = num(row[17]), wCommerce = num(row[18]), mCommerce = num(row[19]);

      const sm = getSM(smName);
      add(sm.service, yService, wService, mService, saleTar);
      add(sm.commerce, yCommerce, wCommerce, mCommerce, saleTar);

      const mgr = getMgr(smName, mgrName);
      add(mgr.service, yService, wService, mService, saleTar);
      add(mgr.commerce, yCommerce, wCommerce, mCommerce, saleTar);

      if (amCorr) {
        const leaf = getLeaf(smName, mgrName, 'AM', amCorr);
        add(leaf.service, yService, wService, mService, saleTar);
        add(leaf.commerce, yCommerce, wCommerce, mCommerce, saleTar);
      } else if (flapCorr) {
        const leaf = getLeaf(smName, mgrName, 'FLAP', flapCorr);
        add(leaf.service, yService, wService, mService, saleTar);
        add(leaf.commerce, yCommerce, wCommerce, mCommerce, saleTar);
      }
    }

    // Apply Targets logic (adjusted according to new requirements)
    for (const targetRow of targetsRows) {
      const target = Array.from({ length: 5 }).map((_, i) => (targetRow[i] ?? ''));

      const smName = String(target[0] || '').trim();
      const serviceTarget = num(target[1]); // Service Target for SM
      const commerceTarget = num(target[4]); // Commerce Target for SM

      const sm = getSM(smName);
      sm.service.target = serviceTarget;  // Set the service target
      sm.commerce.target = commerceTarget; // Set the commerce target
    }

    for (const sm of smMap.values()) {
      finalize(sm.service); finalize(sm.commerce);
      for (const m of sm.children) {
        finalize(m.service); finalize(m.commerce);
        m.children.forEach((l) => { finalize(l.service); finalize(l.commerce); });
        m.children.sort((a, b) => a.name.localeCompare(b.name));
      }
      sm.children.sort((a, b) => a.name.localeCompare(b.name));
    }

    const result = Array.from(smMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, lastFetched: new Date().toISOString(), data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
