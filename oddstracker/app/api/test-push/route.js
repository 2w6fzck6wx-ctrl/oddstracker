// app/api/test-push/route.js
// Visit yoursite.vercel.app/api/test-push to send a test notification

export async function GET() {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;

  if (!token || !user) {
    return new Response(JSON.stringify({
      error: "Pushover not configured. Set PUSHOVER_TOKEN and PUSHOVER_USER in Vercel environment variables.",
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        user,
        title: "OddsTracker TEST",
        message: "Push-notiser fungerar! Du kommer fa alerts har nar value bets hittas.",
        sound: "cashregister",
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({
      ok: true,
      message: "Test-notis skickad! Kolla din telefon.",
      pushoverResponse: data,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
