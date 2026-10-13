#!/usr/bin/env node
// Prints the verified facts a weekly recap is written from, for one finished week of the
// current season. Run AFTER tools/weekly_update.py has added that week.
//
//   node tools/recap_facts.js <week> <cache-dir>
//
// Run from the repo root. Everything comes from Sleeper or from the dashboard's own code
// (extracted from index.html, so it can't drift from what the page shows):
//   - each matchup's final score, every starter's points, and the best bench players
//   - the all-time series for each pairing, after this week
//   - standings and Power Rankings movement vs. the previous week (computePowerRankingsThroughWeek)
//   - the dashboard's matchup lines replayed for the week (renderMatchupLines, H2H cut off before
//     the week). Uses Sleeper's projections as they stand now, so it can differ slightly from
//     what the page showed before kickoff -- quote favourites/ranges, not exact spreads.
// Sleeper's Weekly Report (league-chat awards) isn't in the API: that still comes from the person.
// NFL results: ESPN rejects scripts from some networks; fetch them in the browser instead.
const fs = require('fs');
const path = require('path');

const week = Number(process.argv[2]);
const cache = process.argv[3];
if (!week || !cache) { console.error('usage: node tools/recap_facts.js <week> <cache-dir>'); process.exit(2); }
fs.mkdirSync(cache, { recursive: true });

const html = fs.readFileSync('index.html', 'utf8');
const grab = (a, b) => { const s = html.indexOf(a); if (s < 0) throw new Error('index.html is missing ' + a); return html.slice(s, html.indexOf(b, s) + b.length); };
const fn = (n, pre = 'function ') => { const s = html.indexOf(pre + n + '('); if (s < 0) throw new Error('index.html is missing ' + n); return html.slice(s, html.indexOf('\n}\n', s) + 3); };
const ALL_GAMES = JSON.parse(fs.readFileSync('data/games.json'));
var RAW = JSON.parse(fs.readFileSync('data/raw.json'));
var GAMES = ALL_GAMES;
eval([grab('const PTS_ALLOW_TIERS = [', '];\n'), fn('leaguePoints'), grab('const SLEEPER_USERNAME_TO_MANAGER = {', '};\n'),
  grab('const CURRENT_SEASON = {', '\n};\n'), grab('const SLEEPER_LEAGUE_ID =', ';\n'), grab('const LINE_MODEL =', ';\n'),
  fn('normalCdf'), fn('fairMoneyline'), fn('h2hRecord'), fn('fetchSleeperJson', 'async function '), fn('renderMatchupLines', 'async function '),
  fn('tiesFor'), fn('winPctOf'), fn('recordStr'), fn('scorePowerRankingRows'), fn('computePowerRankingsThroughWeek')]
  .join('\n').replace(/^const /gm, 'var '));
var managers = [...new Set(RAW.map(d => d.manager))].sort();

// api.sleeper.* rejects some default script user-agents
const realFetch = global.fetch;
global.fetch = (u, o) => realFetch(u, { ...(o || {}), headers: { 'User-Agent': 'Mozilla/5.0' } });

async function playersDb() {
  const f = path.join(cache, 'players_nfl.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, await (await fetch('https://api.sleeper.app/v1/players/nfl')).text());
  return JSON.parse(fs.readFileSync(f));
}

(async () => {
  const season = CURRENT_SEASON.year;
  if (!ALL_GAMES.some(g => g.season === season && g.week === week)) {
    console.error(`Week ${week} isn't in games.json yet -- run tools/weekly_update.py ${week} first`); process.exit(1);
  }
  const P = await playersDb();
  const label = id => {
    const p = P[id];
    if (!p) return id;
    return `${p.full_name || `${p.first_name} ${p.last_name}`} (${p.position}${p.team ? ', ' + p.team : ''})`;
  };
  const [users, rosters, matchups] = await Promise.all(['users', 'rosters', `matchups/${week}`].map(x => fetchSleeperJson(`league/${SLEEPER_LEAGUE_ID}/${x}`)));
  const uname = {}; users.forEach(u => { uname[u.user_id] = SLEEPER_USERNAME_TO_MANAGER[u.display_name] || u.display_name; });
  const mgr = {}; rosters.forEach(r => { mgr[r.roster_id] = uname[r.owner_id]; });
  const byM = {}; matchups.forEach(r => (byM[r.matchup_id] = byM[r.matchup_id] || []).push(r));
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
    const r = h2hRecord(mgr[a.roster_id], mgr[b.roster_id], 'all');
    console.log(`  ${mgr[a.roster_id]} ${recordStr(r.w1, r.w2, r.ties)} vs ${mgr[b.roster_id]} (${r.games.length} meetings)`);
  });

  console.log(`\n=== STANDINGS + POWER RANKINGS (moves vs. Week ${week - 1}) ===`);
  const prev = week > 1 ? computePowerRankingsThroughWeek(season, week - 1).map(r => r.manager) : null;
  computePowerRankingsThroughWeek(season, week).forEach((r, i) => {
    const d = prev ? prev.indexOf(r.manager) - i : 0;
    console.log(`  ${String(i + 1).padStart(2)}. ${r.manager.padEnd(16)} ${recordStr(r.wins, r.losses, r.ties).padEnd(6)} PF ${r.ptsFor.toFixed(1)}  ${!prev ? '' : d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '—'}`);
  });

  console.log(`\n=== MATCHUP LINES, REPLAYED (H2H before Week ${week}) ===`);
  GAMES = ALL_GAMES.filter(g => g.season < season || g.week < week);
  const out = {};
  global.document = { querySelector: s => (out[s.match(/\d+/)[0]] = out[s.match(/\d+/)[0]] || {}), getElementById: () => ({ style: {} }) };
  await renderMatchupLines(week, pairs, mgr);
  let favWins = 0;
  pairs.forEach(([a, b], i) => {
    const line = (out[i].innerHTML || '').replace(/<[^>]+>/g, '');
    const fav = (line.match(/Line: (.+?) −/) || [])[1];
    const winner = a.points > b.points ? mgr[a.roster_id] : mgr[b.roster_id];
    if (fav === winner) favWins++;
    console.log(`  ${mgr[a.roster_id]} ${a.points.toFixed(2)}-${b.points.toFixed(2)} ${mgr[b.roster_id]} | ${line}${fav && fav !== winner ? '  <-- UPSET' : ''}`);
  });
  console.log(`  favourites won ${favWins} of ${pairs.length}`);

  const scores = ALL_GAMES.filter(g => g.season === season).flatMap(g => [[g.sA, g.mA, g.week], [g.sB, g.mB, g.week]]).sort((a, b) => b[0] - a[0]);
  console.log(`\n=== ${season} SEASON CONTEXT ===`);
  console.log(`  highest scores so far: ${scores.slice(0, 3).map(([s, m, w]) => `${s} ${m} (Wk ${w})`).join(', ')}`);
  console.log(`  lowest scores so far:  ${scores.slice(-3).reverse().map(([s, m, w]) => `${s} ${m} (Wk ${w})`).join(', ')}`);
})().catch(e => { console.error(e.message); process.exit(1); });
