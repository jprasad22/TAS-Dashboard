#!/usr/bin/env node
// Saves this week's matchup lines to data/lines.json BEFORE the games, so the scoreboard can show
// the line that was actually set (not one recomputed mid-game from moving projections) and the
// lines' season record is honest.
//
//   node tools/snapshot_lines.js [--week N] [--note "..."] [--force]
//
// Run from the repo root. Uses the page's own computeMatchupLines(), with Sleeper's current
// projections and lineups. Refuses to save once the main Sunday slate has started (Sunday 1:00 PM
// Eastern or later, through Wednesday -- Sleeper can still report the finished week then, e.g. when
// the app was closed Sunday and the scheduled run catches up on Tuesday) -- a "pre-game" line taken
// after kickoff would be misleading -- and won't overwrite an existing snapshot without --force.
// Scheduled to run Sunday mornings.
const fs = require('fs');
const { loadDashboard } = require('./lib/dashboard');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const force = args.includes('--force');

const dash = loadDashboard({
  consts: ['PTS_ALLOW_TIERS', 'SLEEPER_USERNAME_TO_MANAGER', 'CURRENT_SEASON', 'SLEEPER_LEAGUE_ID', 'LINE_MODEL'],
  functions: ['leaguePoints', 'normalCdf', 'fairMoneyline', 'h2hRecord', 'fetchSleeperJson', 'computeMatchupLines'],
});

(async () => {
  const state = await dash.fetchSleeperJson('state/nfl');
  const week = Number(opt('--week')) || state.week;
  const season = String(dash.CURRENT_SEASON.year);
  if (state.season_type !== 'regular' && !opt('--week')) { console.error(`NFL season type is "${state.season_type}" -- nothing to snapshot`); process.exit(1); }

  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const day = et.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday
  if (week === state.week && ((day === 0 && et.getHours() >= 13) || (day >= 1 && day <= 3)) && !force) {
    console.error('Too late: the main Sunday games have started, so this would not be a pre-game line. Nothing saved.');
    process.exit(1);
  }

  const path = 'data/lines.json';
  const saved = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
  if (saved[season] && saved[season][week] && !force) { console.error(`Week ${week} already has a saved snapshot (${saved[season][week].takenAt}); use --force to replace it.`); process.exit(1); }

  const [users, rosters, matchups] = await Promise.all(['users', 'rosters', `matchups/${week}`].map(p => dash.fetchSleeperJson(`league/${dash.SLEEPER_LEAGUE_ID}/${p}`)));
  const uname = {}; users.forEach(u => { uname[u.user_id] = dash.SLEEPER_USERNAME_TO_MANAGER[u.display_name] || u.display_name; });
  const mgr = {}; rosters.forEach(r => { mgr[r.roster_id] = uname[r.owner_id]; });
  const byM = {}; matchups.forEach(r => { if (r.matchup_id != null) (byM[r.matchup_id] = byM[r.matchup_id] || []).push(r); });
  const pairs = Object.keys(byM).sort((a, b) => a - b).map(k => byM[k]).filter(p => p.length === 2);
  if (!pairs.length) { console.error(`No Week ${week} matchups in Sleeper yet`); process.exit(1); }

  // H2H only from games before this week, as the page would have it before kickoff.
  dash.GAMES = dash.GAMES.filter(g => g.season < Number(season) || g.week < week);
  const games = await dash.computeMatchupLines(week, pairs, mgr);
  const started = pairs.filter(([a, b]) => (a.points || 0) + (b.points || 0) > 0).length;
  const note = opt('--note') || (started ? 'after the early games, before the 1 PM games' : 'before kickoff');

  saved[season] = saved[season] || {};
  saved[season][week] = { takenAt: new Date().toISOString(), note, games };
  fs.writeFileSync(path, JSON.stringify(saved, null, 1) + '\n');
  console.log(`Saved Week ${week} lines (${note}):`);
  games.forEach(l => console.log(`  ${l.mA} vs ${l.mB}: ${l.favourite ? `${l.favourite} −${l.spread}` : 'Pick’em'} · Win ${l.winA}% / ${l.winB}% · O/U ${l.total}`));
})().catch(e => { console.error(e.message); process.exit(1); });
