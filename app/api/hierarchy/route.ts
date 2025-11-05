// app/api/hierarchy/route.ts

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

    return response.data.values || [];
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

export interface User {
  id: string;
  name: string;
  role: 'SM' | 'M' | 'AM' | 'FLAP';
  managerId?: string;
  smId?: string;
  targets: {
    service: number;
    commerce: number;
  };
  scaledTargets?: {
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
  achieved?: {
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

function generateId(name: string, role: string): string {
  return `${role.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function parseNumber(value: any): number {
  if (!value) return 0;
  const num = String(value).replace(/,/g, '');
  return isNaN(Number(num)) ? 0 : Number(num);
}

// Function to calculate scaled targets
function calculateScaledTargets(monthlyTarget: number, type: 'service' | 'commerce') {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // YTD: Divide monthly target by 26 (same as sheet)
  const ytdTarget = monthlyTarget / 26;
  
  // Get days in current month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  // Calculate start of week (Monday)
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Set to Monday of current week
  let daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Calculate days between start of week and yesterday (inclusive)
  const timeDiff = yesterday.getTime() - startOfWeek.getTime();
  const daysInWeek = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
  
  // WTD = yesterday target * days between start of week and yesterday (inclusive)
  const wtdTarget = ytdTarget * daysInWeek;
  
  // Calculate start of month (first day of current month)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Calculate days from start of month to yesterday (inclusive)
  const monthTimeDiff = yesterday.getTime() - startOfMonth.getTime();
  const daysInMonthPassed = Math.floor(monthTimeDiff / (1000 * 3600 * 24)) + 1;
  
  // MTD = (monthly target / days in month) * days passed
  const mtdTarget = (monthlyTarget / daysInMonth) * daysInMonthPassed;
  
  return {
    y: Math.round(ytdTarget),
    w: Math.round(wtdTarget),
    m: Math.round(mtdTarget)
  };
}

// Function to fetch revenue data
async function getRevenueData(): Promise<{ [key: string]: any }> {
  try {
    const revenueData = await getSheetData('Dietitian Revenue!A2:T');
    const revenue: { [key: string]: any } = {};

    for (let i = 0; i < revenueData.length; i++) {
      const row = revenueData[i];
      
      const flapName = row[9]?.trim();
      const amName = row[10]?.trim();
      const managerName = row[11]?.trim();
      const smName = row[12]?.trim();
      
      const serviceY = parseNumber(row[14]);
      const serviceW = parseNumber(row[15]);
      const serviceM = parseNumber(row[16]);
      const commerceY = parseNumber(row[17]);
      const commerceW = parseNumber(row[18]);
      const commerceM = parseNumber(row[19]);

      const addRevenueForName = (name: string, role: string) => {
        if (!name) return;
        
        const key = generateId(name, role);
        
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

      if (flapName) addRevenueForName(flapName, 'FLAP');
      if (amName) addRevenueForName(amName, 'AM');
      if (managerName) addRevenueForName(managerName, 'M');
      if (smName) addRevenueForName(smName, 'SM');
    }

    return revenue;
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return {};
  }
}

export async function GET() {
  try {
    // Fetch data from Targets sheet
    const targetsData = await getSheetData('Targets!A2:T');
    // Fetch revenue data
    const revenueData = await getRevenueData();

    const sms: User[] = [];
    const managers: User[] = [];
    const ams: User[] = [];

    const seenUsers = new Map<string, User>();

    function createUser(
      name: string, 
      role: 'SM' | 'M' | 'AM' | 'FLAP', 
      serviceTarget: number = 0, 
      commerceTarget: number = 0,
      managerId?: string, 
      smId?: string
    ): User {
      const id = generateId(name, role);
      
      if (seenUsers.has(id)) {
        return seenUsers.get(id)!;
      }

      // Calculate scaled targets
      const scaledServiceTargets = calculateScaledTargets(serviceTarget, 'service');
      const scaledCommerceTargets = calculateScaledTargets(commerceTarget, 'commerce');

      const user: User = { 
        id, 
        name, 
        role, 
        managerId, 
        smId,
        targets: {
          service: serviceTarget,
          commerce: commerceTarget
        },
        scaledTargets: {
          service: scaledServiceTargets,
          commerce: scaledCommerceTargets
        },
        achieved: revenueData[id] || {
          service: { y: 0, w: 0, m: 0 },
          commerce: { y: 0, w: 0, m: 0 }
        }
      };
      seenUsers.set(id, user);
      return user;
    }

    // Process SM data (Columns A, B, E)
    for (let i = 0; i < targetsData.length; i++) {
      const row = targetsData[i];
      const smName = row[0]?.trim();
      const serviceTarget = parseNumber(row[2]);
      const commerceTarget = parseNumber(row[4]);
      
      if (smName && smName !== '') {
        const sm = createUser(smName, 'SM', serviceTarget, commerceTarget);
        if (!sms.find(s => s.id === sm.id)) {
          sms.push(sm);
        }
      }
    }

    // Process Manager data (Columns G, H, I, K)
    for (let i = 0; i < targetsData.length; i++) {
      const row = targetsData[i];
      const managerName = row[6]?.trim();
      const serviceTarget = parseNumber(row[7]);
      const reportingSM = row[8]?.trim();
      const commerceTarget = parseNumber(row[10]);
      
      if (managerName && managerName !== '') {
        const reportingSMObj = sms.find(sm => 
          sm.name.toLowerCase() === reportingSM?.toLowerCase()
        );
        
        const manager = createUser(
          managerName, 
          'M', 
          serviceTarget, 
          commerceTarget,
          undefined, 
          reportingSMObj?.id
        );
        if (!managers.find(m => m.id === manager.id)) {
          managers.push(manager);
        }
      }
    }

    // Process AM/FLAP data (Columns M, N, O, P, R, T)
    for (let i = 0; i < targetsData.length; i++) {
      const row = targetsData[i];
      const amName = row[12]?.trim();
      const serviceTarget = parseNumber(row[13]);
      const reportingManager = row[14]?.trim();
      const reportingSM = row[15]?.trim();
      const roleFromSheet = row[17]?.trim();
      const commerceTarget = parseNumber(row[19]);
      
      if (amName && amName !== '') {
        const role = (roleFromSheet === 'FLAP' ? 'FLAP' : 'AM') as 'AM' | 'FLAP';
        
        const reportingSMObj = sms.find(sm => 
          sm.name.toLowerCase() === reportingSM?.toLowerCase()
        );
        
        let reportingManagerObj: User | undefined;
        if (reportingManager && reportingManager !== '') {
          reportingManagerObj = managers.find(m => 
            m.name.toLowerCase() === reportingManager?.toLowerCase()
          );
        }

        const am = createUser(
          amName, 
          role, 
          serviceTarget, 
          commerceTarget,
          reportingManagerObj?.id, 
          reportingSMObj?.id
        );
        
        if (!ams.find(a => a.id === am.id)) {
          ams.push(am);
        }
      }
    }

    return NextResponse.json({ sms, managers, ams });
  } catch (error) {
    console.error('Error in hierarchy API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Google Sheets' },
      { status: 500 }
    );
  }
}