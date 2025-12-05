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
  const num = String(value).replace(/,/g, '').replace('%', '');
  return isNaN(Number(num)) ? 0 : Number(num);
}

export async function GET() {
  try {
    // Fetch data from Dietitian ScoreCard sheet (columns B, E, L, M, P, S, T, U, V, W, X, AG)
    const scorecardData = await getSheetData('Dietitian ScoreCard!A2:AG');
    
    const formattedData = scorecardData.map((row: any[]) => {
      // Map columns according to the specification
      return {
        overallScore: parseNumber(row[32]),     // AG (33rd column, 0-indexed 32)
        employeeName: row[1]?.trim() || '',    // B
        acc: parseNumber(row[4]),              // E
        manager: row[11]?.trim() || '',        // L
        seniorManager: row[12]?.trim() || '',  // M
        salesAchieved: parseNumber(row[15]),   // P
        commerceAchieved: parseNumber(row[18]), // S
        numberOfLeads: parseNumber(row[19]),   // T
        totalTalktime: parseNumber(row[20]),   // U
        avgNPS: parseNumber(row[21]),          // V
        avgLatestCSAT: parseNumber(row[22]),   // W
        conversionPercent: parseNumber(row[23]), // X
      };
    }).filter((item: any) => 
      // Filter out empty rows and rows without essential data
      item.employeeName && item.seniorManager
    );

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error in dietitian scorecard API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dietitian scorecard data from Google Sheets' },
      { status: 500 }
    );
  }
}