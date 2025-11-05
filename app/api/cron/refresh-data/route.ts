import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Simple auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== "Bearer " + cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ 
    success: true,
    message: "Cron route is working!",
    timestamp: new Date().toISOString()
  });
}
