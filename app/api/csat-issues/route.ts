// app/api/csat-issues/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const smName = searchParams.get('smName');
    const managerName = searchParams.get('managerName');
    const amName = searchParams.get('amName');
    const flapName = searchParams.get('flapName');
    const emName = searchParams.get('emName');
    const csatType = searchParams.get('type'); // 'low' or 'medium'

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

    // Filter by CSAT type
    let filteredRecords = records.filter((record: any) => {
      if (csatType === 'low') {
        return record.csatScore >= 1 && record.csatScore <= 3;
      } else if (csatType === 'medium') {
        return record.csatScore > 3 && record.csatScore <= 4;
      }
      return false;
    });

    // Sort by CSAT score ascending (worst first)
    filteredRecords.sort((a: any, b: any) => a.csatScore - b.csatScore);

    return NextResponse.json({
      records: filteredRecords,
      totalCount: filteredRecords.length
    });

  } catch (error) {
    console.error('Error in CSAT issues API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CSAT issues data' },
      { status: 500 }
    );
  }
}