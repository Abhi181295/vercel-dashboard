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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const smName = searchParams.get('smName');
    const managerName = searchParams.get('managerName');
    const amName = searchParams.get('amName');
    const flapName = searchParams.get('flapName');
    const emName = searchParams.get('emName');
    const npsType = searchParams.get('type'); // 'high'

    // Fetch data directly from Google Sheets
    const qualityData = await getSheetData('Dietitian Quality!A2:Z');
    
    const records = [];

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

      // Filter by HIGH NPS type (8-10)
      let shouldInclude = false;
      if (npsType === 'high') {
        shouldInclude = npsScore >= 9 && npsScore <= 10;
      } else {
        shouldInclude = false;
      }

      if (!shouldInclude) {
        continue;
      }

      const record = {
        customerCode,
        dietitianName,
        subscriptionStartDate,
        emName: emNameValue || '',
        flapName: flapNameValue || '',
        amName: amNameValue || '',
        managerName: managerNameValue || '',
        smName: smNameValue,
        npsScore
      };

      records.push(record);
    }

    // Sort by NPS score descending (best first)
    records.sort((a: any, b: any) => b.npsScore - a.npsScore);

    return NextResponse.json({
      records: records,
      totalCount: records.length
    });

  } catch (error) {
    console.error('Error in High NPS issues API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch High NPS data' },
      { status: 500 }
    );
  }
}