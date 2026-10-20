#!/usr/bin/env node
// Prints the verified facts a weekly recap is written from, for one finished week of the
// current season. Run AFTER tools/weekly_update.py has added that week.
//
//   node tools/recap_facts.js <week> <cache-dir>
//
// Run from the repo root. Everything comes from Sleeper or from the dashboard's own code
// (loaded out of index.html by tools/lib/dashboard.js, so it can't drift from the page):
//   - each matchup's final score, every starter's points, and the best bench players
//   - the all-time series for each pairing, after this week
//   - standings and Power Rankings movement vs. the previous week
//   - the week's matchup lines: the snapshot saved before kickoff (data/lines.json) if there is
//     one; otherwise a replay with Sleeper's current projections, which can differ slightly from
//     what the page showed -- quote favourites/ranges, not exact spreads, in that case
//   - season highs and lows
// Sleeper's Weekly Report (league-chat awards) isn't in the API: that still comes from the person.
// NFL results: ESPN rejects scripts from some networks; fetch them in the browser instead.
const fs = require('fs');
const path = require('path');
const { loadDashboard } = require('./lib/dashboard');

const week = Number(process.argv[2]);
const cache = process.argv[3];
if (!week || !cache) { console.error('usage: node tools/recap_facts.js <week> <cache-dir>'); process.exit(2); }
fs.mkdirSync(cache, { recursive: true });

const dash = loadDashboard({
  consts: ['PTS_ALLOW_TIERS', 'SLEEPER_USERNAME_TO_MANAGER', 'CURRENT_SEASON', 'SLEEPER_LEAGUE_ID', 'LINE_MODEL'],
  functions: ['leaguePoints', 'normalCdf', 'fairMoneyline', 'h2hRecord', 'fetchSleeperJson', 'computeMatchupLines',
    'tiesFor', 'winPctOf', 'recordStr', 'scorePowerRankingRows', 'computePowerRankingsThroughWeek'],
});
const ALL_GAMES = dash.GAMES;

