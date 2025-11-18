// app/api/quality-records/route.ts

import { NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

export const revalidate = 300; // 5 minutes

const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is required');
}

const serviceAccountJSON = JSON.parse(serviceAccount);

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

async function getGoogleSheetsClient() {
  const client = new JWT({
    email: serviceAccountJSON.client_email,
    key: serviceAccountJSON.private_key,
    scopes: SCOPES,
  });

  return client;
}

async function getSheetData(range: string) {
  try {
    const client = await getGoogleSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is required');
    }

    const response = await client.request({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    });

    return (response.data as any).values || [];
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

export interface DietitianQualityRecord {
  customerCode: string;        // A
  dietitianName: string;       // C
  subscriptionStartDate: string; // D
  emName: string;              // H
  flapName: string;            // I
  amName: string;              // J
  managerName: string;         // K
  smName: string;              // L
  csatScore: number;           // X
  npsScore: number;            // Z
}

export interface FilterOptions {
  managers: string[];
  ams: string[];
  flaps: string[];
  ems: string[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const smName = searchParams.get('smName');
    const managerName = searchParams.get('managerName');
    const amName = searchParams.get('amName');
    const flapName = searchParams.get('flapName');
    const emName = searchParams.get('emName');

    // Fetch data from Dietitian Quality sheet
    const qualityData = await getSheetData('Dietitian Quality!A2:Z');
    
    const records: DietitianQualityRecord[] = [];
    const filterOptions: FilterOptions = {
      managers: [],
      ams: [],
      flaps: [],
      ems: []
    };

    const seenManagers = new Set<string>();
    const seenAms = new Set<string>();
    const seenFlaps = new Set<string>();
    const seenEms = new Set<string>();

    for (let i = 0; i < qualityData.length; i++) {
      const row = qualityData[i];
      
      const customerCode = row[0]?.trim();           // A
      const dietitianName = row[2]?.trim();          // C
      const subscriptionStartDate = row[3]?.trim();  // D
      const emNameValue = row[7]?.trim();            // H
      const flapNameValue = row[8]?.trim();          // I
      const amNameValue = row[9]?.trim();            // J
      const managerNameValue = row[10]?.trim();      // K
      const smNameValue = row[11]?.trim();           // L
      const csatScore = parseFloat(row[23]) || 0;    // X
      const npsScore = parseFloat(row[25]) || 0;     // Z

      // Skip rows with missing essential data
      if (!customerCode || !dietitianName || !smNameValue) {
        continue;
      }

      // Apply SM filter if provided
      if (smName && smNameValue.toLowerCase() !== smName.toLowerCase()) {
        continue;
      }

      // Apply additional filters if provided
      if (managerName && managerName !== '' && managerNameValue?.toLowerCase() !== managerName.toLowerCase()) {
        continue;
      }
      if (amName && amName !== '' && amNameValue?.toLowerCase() !== amName.toLowerCase()) {
        continue;
      }
      if (flapName && flapName !== '' && flapNameValue?.toLowerCase() !== flapName.toLowerCase()) {
        continue;
      }
      if (emName && emName !== '' && emNameValue?.toLowerCase() !== emName.toLowerCase()) {
        continue;
      }

      const record: DietitianQualityRecord = {
        customerCode,
        dietitianName,
        subscriptionStartDate,
        emName: emNameValue || '',
        flapName: flapNameValue || '',
        amName: amNameValue || '',
        managerName: managerNameValue || '',
        smName: smNameValue,
        csatScore,
        npsScore
      };

      records.push(record);

      // Build filter options from filtered data
      if (managerNameValue && !seenManagers.has(managerNameValue)) {
        seenManagers.add(managerNameValue);
        filterOptions.managers.push(managerNameValue);
      }
      if (amNameValue && !seenAms.has(amNameValue)) {
        seenAms.add(amNameValue);
        filterOptions.ams.push(amNameValue);
      }
      if (flapNameValue && !seenFlaps.has(flapNameValue)) {
        seenFlaps.add(flapNameValue);
        filterOptions.flaps.push(flapNameValue);
      }
      if (emNameValue && !seenEms.has(emNameValue)) {
        seenEms.add(emNameValue);
        filterOptions.ems.push(emNameValue);
      }
    }

    // Sort filter options alphabetically
    filterOptions.managers.sort();
    filterOptions.ams.sort();
    filterOptions.flaps.sort();
    filterOptions.ems.sort();

    return NextResponse.json({
      records,
      filterOptions,
      totalCount: records.length
    });

  } catch (error) {
    console.error('Error in quality-records API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Google Sheets' },
      { status: 500 }
    );
  }
}