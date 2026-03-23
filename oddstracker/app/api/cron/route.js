// app/api/cron/route.js
// This runs on Vercel's servers every 5 minutes via vercel.json cron config
// No browser needed - fully server-side

export const runtime = "edge";
export const maxDuration = 30;

const LEAGUES = [
  "soccer_epl", "soccer_spain_la_liga", "soccer_germany_bundesliga",
  "soccer_italy_serie_a", "soccer_france_ligue_one", "soccer_uefa_champs_league",
  "soccer_sweden_allsvenskan", "soccer_sweden_superettan",
  "icehockey_nhl", "icehockey_sweden_hockey_league",
];

const LEAGUE_NAMES = {
  soccer_epl: "Premier League", soccer_spain_la_liga: "La Liga",
  soccer_germany_bundesliga: "Bundesliga", soccer_italy_serie_a: "Serie A",
  soccer_france_ligue_one: "Ligue 1", soccer_uefa_champs_league: "Champions League",
  soccer_sweden_allsvenskan: "Allsvenskan", soccer_sweden_superettan: "Superettan",
  icehockey_nhl: "NHL", icehockey_sweden_hockey_league: "SHL",
};

function removeVig(home, draw, away) {
  const h = home > 1 ? 1 / home : 0;
  const d = draw && draw > 1 ? 1 / draw : 0;
  const a = away > 1 ? 1 / away : 0;
  const t = h + d + a;
  if (!t) return { home: 33.3, draw: 33.3, away: 33.3 };
  return { home: (h / t) * 100, draw: (d / t) * 100, away: (a / t) * 100 };
}

function calcEV(trueProb, odds) {
  if (!odds || odds <= 1 || !trueProb) return 0;
  return ((trueProb / 100) * odds - 1) * 100;
}

async function fetchOdds(sportKey, apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=eu,uk&markets=h2h,totals&oddsFormat=decimal&bookmakers=pinnacle,bet365,unibet,betfair,williamhill,bwin,nordicbet,betsson,coolbet,unibet_se`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.message) return [];
  return data;
}

async function fetchScores(sportKey, apiKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function analyzeMatch(event, leagueId, scores, settings) {
  const isSoccer = leagueId.startsWith("soccer");
  const home = event.home_team, away = event.away_team;
  const alerts = [];

  // Parse bookmaker odds
  const h2hOdds = [];
  const totalsOdds = [];
  for (const bm of (event.bookmakers || [])) {
    for (const mkt of (bm.markets || [])) {
      if (mkt.key === "h2h") {
        const ho = mkt.outcomes.find(o => o.name === home);
        const ao = mkt.outcomes.find(o => o.name === away);
        const dr = mkt.outcomes.find(o => o.name === "Draw");
        if (ho && ao) h2hOdds.push({ name: bm.key, isPinny: bm.key === "pinnacle", home: ho.price, draw: dr?.price || null, away: ao.price });
      }
      if (mkt.key === "totals") {
        const ov = mkt.outcomes.find(o => o.name === "Over");
        const un = mkt.outcomes.find(o => o.name === "Under");
        if (ov && un) totalsOdds.push({ name: bm.key, isPinny: bm.key === "pinnacle", over: ov.price, under: un.price, point: ov.point || 2.5 });
      }
    }
  }

  if (!h2hOdds.length) return alerts;

  const pinny = h2hOdds.find(b => b.isPinny) || h2hOdds[0];
  const trueProbs = removeVig(pinny.home, pinny.draw, pinny.away);

  // 1X2 Value Bets
  for (const bm of h2hOdds) {
    if (bm.isPinny) continue;
    const checks = [
      { side: "home", team: home, odds: bm.home, tp: trueProbs.home },
      { side: "away", team: away, odds: bm.away, tp: trueProbs.away },
    ];
    if (bm.draw) checks.push({ side: "draw", team: "Oavgjort", odds: bm.draw, tp: trueProbs.draw });

    for (const c of checks) {
      const ev = calcEV(c.tp, c.odds);
      if (ev >= settings.evThreshold && c.odds >= settings.minOdds && c.odds <= settings.maxOdds) {
        alerts.push({
          type: "value", market: "1X2", league: LEAGUE_NAMES[leagueId] || leagueId,
          home, away, team: c.team, side: c.side, odds: c.odds,
          ev: Math.round(ev * 10) / 10, bm: bm.name,
          trueProb: Math.round(c.tp * 10) / 10,
        });
      }
    }
  }

  // O/U Value Bets
  if (totalsOdds.length && settings.notifyOU) {
    const pinnyTotals = totalsOdds.find(b => b.isPinny) || totalsOdds[0];
    const oProb = 1 / pinnyTotals.over, uProb = 1 / pinnyTotals.under;
    const oTotal = oProb + uProb;
    const ouTrue = { over: (oProb / oTotal) * 100, under: (uProb / oTotal) * 100 };

    for (const t of totalsOdds) {
      if (t.isPinny) continue;
      const evO = calcEV(ouTrue.over, t.over);
      if (evO >= settings.evThreshold && t.over >= settings.minOddsOU) {
        alerts.push({
          type: "value", market: "O/U", league: LEAGUE_NAMES[leagueId] || leagueId,
          home, away, team: `Oe${t.point}`, side: "over", odds: t.over,
          ev: Math.round(evO * 10) / 10, bm: t.name,
          trueProb: Math.round(ouTrue.over * 10) / 10,
        });
      }
    }

    // O2.5 threshold trigger
    if (ouTrue.over >= settings.ouThreshold) {
      const bestOver = Math.max(...totalsOdds.map(t => t.over));
      if (bestOver >= settings.minOddsOU) {
        alerts.push({
          type: "ou_trigger", market: "O/U", league: LEAGUE_NAMES[leagueId] || leagueId,
          home, away, team: `Oe${pinnyTotals.point}`,
          odds: Math.round(bestOver * 100) / 100,
          prob: Math.round(ouTrue.over * 10) / 10,
          reason: `Oe${pinnyTotals.point} sannolikhet ${Math.round(ouTrue.over)}% @ ${bestOver.toFixed(2)}`,
        });
      }
    }
  }

  // In-play trigger: 0-0 after X minutes
  if (settings.inplayTrigger && isSoccer) {
    const elapsed = Math.floor((Date.now() - new Date(event.commence_time).getTime()) / 60000);
    if (elapsed >= settings.inplayMinute && elapsed <= 95) {
      // Check score
      const scoreEntry = (scores || []).find(s => s.id === event.id);
      if (scoreEntry && scoreEntry.scores) {
        const hs = scoreEntry.scores.find(s => s.name === home);
        const as2 = scoreEntry.scores.find(s => s.name === away);
        const homeGoals = parseInt(hs?.score) || 0;
        const awayGoals = parseInt(as2?.score) || 0;
        const totalGoals = homeGoals + awayGoals;

        if (totalGoals <= settings.inplayScoreMax) {
          alerts.push({
            type: "inplay", market: "IN-PLAY", league: LEAGUE_NAMES[leagueId] || leagueId,
            home, away, minute: elapsed, score: `${homeGoals}-${awayGoals}`,
            reason: `${homeGoals}-${awayGoals} efter ${elapsed}' - Oe1.5 trigger`,
          });
        }
      }
    }
  }

  return alerts;
}