async function playersDb() {
  const f = path.join(cache, 'players_nfl.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, await (await dash.fetch('https://api.sleeper.app/v1/players/nfl')).text());
  return JSON.parse(fs.readFileSync(f));
}

(async () => {
  const season = dash.CURRENT_SEASON.year;
  if (!ALL_GAMES.some(g => g.season === season && g.week === week)) {
    console.error(`Week ${week} isn't in games.json yet -- run tools/weekly_update.py ${week} first`); process.exit(1);
  }
  const P = await playersDb();
  const label = id => {
    const p = P[id];
    if (!p) return id;
    return `${p.full_name || `${p.first_name} ${p.last_name}`} (${p.position}${p.team ? ', ' + p.team : ''})`;
  };
  const [users, rosters, matchups] = await Promise.all(['users', 'rosters', `matchups/${week}`].map(x => dash.fetchSleeperJson(`league/${dash.SLEEPER_LEAGUE_ID}/${x}`)));
  const uname = {}; users.forEach(u => { uname[u.user_id] = dash.SLEEPER_USERNAME_TO_MANAGER[u.display_name] || u.display_name; });
  const mgr = {}; rosters.forEach(r => { mgr[r.roster_id] = uname[r.owner_id]; });
  const byM = {}; matchups.forEach(r => { if (r.matchup_id != null) (byM[r.matchup_id] = byM[r.matchup_id] || []).push(r); });
  const pairs = Object.keys(byM).sort((a, b) => a - b).map(k => byM[k]);

  console.log(`=== ${season} WEEK ${week}: MATCHUPS ===`);
  pairs.forEach(pair => pair.forEach(r => {
    const starters = (r.starters || []).map((id, i) => `${label(id)} ${(r.starters_points[i] || 0).toFixed(1)}`);
    const bench = (r.players || []).filter(id => !(r.starters || []).includes(id))
      .map(id => [id, (r.players_points || {})[id] || 0]).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, pts]) => `${label(id)} ${pts.toFixed(1)}`);
    console.log(`\n[${r.matchup_id}] ${mgr[r.roster_id]} ${r.points.toFixed(2)}`);
    console.log(`  starters: ${starters.join(', ')}`);
    console.log(`  best bench: ${bench.join(', ')}`);
  }));

  console.log(`\n=== ALL-TIME SERIES AFTER WEEK ${week} ===`);
  pairs.forEach(([a, b]) => {
    const r = dash.h2hRecord(mgr[a.roster_id], mgr[b.roster_id], 'all');
    console.log(`  ${mgr[a.roster_id]} ${dash.recordStr(r.w1, r.w2, r.ties)} vs ${mgr[b.roster_id]} (${r.games.length} meetings)`);
  });

  console.log(`\n=== STANDINGS + POWER RANKINGS (moves vs. Week ${week - 1}) ===`);
  const now = dash.computePowerRankingsThroughWeek(season, week);
  if (!now) {
    console.log('  (not available for this week -- playoff weeks, or a regular-season week missing from games.json)');
  } else {
    const prevRows = week > 1 ? dash.computePowerRankingsThroughWeek(season, week - 1) : null;
    const prev = prevRows ? prevRows.map(r => r.manager) : null;
    now.forEach((r, i) => {
      const d = prev ? prev.indexOf(r.manager) - i : 0;
      console.log(`  ${String(i + 1).padStart(2)}. ${r.manager.padEnd(16)} ${dash.recordStr(r.wins, r.losses, r.ties).padEnd(6)} PF ${r.ptsFor.toFixed(1)}  ${!prev ? '' : d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '—'}`);
    });
  }

  const savedAll = fs.existsSync('data/lines.json') ? JSON.parse(fs.readFileSync('data/lines.json')) : {};
  const snap = savedAll[season] && savedAll[season][week];
  let lines;
  if (snap) {
    console.log(`\n=== MATCHUP LINES: SAVED BEFORE KICKOFF (${snap.takenAt}, ${snap.note}) -- quote these exactly ===`);
    lines = snap.games;
  } else {
    console.log(`\n=== MATCHUP LINES, REPLAYED (no saved snapshot; current projections, H2H before Week ${week}) ===`);
    dash.GAMES = ALL_GAMES.filter(g => g.season < season || g.week < week);
    lines = await dash.computeMatchupLines(week, pairs, mgr);
    dash.GAMES = ALL_GAMES;
  }
  let favWins = 0;
  pairs.forEach(([a, b]) => {
    const A = mgr[a.roster_id], B = mgr[b.roster_id];
    const l = lines.find(x => (x.mA === A && x.mB === B) || (x.mA === B && x.mB === A));
    const winner = a.points > b.points ? A : b.points > a.points ? B : null; // null = a tie
    if (l && l.favourite === winner) favWins++;
    const text = l ? `${l.favourite ? `${l.favourite} −${l.spread}` : 'Pick’em'} · Win ${l.mA} ${l.winA}% / ${l.mB} ${l.winB}% · O/U ${l.total}` : '(no line)';
    console.log(`  ${A} ${a.points.toFixed(2)}-${b.points.toFixed(2)} ${B} | ${text}${!winner ? '  <-- TIE' : l && l.favourite && l.favourite !== winner ? '  <-- UPSET' : ''}`);
  });
  console.log(`  favourites won ${favWins} of ${pairs.length}`);

  const scores = ALL_GAMES.filter(g => g.season === season && g.week <= week).flatMap(g => [[g.sA, g.mA, g.week], [g.sB, g.mB, g.week]]).sort((a, b) => b[0] - a[0]);
  console.log(`\n=== ${season} SEASON CONTEXT (through Week ${week}) ===`);
  console.log(`  highest scores so far: ${scores.slice(0, 3).map(([s, m, w]) => `${s} ${m} (Wk ${w})`).join(', ')}`);
  console.log(`  lowest scores so far:  ${scores.slice(-3).reverse().map(([s, m, w]) => `${s} ${m} (Wk ${w})`).join(', ')}`);
})().catch(e => { console.error(e.message); process.exit(1); });
