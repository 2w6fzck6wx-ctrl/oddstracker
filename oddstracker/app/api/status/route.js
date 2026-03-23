// app/api/status/route.js
// Quick status check - visit yoursite.vercel.app/api/status

export async function GET() {
  const hasOddsKey = !!process.env.ODDS_API_KEY;
  const hasPushover = !!process.env.PUSHOVER_TOKEN && !!process.env.PUSHOVER_USER;
  const hasSupabase = !!process.env.SUPABASE_URL;

  return new Response(JSON.stringify({
    status: "running",
    timestamp: new Date().toISOString(),
    config: {
      oddsApiKey: hasOddsKey ? "configured" : "MISSING",
      pushover: hasPushover ? "configured" : "MISSING",
      supabase: hasSupabase ? "configured" : "not set (optional)",
      evThreshold: process.env.EV_THRESHOLD || "4 (default)",
      minOdds: process.env.MIN_ODDS || "1.8 (default)",
      inplayTrigger: process.env.INPLAY_TRIGGER !== "false" ? "ON" : "OFF",
      inplayMinute: process.env.INPLAY_MINUTE || "55 (default)",
    },
  }), {
    headers: { "Content-Type": "application/json" },
  });
}
