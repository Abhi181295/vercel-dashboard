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

interface CounsellingRecord {
  dietitianName: string;        // Column B
  emName: string;               // Column K
  flapName: string;             // Column L
  amName: string;               // Column M
  managerName: string;          // Column N
  smName: string;               // Column O
  date: string;                 // Column D
  type: string;                 // Column J
  counsellingCompleted: number; // Column H
}

interface FollowUpRecord {
  dietitianName: string;        // Column A
  date: string;                 // Column B
  count1: number;              // Column C
  count2: number;              // Column D
  emName: string;               // Column K
  flapName: string;             // Column L
  amName: string;               // Column M
  managerName: string;          // Column N
  smName: string;               // Column O
  followupCompleted1: number;   // Column I
  followupCompleted2: number;   // Column J
}

interface HierarchyUser {
  id: string;
  name: string;
  role: 'SM' | 'M' | 'AM' | 'FLAP' | 'EM' | 'Dietitian';
  children?: HierarchyUser[];
  todayCounselling?: number;
  todayFollowUps?: number;
  yesterdayCounselling?: number;
  yesterdayFollowUps?: number;
  yesterdayCounsellingCompleted?: number;
  yesterdayFollowUpsCompleted?: number;
}

function generateId(name: string, role: string): string {
  return `${role.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function safeTrim(value: any): string {
  return value ? String(value).trim() : '';
}

function safeNumber(value: any): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function isToday(dateStr: string): boolean {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const recordDate = new Date(dateStr);
    recordDate.setHours(0, 0, 0, 0);
    
    return recordDate.getTime() === today.getTime();
  } catch (error) {
    return false;
  }
}

function isYesterday(dateStr: string): boolean {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const recordDate = new Date(dateStr);
    recordDate.setHours(0, 0, 0, 0);
    
    return recordDate.getTime() === yesterday.getTime();
  } catch (error) {
    return false;
  }
}

function buildHierarchyFromRecord(record: CounsellingRecord, userMap: Map<string, HierarchyUser>) {
  const roles = [];
  
  // Add all roles that exist in the record
  if (record.smName) roles.push({ name: record.smName, role: 'SM' as const });
  if (record.managerName) roles.push({ name: record.managerName, role: 'M' as const });
  if (record.amName) roles.push({ name: record.amName, role: 'AM' as const });
  if (record.flapName) roles.push({ name: record.flapName, role: 'FLAP' as const });
  if (record.emName) roles.push({ name: record.emName, role: 'EM' as const });
  if (record.dietitianName) roles.push({ name: record.dietitianName, role: 'Dietitian' as const });

  // Create users if they don't exist
  roles.forEach(({ name, role }) => {
    const id = generateId(name, role);
    if (!userMap.has(id)) {
      userMap.set(id, {
        id,
        name,
        role,
        children: role !== 'Dietitian' ? [] : undefined,
        todayCounselling: 0,
        todayFollowUps: 0,
        yesterdayCounselling: 0,
        yesterdayFollowUps: 0,
        yesterdayCounsellingCompleted: 0,
        yesterdayFollowUpsCompleted: 0
      });
    }
  });

  // Build parent-child relationships in order
  for (let i = 0; i < roles.length - 1; i++) {
    const parentRole = roles[i];
    const childRole = roles[i + 1];
    
    const parentId = generateId(parentRole.name, parentRole.role);
    const childId = generateId(childRole.name, childRole.role);
    
    const parent = userMap.get(parentId);
    const child = userMap.get(childId);
    
    if (parent && child && parent.children && !parent.children.some(c => c.id === childId)) {
      parent.children.push(child);
    }
  }

  // Handle direct relationships (skip missing middle roles)
  // SM -> Dietitian (when no manager/am/flap/em)
  if (record.smName && record.dietitianName && 
      !record.managerName && !record.amName && !record.flapName && !record.emName) {
    const smId = generateId(record.smName, 'SM');
    const dietitianId = generateId(record.dietitianName, 'Dietitian');
    
    const sm = userMap.get(smId);
    const dietitian = userMap.get(dietitianId);
    
    if (sm && dietitian && sm.children && !sm.children.some(c => c.id === dietitianId)) {
      sm.children.push(dietitian);
    }
  }

  // SM -> EM (when no manager/am/flap)
  if (record.smName && record.emName && 
      !record.managerName && !record.amName && !record.flapName) {
    const smId = generateId(record.smName, 'SM');
    const emId = generateId(record.emName, 'EM');
    
    const sm = userMap.get(smId);
    const em = userMap.get(emId);
    
    if (sm && em && sm.children && !sm.children.some(c => c.id === emId)) {
      sm.children.push(em);
    }
  }

  // SM -> AM/FLAP (when no manager)
  if (record.smName && (record.amName || record.flapName) && !record.managerName) {
    const smId = generateId(record.smName, 'SM');
    const amFlapName = record.amName || record.flapName;
    const role = record.amName ? 'AM' : 'FLAP';
    const amFlapId = generateId(amFlapName, role);
    
    const sm = userMap.get(smId);
    const amFlap = userMap.get(amFlapId);
    
    if (sm && amFlap && sm.children && !sm.children.some(c => c.id === amFlapId)) {
      sm.children.push(amFlap);
    }
  }

  // Manager -> Dietitian (when no am/flap/em)
  if (record.managerName && record.dietitianName && 
      !record.amName && !record.flapName && !record.emName) {
    const managerId = generateId(record.managerName, 'M');
    const dietitianId = generateId(record.dietitianName, 'Dietitian');
    
    const manager = userMap.get(managerId);
    const dietitian = userMap.get(dietitianId);
    
    if (manager && dietitian && manager.children && !manager.children.some(c => c.id === dietitianId)) {
      manager.children.push(dietitian);
    }
  }

  // Manager -> EM (when no am/flap)
  if (record.managerName && record.emName && !record.amName && !record.flapName) {
    const managerId = generateId(record.managerName, 'M');
    const emId = generateId(record.emName, 'EM');
    
    const manager = userMap.get(managerId);
    const em = userMap.get(emId);
    
    if (manager && em && manager.children && !manager.children.some(c => c.id === emId)) {
      manager.children.push(em);
    }
  }

  // AM/FLAP -> Dietitian (when no em)
  if ((record.amName || record.flapName) && record.dietitianName && !record.emName) {
    const amFlapName = record.amName || record.flapName;
    const role = record.amName ? 'AM' : 'FLAP';
    const amFlapId = generateId(amFlapName, role);
    const dietitianId = generateId(record.dietitianName, 'Dietitian');
    
    const amFlap = userMap.get(amFlapId);
    const dietitian = userMap.get(dietitianId);
    
    if (amFlap && dietitian && amFlap.children && !amFlap.children.some(c => c.id === dietitianId)) {
      amFlap.children.push(dietitian);
    }
  }
}

function buildHierarchyFromFollowUpRecord(record: FollowUpRecord, userMap: Map<string, HierarchyUser>) {
  const roles = [];
  
  // Add all roles that exist in the record (same hierarchy structure as counselling)
  if (record.smName) roles.push({ name: record.smName, role: 'SM' as const });
  if (record.managerName) roles.push({ name: record.managerName, role: 'M' as const });
  if (record.amName) roles.push({ name: record.amName, role: 'AM' as const });
  if (record.flapName) roles.push({ name: record.flapName, role: 'FLAP' as const });
  if (record.emName) roles.push({ name: record.emName, role: 'EM' as const });
  if (record.dietitianName) roles.push({ name: record.dietitianName, role: 'Dietitian' as const });

  // Create users if they don't exist
  roles.forEach(({ name, role }) => {
    const id = generateId(name, role);
    if (!userMap.has(id)) {
      userMap.set(id, {
        id,
        name,
        role,
        children: role !== 'Dietitian' ? [] : undefined,
        todayCounselling: 0,
        todayFollowUps: 0,
        yesterdayCounselling: 0,
        yesterdayFollowUps: 0,
        yesterdayCounsellingCompleted: 0,
        yesterdayFollowUpsCompleted: 0
      });
    }
  });

  // Build parent-child relationships in order (same as counselling)
  for (let i = 0; i < roles.length - 1; i++) {
    const parentRole = roles[i];
    const childRole = roles[i + 1];
    
    const parentId = generateId(parentRole.name, parentRole.role);
    const childId = generateId(childRole.name, childRole.role);
    
    const parent = userMap.get(parentId);
    const child = userMap.get(childId);
    
    if (parent && child && parent.children && !parent.children.some(c => c.id === childId)) {
      parent.children.push(child);
    }
  }

  // Handle the same direct relationships as counselling
  // SM -> Dietitian (when no manager/am/flap/em)
  if (record.smName && record.dietitianName && 
      !record.managerName && !record.amName && !record.flapName && !record.emName) {
    const smId = generateId(record.smName, 'SM');
    const dietitianId = generateId(record.dietitianName, 'Dietitian');
    
    const sm = userMap.get(smId);
    const dietitian = userMap.get(dietitianId);
    
    if (sm && dietitian && sm.children && !sm.children.some(c => c.id === dietitianId)) {
      sm.children.push(dietitian);
    }
  }

  // SM -> EM (when no manager/am/flap)
  if (record.smName && record.emName && 
      !record.managerName && !record.amName && !record.flapName) {
    const smId = generateId(record.smName, 'SM');
    const emId = generateId(record.emName, 'EM');
    
    const sm = userMap.get(smId);
    const em = userMap.get(emId);
    
    if (sm && em && sm.children && !sm.children.some(c => c.id === emId)) {
      sm.children.push(em);
    }
  }

  // SM -> AM/FLAP (when no manager)
  if (record.smName && (record.amName || record.flapName) && !record.managerName) {
    const smId = generateId(record.smName, 'SM');
    const amFlapName = record.amName || record.flapName;
    const role = record.amName ? 'AM' : 'FLAP';
    const amFlapId = generateId(amFlapName, role);
    
    const sm = userMap.get(smId);
    const amFlap = userMap.get(amFlapId);
    
    if (sm && amFlap && sm.children && !sm.children.some(c => c.id === amFlapId)) {
      sm.children.push(amFlap);
    }
  }

  // Manager -> Dietitian (when no am/flap/em)
  if (record.managerName && record.dietitianName && 
      !record.amName && !record.flapName && !record.emName) {
    const managerId = generateId(record.managerName, 'M');
    const dietitianId = generateId(record.dietitianName, 'Dietitian');
    
    const manager = userMap.get(managerId);
    const dietitian = userMap.get(dietitianId);
    
    if (manager && dietitian && manager.children && !manager.children.some(c => c.id === dietitianId)) {
      manager.children.push(dietitian);
    }
  }

  // Manager -> EM (when no am/flap)
  if (record.managerName && record.emName && !record.amName && !record.flapName) {
    const managerId = generateId(record.managerName, 'M');
    const emId = generateId(record.emName, 'EM');
    
    const manager = userMap.get(managerId);
    const em = userMap.get(emId);
    
    if (manager && em && manager.children && !manager.children.some(c => c.id === emId)) {
      manager.children.push(em);
    }
  }

  // AM/FLAP -> Dietitian (when no em)
  if ((record.amName || record.flapName) && record.dietitianName && !record.emName) {
    const amFlapName = record.amName || record.flapName;
    const role = record.amName ? 'AM' : 'FLAP';
    const amFlapId = generateId(amFlapName, role);
    const dietitianId = generateId(record.dietitianName, 'Dietitian');
    
    const amFlap = userMap.get(amFlapId);
    const dietitian = userMap.get(dietitianId);
    
    if (amFlap && dietitian && amFlap.children && !amFlap.children.some(c => c.id === dietitianId)) {
      amFlap.children.push(dietitian);
    }
  }
}

function calculateCounsellingCounts(records: CounsellingRecord[], selectedSMName?: string) {
  const todayCounts = new Map<string, number>();
  const yesterdayCounts = new Map<string, number>();
  const yesterdayCompletedCounts = new Map<string, number>();

  // Filter for TODAY: Today's Date AND Type = "NEW"
  const todayFilteredDataset = records.filter(record => {
    const isTodayDate = isToday(record.date);
    const isNewType = record.type?.toUpperCase() === 'NEW';
    return isTodayDate && isNewType;
  });

  // Filter for YESTERDAY: Yesterday's Date AND Type = "NEW"
  const yesterdayFilteredDataset = records.filter(record => {
    const isYesterdayDate = isYesterday(record.date);
    const isNewType = record.type?.toUpperCase() === 'NEW';
    return isYesterdayDate && isNewType;
  });

  // Filter for YESTERDAY: Yesterday's Date for completed counselling (Column H > 1200)
  const yesterdayCompletedDataset = records.filter(record => {
    const isYesterdayDate = isYesterday(record.date);
    const isCompleted = record.counsellingCompleted > 1200;
    return isYesterdayDate && isCompleted;
  });

  // Count TODAY's counselling
  todayFilteredDataset.forEach(record => {
    if (selectedSMName && record.smName?.toLowerCase() !== selectedSMName.toLowerCase()) {
      return;
    }

    // Count SM (Column O)
    if (record.smName) {
      const key = generateId(record.smName, 'SM');
      todayCounts.set(key, (todayCounts.get(key) || 0) + 1);
    }

    // Count Manager (Column N)
    if (record.managerName) {
      const key = generateId(record.managerName, 'M');
      todayCounts.set(key, (todayCounts.get(key) || 0) + 1);
    }

    // Count AM (Column M)
    if (record.amName) {
      const key = generateId(record.amName, 'AM');
      todayCounts.set(key, (todayCounts.get(key) || 0) + 1);
    }

    // Count FLAP (Column L)
    if (record.flapName) {
      const key = generateId(record.flapName, 'FLAP');
      todayCounts.set(key, (todayCounts.get(key) || 0) + 1);
    }

    // Count EM (Column K)
    if (record.emName) {
      const key = generateId(record.emName, 'EM');
      todayCounts.set(key, (todayCounts.get(key) || 0) + 1);
    }

    // Count Dietitian (Column B)
    if (record.dietitianName) {
      const key = generateId(record.dietitianName, 'Dietitian');
      todayCounts.set(key, (todayCounts.get(key) || 0) + 1);
    }
  });

  // Count YESTERDAY's counselling
  yesterdayFilteredDataset.forEach(record => {
    if (selectedSMName && record.smName?.toLowerCase() !== selectedSMName.toLowerCase()) {
      return;
    }

    // Count SM (Column O)
    if (record.smName) {
      const key = generateId(record.smName, 'SM');
      yesterdayCounts.set(key, (yesterdayCounts.get(key) || 0) + 1);
    }

    // Count Manager (Column N)
    if (record.managerName) {
      const key = generateId(record.managerName, 'M');
      yesterdayCounts.set(key, (yesterdayCounts.get(key) || 0) + 1);
    }

    // Count AM (Column M)
    if (record.amName) {
      const key = generateId(record.amName, 'AM');
      yesterdayCounts.set(key, (yesterdayCounts.get(key) || 0) + 1);
    }

    // Count FLAP (Column L)
    if (record.flapName) {
      const key = generateId(record.flapName, 'FLAP');
      yesterdayCounts.set(key, (yesterdayCounts.get(key) || 0) + 1);
    }

    // Count EM (Column K)
    if (record.emName) {
      const key = generateId(record.emName, 'EM');
      yesterdayCounts.set(key, (yesterdayCounts.get(key) || 0) + 1);
    }

    // Count Dietitian (Column B)
    if (record.dietitianName) {
      const key = generateId(record.dietitianName, 'Dietitian');
      yesterdayCounts.set(key, (yesterdayCounts.get(key) || 0) + 1);
    }
  });

  // Count YESTERDAY's completed counselling (Column H > 1200)
  yesterdayCompletedDataset.forEach(record => {
    if (selectedSMName && record.smName?.toLowerCase() !== selectedSMName.toLowerCase()) {
      return;
    }

    // Count SM (Column O)
    if (record.smName) {
      const key = generateId(record.smName, 'SM');
      yesterdayCompletedCounts.set(key, (yesterdayCompletedCounts.get(key) || 0) + 1);
    }

    // Count Manager (Column N)
    if (record.managerName) {
      const key = generateId(record.managerName, 'M');
      yesterdayCompletedCounts.set(key, (yesterdayCompletedCounts.get(key) || 0) + 1);
    }

    // Count AM (Column M)
    if (record.amName) {
      const key = generateId(record.amName, 'AM');
      yesterdayCompletedCounts.set(key, (yesterdayCompletedCounts.get(key) || 0) + 1);
    }

    // Count FLAP (Column L)
    if (record.flapName) {
      const key = generateId(record.flapName, 'FLAP');
      yesterdayCompletedCounts.set(key, (yesterdayCompletedCounts.get(key) || 0) + 1);
    }

    // Count EM (Column K)
    if (record.emName) {
      const key = generateId(record.emName, 'EM');
      yesterdayCompletedCounts.set(key, (yesterdayCompletedCounts.get(key) || 0) + 1);
    }

    // Count Dietitian (Column B)
    if (record.dietitianName) {
      const key = generateId(record.dietitianName, 'Dietitian');
      yesterdayCompletedCounts.set(key, (yesterdayCompletedCounts.get(key) || 0) + 1);
    }
  });

  return { todayCounts, yesterdayCounts, yesterdayCompletedCounts };
}

function calculateFollowUpCounts(records: FollowUpRecord[], selectedSMName?: string) {
  const todayFollowUps = new Map<string, number>();
  const yesterdayFollowUps = new Map<string, number>();
  const yesterdayFollowUpsCompleted = new Map<string, number>();

  // Filter for TODAY's follow-ups
  const todayFollowUpsData = records.filter(record => {
    const isTodayDate = isToday(record.date);
    return isTodayDate;
  });

  // Filter for YESTERDAY's follow-ups
  const yesterdayFollowUpsData = records.filter(record => {
    const isYesterdayDate = isYesterday(record.date);
    return isYesterdayDate;
  });

  // Filter for YESTERDAY's completed follow-ups (Column I or J > 60)
  const yesterdayFollowUpsCompletedData = records.filter(record => {
    const isYesterdayDate = isYesterday(record.date);
    const isCompleted = record.followupCompleted1 > 60 || record.followupCompleted2 > 60;
    return isYesterdayDate && isCompleted;
  });

  // Count TODAY's follow-ups
  todayFollowUpsData.forEach(record => {
    if (selectedSMName && record.smName?.toLowerCase() !== selectedSMName.toLowerCase()) {
      return;
    }

    // Calculate total follow-ups (Column C + Column D)
    const totalFollowUps = record.count1 + record.count2;

    // Count by each role in the hierarchy
    if (record.smName) {
      const key = generateId(record.smName, 'SM');
      todayFollowUps.set(key, (todayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.managerName) {
      const key = generateId(record.managerName, 'M');
      todayFollowUps.set(key, (todayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.amName) {
      const key = generateId(record.amName, 'AM');
      todayFollowUps.set(key, (todayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.flapName) {
      const key = generateId(record.flapName, 'FLAP');
      todayFollowUps.set(key, (todayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.emName) {
      const key = generateId(record.emName, 'EM');
      todayFollowUps.set(key, (todayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.dietitianName) {
      const key = generateId(record.dietitianName, 'Dietitian');
      todayFollowUps.set(key, (todayFollowUps.get(key) || 0) + totalFollowUps);
    }
  });

  // Count YESTERDAY's follow-ups
  yesterdayFollowUpsData.forEach(record => {
    if (selectedSMName && record.smName?.toLowerCase() !== selectedSMName.toLowerCase()) {
      return;
    }

    // Calculate total follow-ups (Column C + Column D)
    const totalFollowUps = record.count1 + record.count2;

    // Count by each role in the hierarchy
    if (record.smName) {
      const key = generateId(record.smName, 'SM');
      yesterdayFollowUps.set(key, (yesterdayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.managerName) {
      const key = generateId(record.managerName, 'M');
      yesterdayFollowUps.set(key, (yesterdayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.amName) {
      const key = generateId(record.amName, 'AM');
      yesterdayFollowUps.set(key, (yesterdayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.flapName) {
      const key = generateId(record.flapName, 'FLAP');
      yesterdayFollowUps.set(key, (yesterdayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.emName) {
      const key = generateId(record.emName, 'EM');
      yesterdayFollowUps.set(key, (yesterdayFollowUps.get(key) || 0) + totalFollowUps);
    }

    if (record.dietitianName) {
      const key = generateId(record.dietitianName, 'Dietitian');
      yesterdayFollowUps.set(key, (yesterdayFollowUps.get(key) || 0) + totalFollowUps);
    }
  });

  // Count YESTERDAY's completed follow-ups (Column I or J > 60)
  yesterdayFollowUpsCompletedData.forEach(record => {
    if (selectedSMName && record.smName?.toLowerCase() !== selectedSMName.toLowerCase()) {
      return;
    }

    // Calculate total completed follow-ups
    let totalCompleted = 0;
    if (record.followupCompleted1 > 60) totalCompleted += 1;
    if (record.followupCompleted2 > 60) totalCompleted += 1;

    // Count by each role in the hierarchy
    if (record.smName) {
      const key = generateId(record.smName, 'SM');
      yesterdayFollowUpsCompleted.set(key, (yesterdayFollowUpsCompleted.get(key) || 0) + totalCompleted);
    }

    if (record.managerName) {
      const key = generateId(record.managerName, 'M');
      yesterdayFollowUpsCompleted.set(key, (yesterdayFollowUpsCompleted.get(key) || 0) + totalCompleted);
    }

    if (record.amName) {
      const key = generateId(record.amName, 'AM');
      yesterdayFollowUpsCompleted.set(key, (yesterdayFollowUpsCompleted.get(key) || 0) + totalCompleted);
    }

    if (record.flapName) {
      const key = generateId(record.flapName, 'FLAP');
      yesterdayFollowUpsCompleted.set(key, (yesterdayFollowUpsCompleted.get(key) || 0) + totalCompleted);
    }

    if (record.emName) {
      const key = generateId(record.emName, 'EM');
      yesterdayFollowUpsCompleted.set(key, (yesterdayFollowUpsCompleted.get(key) || 0) + totalCompleted);
    }

    if (record.dietitianName) {
      const key = generateId(record.dietitianName, 'Dietitian');
      yesterdayFollowUpsCompleted.set(key, (yesterdayFollowUpsCompleted.get(key) || 0) + totalCompleted);
    }
  });

  return { todayFollowUps, yesterdayFollowUps, yesterdayFollowUpsCompleted };
}

function assignCountsToHierarchy(
  users: HierarchyUser[], 
  todayCounts: Map<string, number>, 
  yesterdayCounts: Map<string, number>,
  yesterdayCounsellingCompletedCounts: Map<string, number>,
  todayFollowUps: Map<string, number>, 
  yesterdayFollowUps: Map<string, number>,
  yesterdayFollowUpsCompletedCounts: Map<string, number>
) {
  users.forEach(user => {
    // Assign counselling counts
    user.todayCounselling = todayCounts.get(user.id) || 0;
    user.yesterdayCounselling = yesterdayCounts.get(user.id) || 0;
    user.yesterdayCounsellingCompleted = yesterdayCounsellingCompletedCounts.get(user.id) || 0;
    
    // Assign follow-up counts
    user.todayFollowUps = todayFollowUps.get(user.id) || 0;
    user.yesterdayFollowUps = yesterdayFollowUps.get(user.id) || 0;
    user.yesterdayFollowUpsCompleted = yesterdayFollowUpsCompletedCounts.get(user.id) || 0;
    
    // Recursively assign counts to children
    if (user.children) {
      assignCountsToHierarchy(
        user.children, 
        todayCounts, 
        yesterdayCounts,
        yesterdayCounsellingCompletedCounts,
        todayFollowUps, 
        yesterdayFollowUps,
        yesterdayFollowUpsCompletedCounts
      );
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const smName = searchParams.get('smName');

    // First, get SM names from hierarchy API
    let allSMsFromHierarchy: string[] = [];
    try {
      // FIXED: Use the current request's host to construct the URL
      const requestUrl = new URL(request.url);
      const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      
      const hierarchyResponse = await fetch(`${baseUrl}/api/hierarchy`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (hierarchyResponse.ok) {
        const hierarchyData = await hierarchyResponse.json();
        allSMsFromHierarchy = hierarchyData.sms.map((sm: any) => sm.name);
      }
    } catch (error) {
      console.error('Error fetching hierarchy data:', error);
    }

    // Fetch ALL data from counselling sheet
    const counsellingData = await getSheetData('counselling!A2:Z');
    
    // Fetch ALL data from followup sheet
    const followUpData = await getSheetData('followup!A2:Z');
    
    const allCounsellingRecords: CounsellingRecord[] = [];
    const allFollowUpRecords: FollowUpRecord[] = [];

    // Process ALL counselling data first
    for (let i = 0; i < counsellingData.length; i++) {
      const row = counsellingData[i];
      
      const record: CounsellingRecord = {
        dietitianName: safeTrim(row[1]),      // Column B
        emName: safeTrim(row[10]),            // Column K
        flapName: safeTrim(row[11]),          // Column L
        amName: safeTrim(row[12]),            // Column M
        managerName: safeTrim(row[13]),       // Column N
        smName: safeTrim(row[14]),            // Column O
        date: safeTrim(row[3]),               // Column D
        type: safeTrim(row[9]),               // Column J
        counsellingCompleted: safeNumber(row[7]), // Column H
      };

      // Skip if no SM name
      if (!record.smName) {
        continue;
      }

      allCounsellingRecords.push(record);
    }

    // Process ALL followup data
    for (let i = 0; i < followUpData.length; i++) {
      const row = followUpData[i];
      
      const record: FollowUpRecord = {
        dietitianName: safeTrim(row[0]),      // Column A: Dietitian Name
        date: safeTrim(row[1]),               // Column B: Date
        count1: safeNumber(row[2]),           // Column C: Count 1
        count2: safeNumber(row[3]),           // Column D: Count 2
        emName: safeTrim(row[10]),            // Column K: EM
        flapName: safeTrim(row[11]),          // Column L: FLAP
        amName: safeTrim(row[12]),            // Column M: AM
        managerName: safeTrim(row[13]),       // Column N: Manager
        smName: safeTrim(row[14]),            // Column O: SM
        followupCompleted1: safeNumber(row[8]), // Column I
        followupCompleted2: safeNumber(row[9]), // Column J
      };

      // Skip if no SM name
      if (!record.smName) {
        continue;
      }

      allFollowUpRecords.push(record);
    }

    // Calculate counselling counts
    const { 
      todayCounts, 
      yesterdayCounts, 
      yesterdayCompletedCounts: yesterdayCounsellingCompletedCounts 
    } = calculateCounsellingCounts(allCounsellingRecords, smName || undefined);

    // Calculate follow-up counts
    const { 
      todayFollowUps, 
      yesterdayFollowUps, 
      yesterdayFollowUpsCompleted: yesterdayFollowUpsCompletedCounts 
    } = calculateFollowUpCounts(allFollowUpRecords, smName || undefined);

    // Now build hierarchy with only records for the selected SM (if any)
    const uniqueUsers = new Map<string, HierarchyUser>();
    
    // Build hierarchy from counselling records for selected SM
    const counsellingRecordsForHierarchy = smName 
      ? allCounsellingRecords.filter(record => record.smName?.toLowerCase() === smName.toLowerCase())
      : allCounsellingRecords;

    counsellingRecordsForHierarchy.forEach(record => {
      buildHierarchyFromRecord(record, uniqueUsers);
    });

    // Build hierarchy from followup records for selected SM
    const followUpRecordsForHierarchy = smName 
      ? allFollowUpRecords.filter(record => record.smName?.toLowerCase() === smName.toLowerCase())
      : allFollowUpRecords;

    followUpRecordsForHierarchy.forEach(record => {
      buildHierarchyFromFollowUpRecord(record, uniqueUsers);
    });

    // Build final hierarchy structure
    const hierarchy: HierarchyUser[] = [];
    const userMap = new Map<string, HierarchyUser>();

    // Create clean user objects
    uniqueUsers.forEach((user) => {
      userMap.set(user.id, { 
        ...user, 
        children: user.children ? [...user.children] : []
      });
    });

    // Get top-level SMs - ONLY from hierarchy API
    const allSMs = allSMsFromHierarchy.map(smName => {
      const smId = generateId(smName, 'SM');
      const existingSM = userMap.get(smId);
      
      if (existingSM) {
        return existingSM;
      } else {
        // Create empty SM if it exists in hierarchy but not in data
        const newSM: HierarchyUser = {
          id: smId,
          name: smName,
          role: 'SM',
          children: [],
          todayCounselling: 0,
          todayFollowUps: 0,
          yesterdayCounselling: 0,
          yesterdayFollowUps: 0,
          yesterdayCounsellingCompleted: 0,
          yesterdayFollowUpsCompleted: 0
        };
        userMap.set(smId, newSM);
        return newSM;
      }
    });

    hierarchy.push(...allSMs);

    // Rebuild hierarchy relationships for all SMs
    const allRecordsForHierarchy = [...counsellingRecordsForHierarchy, ...followUpRecordsForHierarchy];
    
    // Clear and rebuild children
    userMap.forEach(user => {
      if (user.children) {
        user.children = [];
      }
    });

    // Build hierarchy from counselling records
    counsellingRecordsForHierarchy.forEach(record => {
      buildHierarchyFromRecord(record, userMap);
    });

    // Build hierarchy from followup records
    followUpRecordsForHierarchy.forEach(record => {
      buildHierarchyFromFollowUpRecord(record, userMap);
    });

    // NOW assign all counts to the hierarchy
    assignCountsToHierarchy(
      hierarchy, 
      todayCounts, 
      yesterdayCounts,
      yesterdayCounsellingCompletedCounts,
      todayFollowUps, 
      yesterdayFollowUps,
      yesterdayFollowUpsCompletedCounts
    );

    // Get filter options by traversing the hierarchy
    const getFilterOptionsFromHierarchy = (hierarchy: HierarchyUser[]) => {
      const managers = new Set<string>();
      const ams = new Set<string>();
      const flaps = new Set<string>();
      const ems = new Set<string>();

      const traverse = (users: HierarchyUser[]) => {
        users.forEach(user => {
          if (user.role === 'M') managers.add(user.name);
          if (user.role === 'AM') ams.add(user.name);
          if (user.role === 'FLAP') flaps.add(user.name);
          if (user.role === 'EM') ems.add(user.name);
          
          if (user.children) {
            traverse(user.children);
          }
        });
      };

      traverse(hierarchy);

      return {
        managers: Array.from(managers).sort(),
        ams: Array.from(ams).sort(),
        flaps: Array.from(flaps).sort(),
        ems: Array.from(ems).sort(),
      };
    };

    const filterOptions = getFilterOptionsFromHierarchy(hierarchy);

    return NextResponse.json({
      hierarchy,
      filterOptions: {
        sms: allSMsFromHierarchy, // Use SMs from hierarchy API
        managers: filterOptions.managers,
        ams: filterOptions.ams,
        flaps: filterOptions.flaps,
        ems: filterOptions.ems
      },
      totalRecords: allRecordsForHierarchy.length
    });

  } catch (error) {
    console.error('Error in daily-tasks API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Google Sheets' },
      { status: 500 }
    );
  }
}