async function sendPushover(alerts, pushoverKey, pushoverUser) {
  if (!pushoverKey || !pushoverUser || !alerts.length) return;

  // Group alerts into one message (max 3 shown, then summary)
  const top = alerts.slice(0, 5);
  let message = top.map(a => {
    if (a.type === "value") return `${a.team} @ ${a.odds} (${a.bm}) +${a.ev}% EV [${a.league}]`;
    if (a.type === "inplay") return `IN-PLAY: ${a.home} vs ${a.away} ${a.reason}`;
    if (a.type === "ou_trigger") return `Oe/U: ${a.home} vs ${a.away} ${a.reason}`;
    return `${a.home} vs ${a.away}`;
  }).join("\n");

  if (alerts.length > 5) message += `\n+${alerts.length - 5} fler alerts`;

  const title = alerts.length === 1
    ? (alerts[0].type === "inplay" ? "IN-PLAY TRIGGER" : `VALUE: +${alerts[0].ev}% EV`)
    : `${alerts.length} nya alerts`;

  try {
    await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: pushoverKey,
        user: pushoverUser,
        title,
        message,
        sound: "cashregister",
        priority: alerts.some(a => a.ev >= 8 || a.type === "inplay") ? 1 : 0,
      }),
    });
  } catch (e) {
    console.error("Pushover error:", e);
  }
}

async function saveToSupabase(alerts, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey || !alerts.length) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/alerts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(alerts.map(a => ({
        ...a,
        created_at: new Date().toISOString(),
      }))),
    });
  } catch (e) {
    console.error("Supabase error:", e);
  }
}

export async function GET(request) {
  // Verify this is called by Vercel Cron (or manual trigger)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "No ODDS_API_KEY" }), { status: 500 });

  // Settings from environment variables
  const settings = {
    evThreshold: parseFloat(process.env.EV_THRESHOLD || "4"),
    minOdds: parseFloat(process.env.MIN_ODDS || "1.8"),
    maxOdds: parseFloat(process.env.MAX_ODDS || "8"),
    notifyOU: process.env.NOTIFY_OU !== "false",
    minOddsOU: parseFloat(process.env.MIN_ODDS_OU || "1.8"),
    ouThreshold: parseFloat(process.env.OU_THRESHOLD || "55"),
    inplayTrigger: process.env.INPLAY_TRIGGER !== "false",
    inplayMinute: parseInt(process.env.INPLAY_MINUTE || "55"),
    inplayScoreMax: parseInt(process.env.INPLAY_SCORE_MAX || "0"),
  };

  let allAlerts = [];
  let leaguesScanned = 0;

  for (const leagueId of LEAGUES) {
    try {
      const [odds, scores] = await Promise.all([
        fetchOdds(leagueId, apiKey),
        fetchScores(leagueId, apiKey),
      ]);

      for (const event of odds) {
        const matchAlerts = analyzeMatch(event, leagueId, scores, settings);
        allAlerts = allAlerts.concat(matchAlerts);
      }
      leaguesScanned++;
    } catch (e) {
      console.error(`Error scanning ${leagueId}:`, e.message);
    }
  }

  // Deduplicate: same match + same side + same bookmaker = skip
  const seen = new Set();
  allAlerts = allAlerts.filter(a => {
    const key = `${a.home}-${a.away}-${a.side || ""}-${a.bm || ""}-${a.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by EV descending
  allAlerts.sort((a, b) => (b.ev || 0) - (a.ev || 0));

  // Send push notifications
  await sendPushover(
    allAlerts,
    process.env.PUSHOVER_TOKEN,
    process.env.PUSHOVER_USER,
  );

  // Save to Supabase (optional)
  await saveToSupabase(
    allAlerts,
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );

  return new Response(JSON.stringify({
    ok: true,
    timestamp: new Date().toISOString(),
    leaguesScanned,
    alertsFound: allAlerts.length,
    alerts: allAlerts.slice(0, 20),
  }), {
    headers: { "Content-Type": "application/json" },
  });
}
