// app/api/nps-issues/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const smName = searchParams.get('smName');
    const managerName = searchParams.get('managerName');
    const amName = searchParams.get('amName');
    const flapName = searchParams.get('flapName');
    const emName = searchParams.get('emName');
    const npsType = searchParams.get('type'); // 'low' or 'medium'

    // Build query parameters for quality-records API
    const queryParams = new URLSearchParams();
    if (smName) queryParams.append('smName', smName);
    if (managerName) queryParams.append('managerName', managerName);
    if (amName) queryParams.append('amName', amName);
    if (flapName) queryParams.append('flapName', flapName);
    if (emName) queryParams.append('emName', emName);

    // Fetch data from quality-records API
    const qualityResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/quality-records?${queryParams}`);
    
    if (!qualityResponse.ok) {
      throw new Error('Failed to fetch quality records data');
    }

    const { records } = await qualityResponse.json();

    // Filter by NPS type
    let filteredRecords = records.filter((record: any) => {
      if (npsType === 'low') {
        return record.npsScore >= 1 && record.npsScore <= 6;
      } else if (npsType === 'medium') {
        return record.npsScore > 6 && record.npsScore <= 8;
      }
      return false;
    });

    // Sort by NPS score ascending (worst first)
    filteredRecords.sort((a: any, b: any) => a.npsScore - b.npsScore);

    return NextResponse.json({
      records: filteredRecords,
      totalCount: filteredRecords.length
    });

  } catch (error) {
    console.error('Error in NPS issues API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NPS issues data' },
      { status: 500 }
    );
  }
}