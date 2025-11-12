//app/api/customer-rating/route.ts

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

export interface CustomerRatingData {
  [name: string]: {
    ytdAvgCSAT: number;
    wtdAvgCSAT: number;
    latestCSAT: number;
    ytdAvgNPS: number;
    mtdAvgNPS: number;
  };
}

export async function GET() {
  try {
    // Fetch data from Dietitian Quality sheet - columns A (Customer), G (ACC), H (EM), I (FLAP), J (AM), K (Manager), L (SM), V (YTD CSAT), W (WTD CSAT), X (Latest CSAT), Y (YTD NPS), Z (MTD NPS)
    const qualityData = await getSheetData('Dietitian Quality!A2:Z');

    const customerRating: CustomerRatingData = {};

    // Process each row in the quality data
    for (let i = 0; i < qualityData.length; i++) {
      const row = qualityData[i];
      
      // Extract ACC value (Column G, index 6) and filter for ACC >= 30
      const accValue = parseNumber(row[6]);
      if (accValue < 30) continue;

      // Extract customer rating metrics
      const ytdCSAT = parseNumber(row[21]); // V
      const wtdCSAT = parseNumber(row[22]); // W
      const latestCSAT = parseNumber(row[23]); // X
      const ytdNPS = parseNumber(row[24]); // Y
      const mtdNPS = parseNumber(row[25]); // Z

      // Filter out rows with all blank/NA customer rating values
      const hasValidCustomerRating = ytdCSAT > 0 || wtdCSAT > 0 || latestCSAT > 0 || ytdNPS > 0 || mtdNPS > 0;
      if (!hasValidCustomerRating) continue;

      // Extract names from different columns
      const emName = row[7]?.trim();        // Column H (EM)
      const flapName = row[8]?.trim();      // Column I (FLAP)
      const amName = row[9]?.trim();        // Column J (AM)
      const managerName = row[10]?.trim();  // Column K (Manager)
      const smName = row[11]?.trim();       // Column L (SM)

      // Helper function to add customer rating data for a name
      const addCustomerRatingForName = (name: string, role: string) => {
        if (!name) return;
        
        const key = `${role.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
        
        if (!customerRating[key]) {
          customerRating[key] = {
            ytdAvgCSAT: 0,
            wtdAvgCSAT: 0,
            latestCSAT: 0,
            ytdAvgNPS: 0,
            mtdAvgNPS: 0
          };
          
          // Initialize tracking objects
          customerRating[key]._ytdCSATSum = 0;
          customerRating[key]._ytdCSATCount = 0;
          customerRating[key]._wtdCSATSum = 0;
          customerRating[key]._wtdCSATCount = 0;
          customerRating[key]._latestCSATSum = 0;
          customerRating[key]._latestCSATCount = 0;
          customerRating[key]._ytdNPSSum = 0;
          customerRating[key]._ytdNPSCount = 0;
          customerRating[key]._mtdNPSSum = 0;
          customerRating[key]._mtdNPSCount = 0;
        }
        
        // CUSTOMER RATING METRICS (with ACC >= 30 filter already applied)
        // YTD CSAT (Column V)
        if (ytdCSAT > 0) {
          customerRating[key]._ytdCSATSum += ytdCSAT;
          customerRating[key]._ytdCSATCount += 1;
        }
        
        // WTD CSAT (Column W)
        if (wtdCSAT > 0) {
          customerRating[key]._wtdCSATSum += wtdCSAT;
          customerRating[key]._wtdCSATCount += 1;
        }
        
        // Latest CSAT (Column X) - Calculate average like others
        if (latestCSAT > 0) {
          customerRating[key]._latestCSATSum += latestCSAT;
          customerRating[key]._latestCSATCount += 1;
        }
        
        // YTD NPS (Column Y)
        if (ytdNPS > 0) {
          customerRating[key]._ytdNPSSum += ytdNPS;
          customerRating[key]._ytdNPSCount += 1;
        }
        
        // MTD NPS (Column Z)
        if (mtdNPS > 0) {
          customerRating[key]._mtdNPSSum += mtdNPS;
          customerRating[key]._mtdNPSCount += 1;
        }
      };

      // Add customer rating data for each role found in the row
      if (emName) addCustomerRatingForName(emName, 'EM');
      if (flapName) addCustomerRatingForName(flapName, 'FLAP');
      if (amName) addCustomerRatingForName(amName, 'AM');
      if (managerName) addCustomerRatingForName(managerName, 'M');
      if (smName) addCustomerRatingForName(smName, 'SM');
    }

    // Calculate final metrics and clean up temporary properties
    Object.keys(customerRating).forEach(key => {
      const item = customerRating[key];
      
      // Calculate YTD Avg CSAT
      if (item._ytdCSATCount && item._ytdCSATCount > 0) {
        item.ytdAvgCSAT = Math.round((item._ytdCSATSum / item._ytdCSATCount) * 10) / 10;
      }
      
      // Calculate WTD Avg CSAT
      if (item._wtdCSATCount && item._wtdCSATCount > 0) {
        item.wtdAvgCSAT = Math.round((item._wtdCSATSum / item._wtdCSATCount) * 10) / 10;
      }
      
      // Calculate Latest CSAT Average
      if (item._latestCSATCount && item._latestCSATCount > 0) {
        item.latestCSAT = Math.round((item._latestCSATSum / item._latestCSATCount) * 10) / 10;
      }
      
      // Calculate YTD Avg NPS
      if (item._ytdNPSCount && item._ytdNPSCount > 0) {
        item.ytdAvgNPS = Math.round((item._ytdNPSSum / item._ytdNPSCount) * 10) / 10;
      }
      
      // Calculate MTD Avg NPS
      if (item._mtdNPSCount && item._mtdNPSCount > 0) {
        item.mtdAvgNPS = Math.round((item._mtdNPSSum / item._mtdNPSCount) * 10) / 10;
      }
      
      // Remove temporary properties
      delete item._ytdCSATSum;
      delete item._ytdCSATCount;
      delete item._wtdCSATSum;
      delete item._wtdCSATCount;
      delete item._latestCSATSum;
      delete item._latestCSATCount;
      delete item._ytdNPSSum;
      delete item._ytdNPSCount;
      delete item._mtdNPSSum;
      delete item._mtdNPSCount;
    });

    return NextResponse.json({ customerRating });
  } catch (error) {
    console.error('Error in customer rating API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer rating data from Google Sheets' },
      { status: 500 }
    );
  }
}