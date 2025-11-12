// app/api/quality/route.ts

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

function isValidWeightLossValue(value: number): boolean {
  return value !== 0 && !isNaN(value); // Filter out 0 and NaN values
}

export interface QualityData {
  [name: string]: {
    avgWeeklyWeightLoss: number;
    weeklyOnTrackPct: number;
    monthlyOnTrackPct: number;
  };
}

export async function GET() {
  try {
    // Fetch data from Dietitian Quality sheet - columns A (Customer), G (ACC), H (EM), I (FLAP), J (AM), K (Manager), L (SM), AA (Weekly Weight Loss), AB (Monthly Weight Loss)
    const qualityData = await getSheetData('Dietitian Quality!A2:AB');

    const quality: QualityData = {};

    // Process each row in the quality data
    for (let i = 0; i < qualityData.length; i++) {
      const row = qualityData[i];
      
      // Extract ACC value (Column G, index 6)
      const accValue = parseNumber(row[6]);
      
      // Only process rows with ACC >= 30
      if (accValue < 30) continue;

      // Extract customer ID (Column A, index 0) - for unique counting
      const customerId = row[0]?.trim();
      
      // Extract weekly weight loss (Column AA, index 26)
      const weeklyWeightLoss = parseNumber(row[26]);
      
      // Extract monthly weight loss (Column AB, index 27)
      const monthlyWeightLoss = parseNumber(row[27]);

      // Filter out rows with empty/NA values for AA and AB
      const hasValidWeightLossData = isValidWeightLossValue(weeklyWeightLoss) || isValidWeightLossValue(monthlyWeightLoss);
      if (!hasValidWeightLossData) continue;

      // Extract names from different columns
      const emName = row[7]?.trim();        // Column H (EM)
      const flapName = row[8]?.trim();      // Column I (FLAP)
      const amName = row[9]?.trim();        // Column J (AM)
      const managerName = row[10]?.trim();  // Column K (Manager)
      const smName = row[11]?.trim();       // Column L (SM)

      // Helper function to add quality data for a name
      const addQualityForName = (name: string, role: string) => {
        if (!name) return;
        
        const key = `${role.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
        
        if (!quality[key]) {
          quality[key] = {
            avgWeeklyWeightLoss: 0,
            weeklyOnTrackPct: 0,
            monthlyOnTrackPct: 0
          };
        }
        
        // Initialize tracking objects if they don't exist
        if (!quality[key]._customers) quality[key]._customers = new Set();
        if (!quality[key]._weeklySum) quality[key]._weeklySum = 0;
        if (!quality[key]._weeklyCount) quality[key]._weeklyCount = 0;
        if (!quality[key]._weeklyOnTrackCount) quality[key]._weeklyOnTrackCount = 0;
        if (!quality[key]._monthlyOnTrackCount) quality[key]._monthlyOnTrackCount = 0;
        
        // Track unique customers
        if (customerId) {
          quality[key]._customers.add(customerId);
        }
        
        // Track weekly weight loss data for average - ONLY if valid
        if (isValidWeightLossValue(weeklyWeightLoss)) {
          quality[key]._weeklySum += weeklyWeightLoss;
          quality[key]._weeklyCount += 1;
        }
        
        // Track weekly on-track count (AA ≤ -0.5) - ONLY if valid
        if (isValidWeightLossValue(weeklyWeightLoss) && weeklyWeightLoss <= -0.5) {
          quality[key]._weeklyOnTrackCount += 1;
        }
        
        // Track monthly on-track count (AB ≤ -0.5) - ONLY if valid
        if (isValidWeightLossValue(monthlyWeightLoss) && monthlyWeightLoss <= -0.5) {
          quality[key]._monthlyOnTrackCount += 1;
        }
      };

      // Add quality data for each role found in the row
      if (emName) addQualityForName(emName, 'EM');
      if (flapName) addQualityForName(flapName, 'FLAP');
      if (amName) addQualityForName(amName, 'AM');
      if (managerName) addQualityForName(managerName, 'M');
      if (smName) addQualityForName(smName, 'SM');
    }

    // Calculate final metrics and clean up temporary properties
    Object.keys(quality).forEach(key => {
      const uniqueCustomers = quality[key]._customers?.size || 0;
      
      // Calculate average weekly weight loss - REMOVED ROUNDING
      if (quality[key]._weeklyCount && quality[key]._weeklyCount > 0) {
        quality[key].avgWeeklyWeightLoss = quality[key]._weeklySum / quality[key]._weeklyCount; // No rounding - let frontend format
      } else {
        quality[key].avgWeeklyWeightLoss = 0;
      }
      
      // Calculate % weekly on track
      if (uniqueCustomers > 0) {
        quality[key].weeklyOnTrackPct = Math.round((quality[key]._weeklyOnTrackCount / uniqueCustomers) * 1000) / 10; // Round to 1 decimal
      } else {
        quality[key].weeklyOnTrackPct = 0;
      }
      
      // Calculate % monthly on track
      if (uniqueCustomers > 0) {
        quality[key].monthlyOnTrackPct = Math.round((quality[key]._monthlyOnTrackCount / uniqueCustomers) * 1000) / 10; // Round to 1 decimal
      } else {
        quality[key].monthlyOnTrackPct = 0;
      }
      
      // Remove temporary properties
      delete quality[key]._customers;
      delete quality[key]._weeklySum;
      delete quality[key]._weeklyCount;
      delete quality[key]._weeklyOnTrackCount;
      delete quality[key]._monthlyOnTrackCount;
    });

    return NextResponse.json({ quality });
  } catch (error) {
    console.error('Error in quality API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quality data from Google Sheets' },
      { status: 500 }
    );
  }
}