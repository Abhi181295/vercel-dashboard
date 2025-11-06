// app/api/revenue/route.ts

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

function parseNumber(value: any): number {
  if (!value) return 0;
  // Remove commas and convert to number
  const num = String(value).replace(/,/g, '');
  return isNaN(Number(num)) ? 0 : Number(num);
}

export interface RevenueData {
  [name: string]: {
    service: {
      y: number;
      w: number;
      m: number;
    };
    commerce: {
      y: number;
      w: number;
      m: number;
    };
  };
}

export async function GET() {
  try {
    // Fetch data from Dietitian Revenue sheet
    const revenueData = await getSheetData('Dietitian Revenue!A2:T');

    const revenue: RevenueData = {};

    // Process each row in the revenue data
    for (let i = 0; i < revenueData.length; i++) {
      const row = revenueData[i];
      
      // Extract names from different columns
      const emName = row[8]?.trim();        // Column I (EM) — NEW
      const flapName = row[9]?.trim();      // Column J
      const amName = row[10]?.trim();       // Column K
      const managerName = row[11]?.trim();  // Column L
      const smName = row[12]?.trim();       // Column M
      
      // Extract achieved amounts
      const serviceY = parseNumber(row[14]);  // Column O
      const serviceW = parseNumber(row[15]);  // Column P
      const serviceM = parseNumber(row[16]);  // Column Q
      const commerceY = parseNumber(row[17]); // Column R
      const commerceW = parseNumber(row[18]); // Column S
      const commerceM = parseNumber(row[19]); // Column T

      // Helper function to add revenue data for a name
      const addRevenueForName = (name: string, role: string) => {
        if (!name) return;
        
        const key = `${role.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
        
        if (!revenue[key]) {
          revenue[key] = {
            service: { y: 0, w: 0, m: 0 },
            commerce: { y: 0, w: 0, m: 0 }
          };
        }
        
        revenue[key].service.y += serviceY;
        revenue[key].service.w += serviceW;
        revenue[key].service.m += serviceM;
        revenue[key].commerce.y += commerceY;
        revenue[key].commerce.w += commerceW;
        revenue[key].commerce.m += commerceM;
      };

      // Add revenue for each role found in the row
      if (emName) addRevenueForName(emName, 'EM');      // NEW
      if (flapName) addRevenueForName(flapName, 'FLAP');
      if (amName) addRevenueForName(amName, 'AM');
      if (managerName) addRevenueForName(managerName, 'M');
      if (smName) addRevenueForName(smName, 'SM');
    }

    return NextResponse.json({ revenue });
  } catch (error) {
    console.error('Error in revenue API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data from Google Sheets' },
      { status: 500 }
    );
  }
}
