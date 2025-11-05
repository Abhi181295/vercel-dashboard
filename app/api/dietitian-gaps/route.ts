// app/api/dietitian-gaps/route.ts

import { NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

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

function parseNumber(value: any): number {
  if (!value) return 0;
  const num = String(value).replace(/,/g, '');
  return isNaN(Number(num)) ? 0 : Number(num);
}

export interface DietitianGap {
  dietitianName: string;
  smName: string;
  consecutiveZeroDays: number;
  salesTarget: number;
  salesAchieved: number;
  percentAchieved: number;
}

export async function GET(request: Request) {
  try {
    // Fetch data from Dietitian Gaps sheet
    const gapsData = await getSheetData('Dietitian Gaps!A2:Q'); // Columns A to Q to cover all needed data

    const dietitianGaps: DietitianGap[] = [];

    // Process each row in the gaps data
    for (let i = 0; i < gapsData.length; i++) {
      const row = gapsData[i];
      
      // Column mapping based on your requirements
      const dietitianName = row[1]?.trim(); // Column B
      const smName = row[8]?.trim(); // Column I
      const consecutiveZeroDays = parseNumber(row[11]); // Column L
      const salesTarget = parseNumber(row[9]); // Column J
      const salesAchieved = parseNumber(row[10]); // Column K
      const percentAchieved = parseNumber(row[15]); // Column P

      // Only include dietitians with 3+ consecutive zero days
      if (dietitianName && consecutiveZeroDays >= 3) {
        dietitianGaps.push({
          dietitianName,
          smName: smName || 'Not Assigned',
          consecutiveZeroDays,
          salesTarget,
          salesAchieved,
          percentAchieved
        });
      }
    }

    // Sort by consecutiveZeroDays descending, then dietitianName, then smName
    dietitianGaps.sort((a, b) => {
      if (b.consecutiveZeroDays !== a.consecutiveZeroDays) {
        return b.consecutiveZeroDays - a.consecutiveZeroDays;
      }
      if (a.dietitianName !== b.dietitianName) {
        return a.dietitianName.localeCompare(b.dietitianName);
      }
      return a.smName.localeCompare(b.smName);
    });

    return NextResponse.json({ dietitianGaps });
  } catch (error) {
    console.error('Error in dietitian gaps API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dietitian gaps data from Google Sheets' },
      { status: 500 }
    );
  }
}
