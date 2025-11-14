// app/api/dietitian-gaps/route.ts

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
  daysSinceJoining?: number;
  // NEW: Commerce fields
  commerceTarget?: number;
  commerceAchieved?: number;
  commercePercentAchieved?: number;
  commerceConsecutiveZeroDays?: number;
}

export async function GET(request: Request) {
  try {
    // Fetch data from both sheets - extended range to include commerce columns (A to T)
    const [gapsData, keyMappingData] = await Promise.all([
      getSheetData('Dietitian Gaps!A2:T'), // Columns A to T (now includes commerce columns)
      getSheetData('Key Mapping!C2:C') // Column C only, starting from row 2
    ]);

    // Create a Set of names to exclude from Key Mapping sheet
    const excludedNames = new Set<string>();
    if (keyMappingData && keyMappingData.length > 0) {
      keyMappingData.forEach((row: string[]) => {
        const name = row[0]?.trim();
        if (name) {
          excludedNames.add(name.toLowerCase());
        }
      });
    }

    const dietitianGaps: DietitianGap[] = [];

    // Process each row in the gaps data
    for (let i = 0; i < gapsData.length; i++) {
      const row = gapsData[i];
      
      // Column mapping based on your requirements
      const dietitianName = row[1]?.trim(); // Column B
      const smName = row[8]?.trim(); // Column I
      const consecutiveZeroDays = parseNumber(row[11]); // Column L - Sales Zero Days
      const salesTarget = parseNumber(row[9]); // Column J - Sales Target
      const salesAchieved = parseNumber(row[10]); // Column K - Sales Achieved
      const percentAchieved = parseNumber(row[15]); // Column P - Sales Percent
      const daysSinceJoining = parseNumber(row[3]); // Column D - Days Since Joining
      
      // NEW: Commerce columns
      const commerceTarget = parseNumber(row[17]); // Column R - Commerce Target
      const commerceAchieved = parseNumber(row[18]); // Column S - Commerce Achieved
      const commerceConsecutiveZeroDays = parseNumber(row[19]); // Column T - Commerce Zero Days
      const commercePercentAchieved = commerceTarget > 0 ? (commerceAchieved / commerceTarget) * 100 : 0;

      // ✅ Exclusion conditions (OR)
      const excludeFromKeyMapping = dietitianName && excludedNames.has(dietitianName.toLowerCase());
      const excludeFlag = (row[12] || '').trim().toUpperCase(); // Column M
      const excludeFromColumnM = excludeFlag === 'YES';
      
      const shouldExcludeDietitian = excludeFromKeyMapping || excludeFromColumnM;

      // ✅ Additional condition - Column D (daysSinceJoining) must be >= 30
      const meetsDaysSinceJoiningCriteria = daysSinceJoining >= 30;

      // ✅ Include only if:
      // - Not excluded AND 
      // - daysSinceJoining >= 30
      // AND at least one of the revenue types has consecutiveZeroDays >= 3
      const hasSalesIssue = consecutiveZeroDays >= 3;
      const hasCommerceIssue = commerceConsecutiveZeroDays >= 3;
      const hasAnyIssue = hasSalesIssue || hasCommerceIssue;

      if (dietitianName && hasAnyIssue && !shouldExcludeDietitian && meetsDaysSinceJoiningCriteria) {
        dietitianGaps.push({
          dietitianName,
          smName: smName || 'Not Assigned',
          consecutiveZeroDays,
          salesTarget,
          salesAchieved,
          percentAchieved,
          daysSinceJoining,
          // Commerce data
          commerceTarget,
          commerceAchieved,
          commercePercentAchieved,
          commerceConsecutiveZeroDays
        });
      }
    }

    // Sort by highest consecutive zero days (either sales or commerce) descending, then dietitianName, then smName
    dietitianGaps.sort((a, b) => {
      const aMaxZeroDays = Math.max(a.consecutiveZeroDays, a.commerceConsecutiveZeroDays || 0);
      const bMaxZeroDays = Math.max(b.consecutiveZeroDays, b.commerceConsecutiveZeroDays || 0);
      
      if (bMaxZeroDays !== aMaxZeroDays) {
        return bMaxZeroDays - aMaxZeroDays;
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