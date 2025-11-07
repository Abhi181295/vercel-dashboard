// app/api/key-mapping/route.ts

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

export async function GET() {
  try {
    // Fetch data from Key Mapping sheet, Column C only
    const keyMappingData = await getSheetData('Key Mapping!C2:C');

    // Extract names from Column C
    const excludedNames: string[] = [];
    if (keyMappingData && keyMappingData.length > 0) {
      keyMappingData.forEach((row: string[]) => {
        const name = row[0]?.trim();
        if (name) {
          excludedNames.push(name.toLowerCase());
        }
      });
    }

    return NextResponse.json({ excludedNames });
  } catch (error) {
    console.error('Error in key mapping API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch key mapping data from Google Sheets' },
      { status: 500 }
    );
  }
}