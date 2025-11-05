import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    console.log('Cron job started at:', new Date().toISOString());
    
    // Call your existing APIs to refresh data and cache
    const responses = await Promise.allSettled([
      fetch(`${baseUrl}/api/hierarchy`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/dietitian-gaps`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/revenue`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/funnel`, { cache: 'no-store' })
    ]);

    const results = responses.map((response, index) => {
      const endpoints = ['hierarchy', 'dietitian-gaps', 'revenue', 'funnel'];
      return {
        endpoint: endpoints[index],
        status: response.status === 'fulfilled' ? 'success' : 'failed',
        statusCode: response.status === 'fulfilled' ? response.value.status : 'error'
      };
    });

    console.log('Cron job completed:', results);

    return NextResponse.json({
      success: true,
      refreshed: new Date().toISOString(),
      results: results
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ 
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
