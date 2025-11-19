// app/api/funnel/route.ts - CORRECTED UNIQUE CALLS COLUMNS

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

function safeDivide(numerator: number, denominator: number): number {
  return denominator !== 0 ? numerator / denominator : 0;
}

function calculateDays() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Calculate days for WTD
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  let daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const timeDiff = yesterday.getTime() - startOfWeek.getTime();
  const daysWTD = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
  
  // Calculate days for MTD
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTimeDiff = yesterday.getTime() - startOfMonth.getTime();
  const daysMTD = Math.floor(monthTimeDiff / (1000 * 3600 * 24)) + 1;
  
  return { daysWTD, daysMTD };
}

export interface FunnelData {
  teamSize: number;
  rawTallies: {
    ytd: {
      calls: number;
      uniqueCalls: number;
      connected: number;
      uniqueConnected: number;
      talktime: number;
      talktimeCounselling: number;
      talktimeFollowup: number;
      counsellingConnected: number;
      followupConnected: number;
      leads: number;
      totalLinks: number;
      salesLinks: number;
      conv: number;
      salesConv: number;
      referralLeads: number;
      reactiveLeads: number;
      renewalLeads: number;
      extensionLeads: number;
    };
    wtd: {
      calls: number;
      uniqueCalls: number;
      connected: number;
      uniqueConnected: number;
      talktime: number;
      talktimeCounselling: number;
      talktimeFollowup: number;
      counsellingConnected: number;
      followupConnected: number;
      leads: number;
      totalLinks: number;
      salesLinks: number;
      conv: number;
      salesConv: number;
      referralLeads: number;
      reactiveLeads: number;
      renewalLeads: number;
      extensionLeads: number;
    };
    mtd: {
      calls: number;
      uniqueCalls: number;
      connected: number;
      uniqueConnected: number;
      talktime: number;
      talktimeCounselling: number;
      talktimeFollowup: number;
      counsellingConnected: number;
      followupConnected: number;
      leads: number;
      totalLinks: number;
      salesLinks: number;
      conv: number;
      salesConv: number;
      referralLeads: number;
      reactiveLeads: number;
      renewalLeads: number;
      extensionLeads: number;
    };
  };
  metrics: {
    ytd: {
      callsPerDtPerDay: number;
      connectivity: number;
      ttPerConnectedCall: number;
      ttCounsellingPerConnectedCall: number;
      ttFollowupPerConnectedCall: number;
      leadsPerDtPerDay: number;
      leadVsConnected: number;
      mightPay: number;
      convPercent: number;
      salesTeamConv: number;
    };
    wtd: {
      callsPerDtPerDay: number;
      connectivity: number;
      ttPerConnectedCall: number;
      ttCounsellingPerConnectedCall: number;
      ttFollowupPerConnectedCall: number;
      leadsPerDtPerDay: number;
      leadVsConnected: number;
      mightPay: number;
      convPercent: number;
      salesTeamConv: number;
    };
    mtd: {
      callsPerDtPerDay: number;
      connectivity: number;
      ttPerConnectedCall: number;
      ttCounsellingPerConnectedCall: number;
      ttFollowupPerConnectedCall: number;
      leadsPerDtPerDay: number;
      leadVsConnected: number;
      mightPay: number;
      convPercent: number;
      salesTeamConv: number;
    };
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const role = searchParams.get('role');

  if (!name || !role) {
    return NextResponse.json(
      { error: 'Name and role parameters are required' },
      { status: 400 }
    );
  }

  try {
    const funnelData = await getSheetData('Dietitian Funnel!A2:BL');
    const { daysWTD, daysMTD } = calculateDays();

    const roleColumns = {
      'EM': 5,        // Column F
      'FLAP': 6,      // Column G
      'AM': 7,        // Column H
      'M': 8,         // Column I
      'Manager': 8,   // Column I
      'SM': 9,        // Column J
      'Dietitian': 1, // Column B
      'D': 1          // Alias
    } as const;

    const columnIndex = roleColumns[role as keyof typeof roleColumns];
    if (columnIndex === undefined) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    let teamSize = 0;
    const tallies = {
      ytd: { 
        calls: 0, 
        uniqueCalls: 0,
        connected: 0,
        uniqueConnected: 0,
        talktime: 0, 
        talktimeCounselling: 0, 
        talktimeFollowup: 0, 
        counsellingConnected: 0, 
        followupConnected: 0,
        leads: 0, 
        totalLinks: 0, 
        salesLinks: 0, 
        conv: 0, 
        salesConv: 0,
        referralLeads: 0, 
        reactiveLeads: 0, 
        renewalLeads: 0, 
        extensionLeads: 0
      },
      wtd: { 
        calls: 0, 
        uniqueCalls: 0,
        connected: 0,
        uniqueConnected: 0,
        talktime: 0, 
        talktimeCounselling: 0, 
        talktimeFollowup: 0, 
        counsellingConnected: 0, 
        followupConnected: 0,
        leads: 0, 
        totalLinks: 0, 
        salesLinks: 0, 
        conv: 0, 
        salesConv: 0,
        referralLeads: 0, 
        reactiveLeads: 0, 
        renewalLeads: 0, 
        extensionLeads: 0
      },
      mtd: { 
        calls: 0, 
        uniqueCalls: 0,
        connected: 0,
        uniqueConnected: 0,
        talktime: 0, 
        talktimeCounselling: 0, 
        talktimeFollowup: 0, 
        counsellingConnected: 0, 
        followupConnected: 0,
        leads: 0, 
        totalLinks: 0, 
        salesLinks: 0, 
        conv: 0, 
        salesConv: 0,
        referralLeads: 0, 
        reactiveLeads: 0, 
        renewalLeads: 0, 
        extensionLeads: 0
      }
    };

    // Role-based team size calculation
    if (role === 'EM') {
      for (const row of funnelData) {
        const rowName = row[columnIndex]?.trim();
        if (rowName && rowName.toLowerCase() === name.toLowerCase()) {
          teamSize++;
        }
      }
    } else if (role === 'Dietitian' || role === 'D') {
      let eligible = false;
      for (const row of funnelData) {
        const rowName = row[columnIndex]?.trim();
        if (rowName && rowName.toLowerCase() === name.toLowerCase()) {
          const columnEValue = row[4];
          if (columnEValue !== '' && columnEValue != null && !isNaN(Number(columnEValue))) {
            const e = parseNumber(columnEValue);
            if (e >= 30) {
              eligible = true;
              break;
            }
          }
        }
      }
      teamSize = eligible ? 1 : 0;
    } else {
      for (const row of funnelData) {
        const rowName = row[columnIndex]?.trim();
        const columnEValue = row[4];
        
        if (rowName && rowName.toLowerCase() === name.toLowerCase()) {
          if (columnEValue && columnEValue !== '' && !isNaN(Number(columnEValue))) {
            const columnENumber = parseNumber(columnEValue);
            if (columnENumber >= 30) {
              teamSize++;
            }
          }
        }
      }
    }

    // Data processing
    if ((role === 'EM') ? teamSize > 0 : (role === 'Dietitian' || role === 'D') ? true : teamSize > 0) {
      for (const row of funnelData) {
        const rowName = row[columnIndex]?.trim();
        const columnEValue = row[4];
        
        if (rowName && rowName.toLowerCase() === name.toLowerCase()) {
          const shouldProcessData = role === 'EM' ? true : 
            (columnEValue && columnEValue !== '' && !isNaN(Number(columnEValue)) && parseNumber(columnEValue) >= 0);
          
          if (shouldProcessData) {
            // YTD columns
            tallies.ytd.calls += parseNumber(row[10]); // K
            tallies.ytd.uniqueCalls += parseNumber(row[58]); // BG (58-1 = 57)
            tallies.ytd.connected += parseNumber(row[11]); // L
            tallies.ytd.uniqueConnected += parseNumber(row[61]); // BJ (62-1 = 61)
            tallies.ytd.talktime += parseNumber(row[12]) / 3600; // M
            tallies.ytd.leads += parseNumber(row[13]); // N
            tallies.ytd.totalLinks += parseNumber(row[14]) + parseNumber(row[16]); // O + Q
            tallies.ytd.salesLinks += parseNumber(row[16]); // Q
            tallies.ytd.conv += parseNumber(row[15]) + parseNumber(row[17]); // P + R
            tallies.ytd.salesConv += parseNumber(row[17]); // R

            // WTD columns
            tallies.wtd.calls += parseNumber(row[18]); // S
            tallies.wtd.uniqueCalls += parseNumber(row[59]); // BH (59-1 = 58)
            tallies.wtd.connected += parseNumber(row[19]); // T
            tallies.wtd.uniqueConnected += parseNumber(row[62]); // BK (63-1 = 62)
            tallies.wtd.talktime += parseNumber(row[20]) / 3600; // U
            tallies.wtd.leads += parseNumber(row[21]); // V
            tallies.wtd.totalLinks += parseNumber(row[22]) + parseNumber(row[24]); // W + Y
            tallies.wtd.salesLinks += parseNumber(row[24]); // Y
            tallies.wtd.conv += parseNumber(row[23]) + parseNumber(row[25]); // X + Z
            tallies.wtd.salesConv += parseNumber(row[25]); // Z

            // MTD columns
            tallies.mtd.calls += parseNumber(row[26]); // AA
            tallies.mtd.uniqueCalls += parseNumber(row[60]); // BI (60-1 = 59)
            tallies.mtd.connected += parseNumber(row[27]); // AB
            tallies.mtd.uniqueConnected += parseNumber(row[63]); // BL (64-1 = 63)
            tallies.mtd.talktime += parseNumber(row[28]) / 3600; // AC
            tallies.mtd.leads += parseNumber(row[29]); // AD
            tallies.mtd.totalLinks += parseNumber(row[30]) + parseNumber(row[32]); // AE + AG
            tallies.mtd.salesLinks += parseNumber(row[32]); // AG
            tallies.mtd.conv += parseNumber(row[31]) + parseNumber(row[33]); // AF + AH
            tallies.mtd.salesConv += parseNumber(row[33]); // AH

            // Continue with other columns...
            tallies.ytd.talktimeCounselling += parseNumber(row[34]) / 3600; // AI
            tallies.wtd.talktimeCounselling += parseNumber(row[35]) / 3600; // AJ
            tallies.mtd.talktimeCounselling += parseNumber(row[36]) / 3600; // AK

            tallies.ytd.talktimeFollowup += parseNumber(row[37]) / 3600; // AL
            tallies.wtd.talktimeFollowup += parseNumber(row[38]) / 3600; // AM
            tallies.mtd.talktimeFollowup += parseNumber(row[39]) / 3600; // AN

            tallies.ytd.counsellingConnected += parseNumber(row[40]); // AO
            tallies.wtd.counsellingConnected += parseNumber(row[41]); // AP
            tallies.mtd.counsellingConnected += parseNumber(row[42]); // AQ

            tallies.ytd.followupConnected += parseNumber(row[43]); // AR
            tallies.wtd.followupConnected += parseNumber(row[44]); // AS
            tallies.mtd.followupConnected += parseNumber(row[45]); // AT

            // Leads breakdown
            tallies.ytd.referralLeads += parseNumber(row[46]); // AU
            tallies.ytd.reactiveLeads += parseNumber(row[47]); // AV
            tallies.ytd.renewalLeads += parseNumber(row[48]); // AW
            tallies.ytd.extensionLeads += parseNumber(row[49]); // AX

            tallies.wtd.referralLeads += parseNumber(row[50]); // AY
            tallies.wtd.reactiveLeads += parseNumber(row[51]); // AZ
            tallies.wtd.renewalLeads += parseNumber(row[52]); // BA
            tallies.wtd.extensionLeads += parseNumber(row[53]); // BB

            tallies.mtd.referralLeads += parseNumber(row[54]); // BC
            tallies.mtd.reactiveLeads += parseNumber(row[55]); // BD
            tallies.mtd.renewalLeads += parseNumber(row[56]); // BE
            tallies.mtd.extensionLeads += parseNumber(row[57]); // BF
          }
        }
      }
    }

    // Derived metrics
    const calculateMetrics = (period: keyof typeof tallies, days: number) => {
      const data = tallies[period];
      return {
        callsPerDtPerDay: teamSize > 0 && days > 0 ? data.calls / (teamSize * days) : 0,
        connectivity: safeDivide(data.uniqueConnected, data.uniqueCalls),
        ttPerConnectedCall: safeDivide(data.talktime * 60, data.connected),
        ttCounsellingPerConnectedCall: safeDivide(data.talktimeCounselling * 60, data.counsellingConnected),
        ttFollowupPerConnectedCall: safeDivide(data.talktimeFollowup * 60, data.followupConnected),
        leadsPerDtPerDay: teamSize > 0 && days > 0 ? data.leads / (teamSize * days) : 0,
        leadVsConnected: safeDivide(data.leads, data.uniqueConnected),
        mightPay: safeDivide(data.totalLinks, data.leads),
        convPercent: safeDivide(data.conv, data.totalLinks),
        salesTeamConv: safeDivide(data.salesConv, data.salesLinks)
      };
    };

    const metrics = {
      ytd: calculateMetrics('ytd', 1),
      wtd: calculateMetrics('wtd', daysWTD),
      mtd: calculateMetrics('mtd', daysMTD)
    };

    // Round metrics
    const roundMetrics = (metricsObj: any) => {
      const rounded: any = {};
      for (const [key, value] of Object.entries(metricsObj)) {
        rounded[key] = Math.round((value as number) * 1000) / 1000;
      }
      return rounded;
    };

    const response: FunnelData = {
      teamSize,
      rawTallies: tallies,
      metrics: {
        ytd: roundMetrics(metrics.ytd),
        wtd: roundMetrics(metrics.wtd),
        mtd: roundMetrics(metrics.mtd)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in funnel API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funnel data from Google Sheets' },
      { status: 500 }
    );
  }
}