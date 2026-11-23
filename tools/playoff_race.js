#!/usr/bin/env node
// The playoff race after one finished regular-season week: who has clinched, who is out, who can do
// either next week (and exactly what they need), and the state of the race for the last spots.
//
//   node tools/playoff_race.js <week>                 current season, remaining schedule from Sleeper
//   node tools/playoff_race.js <week> --season 2025   a finished season (schedule from games.json), for testing
//
// Run from the repo root, AFTER tools/weekly_update.py has added that week. Recap use only: nothing
// here feeds the dashboard.
//
// How it decides: every possible win/loss combination of the remaining games is tried, so "clinched"
// and "eliminated" are certainties, not estimates. Level teams are settled by points for (league
// rule), which can still change, so both are judged on RECORD ALONE -- clinched means in even if the
// team loses every tiebreaker, eliminated means out even if it wins every one. (Trying only wins and
// losses is still exact when a game could be tied: the season has no half-wins unless one has already
// happened, in which case the tool says so.)
// "Coin-flip" percentages are NOT a forecast: every remaining game counted 50/50, ties broken by
// points for SO FAR. Use them only for the shape of the race, and label them if they're quoted.
const fs = require('fs');

// games: [{ week, a, b }] still to play. wins: { manager: wins }. spots: playoff teams.
// Returns, per manager, flags over all outcomes and over each outcome of the next week's games.
function analyzeRace({ managers, wins, pf, games, spots }) {
  const n = managers.length, idx = {}; managers.forEach((m, i) => { idx[m] = i; });
  const nextWeek = games.length ? Math.min(...games.map(g => g.week)) : null;
  const ordered = [...games.filter(g => g.week === nextWeek), ...games.filter(g => g.week !== nextWeek)];
  const k = games.filter(g => g.week === nextWeek).length, G = ordered.length;
  if (G > 24) throw new Error(`${G} games left is too many to try every outcome (max 24)`);
  const A = ordered.map(g => idx[g.a]), B = ordered.map(g => idx[g.b]);
  const base = managers.map(m => wins[m]), pts = managers.map(m => pf[m]);
  const K = 1 << k, M = Math.pow(2, G - k);
  // per next-week outcome, per team: always in on record / always out on record
  const allIn = Array.from({ length: n }, () => new Uint8Array(K).fill(1));
  const allOut = Array.from({ length: n }, () => new Uint8Array(K).fill(1));
  const flips = new Float64Array(n);
  const w = new Float64Array(n), w0 = new Float64Array(n);
  for (let q = 0; q < K; q++) {
    for (let i = 0; i < n; i++) w0[i] = base[i];
    for (let g = 0; g < k; g++) w0[(q >> g) & 1 ? B[g] : A[g]]++;
    for (let r = 0; r < M; r++) {
      w.set(w0);
      for (let g = k; g < G; g++) w[(r >> (g - k)) & 1 ? B[g] : A[g]]++;
      for (let t = 0; t < n; t++) {
        let above = 0, level = 0, levelBetterPf = 0;
        for (let o = 0; o < n; o++) {
          if (o === t) continue;
          if (w[o] > w[t]) above++;
          else if (w[o] === w[t]) { level++; if (pts[o] > pts[t]) levelBetterPf++; }
        }
        if (above + level >= spots) allIn[t][q] = 0;
        if (above < spots) allOut[t][q] = 0;
        if (above + levelBetterPf < spots) flips[t]++;
      }
    }
  }
  const total = K * M;
  const next = ordered.slice(0, k);
  // Smallest set of OTHER next-week results that, with this team's own result, makes flag[q] true
  // in every remaining case. Returns all the smallest sets, or [] if there is none.
  const need = (flag, own, ownBit) => {
    let best = [], size = Infinity;
    const others = next.map((_, g) => g).filter(g => g !== own);
    for (let c = 0; c < Math.pow(3, others.length); c++) {
      const fix = []; let x = c;
      others.forEach(g => { const v = x % 3; x = Math.floor(x / 3); if (v) fix.push([g, v - 1]); });
      if (fix.length > size) continue;
      let ok = true;
      for (let q = 0; q < K && ok; q++) {
        if (own >= 0 && ((q >> own) & 1) !== ownBit) continue;
        if (fix.some(([g, v]) => ((q >> g) & 1) !== v)) continue;
        if (!flag[q]) ok = false;
      }
      if (!ok) continue;
      if (fix.length < size) { best = []; size = fix.length; }
      best.push(fix.map(([g, v]) => (v ? next[g].b : next[g].a)));
    }
    return best;
  };
  const rows = managers.map((m, t) => {
    const own = next.findIndex(g => g.a === m || g.b === m);
    const winBit = own >= 0 ? (next[own].a === m ? 0 : 1) : 0;
    const every = f => f.every(x => x === 1);
    return {
      manager: m, opponent: own < 0 ? null : (next[own].a === m ? next[own].b : next[own].a),
      clinched: every(allIn[t]), eliminated: every(allOut[t]), coinFlip: flips[t] / total,
      clinchWithWin: need(allIn[t], own, winBit), clinchWithLoss: need(allIn[t], own, 1 - winBit),
      outWithLoss: need(allOut[t], own, 1 - winBit), outWithWin: need(allOut[t], own, winBit),
    };
  });
  return { nextWeek, outcomes: total, rows };
}

module.exports = { analyzeRace };
if (require.main !== module) return;

(async () => {
  const { loadDashboard } = require('./lib/dashboard');
  const args = process.argv.slice(2);
  const week = Number(args[0]);
  const testSeason = args.includes('--season') ? Number(args[args.indexOf('--season') + 1]) : null;
  if (!week) { console.error('usage: node tools/playoff_race.js <week> [--season YYYY]'); process.exit(2); }
  const dash = loadDashboard({
    consts: ['SLEEPER_USERNAME_TO_MANAGER', 'CURRENT_SEASON', 'SLEEPER_LEAGUE_ID'],
    functions: ['fetchSleeperJson', 'recordStr'],
  });
  const season = testSeason || dash.CURRENT_SEASON.year;
  const reg = dash.GAMES.filter(g => g.season === season && g.type === 'regular');
  if (!reg.some(g => g.week === week)) { console.error(`Week ${week} of ${season} isn't in games.json as a regular-season week -- run tools/weekly_update.py ${week} first`); process.exit(1); }

  let spots = 8, lastWeek, games = [];
  if (testSeason) {
    lastWeek = Math.max(...reg.map(g => g.week));
    games = reg.filter(g => g.week > week).map(g => ({ week: g.week, a: g.mA, b: g.mB }));
  } else {
    const L = `league/${dash.SLEEPER_LEAGUE_ID}`;
    const [league, users, rosters] = await Promise.all([L, `${L}/users`, `${L}/rosters`].map(p => dash.fetchSleeperJson(p)));
    spots = league.settings.playoff_teams; lastWeek = league.settings.playoff_week_start - 1;
    const u = {}; users.forEach(x => { u[x.user_id] = dash.SLEEPER_USERNAME_TO_MANAGER[x.display_name] || x.display_name; });
    const mgr = {}; rosters.forEach(r => { mgr[r.roster_id] = u[r.owner_id]; });
    for (let w = week + 1; w <= lastWeek; w++) {
      const by = {}; (await dash.fetchSleeperJson(`${L}/matchups/${w}`)).forEach(r => { (by[r.matchup_id] = by[r.matchup_id] || []).push(mgr[r.roster_id]); });
      const pairs = Object.values(by);
      if (pairs.length !== 6 || pairs.some(p => p.length !== 2)) throw new Error(`Week ${w}'s schedule in Sleeper isn't 6 pairs`);
      pairs.forEach(([a, b]) => games.push({ week: w, a, b }));
    }
  }

  const T = {};
  const row = m => (T[m] = T[m] || { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
  reg.filter(g => g.week <= week).forEach(g => [[g.mA, g.sA, g.sB], [g.mB, g.sB, g.sA]].forEach(([m, s, o]) => {
    const r = row(m); r[s > o ? 'w' : s < o ? 'l' : 't']++; r.pf += s; r.pa += o;
  }));
  const managers = Object.keys(T), wins = {}, pf = {};
  managers.forEach(m => { wins[m] = T[m].w + T[m].t / 2; pf[m] = Math.round(T[m].pf * 100) / 100; });
  managers.sort((a, b) => wins[b] - wins[a] || pf[b] - pf[a]);

  console.log(`=== ${season} PLAYOFF RACE AFTER WEEK ${week} (${spots} spots, last regular-season week: ${lastWeek}) ===`);
  if (managers.some(m => T[m].t)) console.log('NOTE: a game has been tied this season, so wins include half-wins -- check the clinching lines by hand.');
  if (!games.length) {
    managers.forEach((m, i) => console.log(`  ${i + 1}. ${m} ${dash.recordStr(T[m].w, T[m].l, T[m].t)} PF ${pf[m].toFixed(2)} ${i < spots ? 'IN' : 'OUT'}`));
    console.log('  Regular season over: final order by record, then points for.');
    return;
  }
  const race = analyzeRace({ managers, wins, pf, games, spots });
  const by = {}; race.rows.forEach(r => { by[r.manager] = r; });
  const line8 = wins[managers[spots - 1]], line9 = wins[managers[spots]];
  managers.forEach((m, i) => {
    const r = by[m];
    const gap = i < spots ? `${(wins[m] - line9).toFixed(1).replace('.0', '')} up on 9th` : `${(line8 - wins[m]).toFixed(1).replace('.0', '')} behind 8th`;
    const left = games.filter(g => g.a === m || g.b === m).map(g => (g.a === m ? g.b : g.a).split(' ')[0]).join(', ');
    console.log(`  ${String(i + 1).padStart(2)}. ${m.padEnd(16)} ${dash.recordStr(T[m].w, T[m].l, T[m].t).padEnd(6)} PF ${pf[m].toFixed(2).padStart(8)}  ${gap.padEnd(14)} ${r.clinched ? 'CLINCHED' : r.eliminated ? 'ELIMINATED' : `coin-flip ${r.coinFlip > 0.999 ? ">99.9" : r.coinFlip < 0.001 ? "<0.1" : (100 * r.coinFlip).toFixed(1)}%`}  left: ${left}`);
    if (i === spots - 1) console.log('  ---------------- playoff line ----------------');
  });

  const say = sets => (sets[0].length ? ` AND ${sets.map(s => '[' + s.map(x => x + ' win').join(' + ') + ']').slice(0, 6).join(' or ')}${sets.length > 6 ? ` (+${sets.length - 6} more)` : ''}` : '');
  console.log(`\n=== WHAT CAN BE SETTLED IN WEEK ${race.nextWeek} (record alone; smallest sets of results) ===`);
  let any = false;
  managers.forEach(m => {
    const r = by[m]; if (r.clinched || r.eliminated) return;
    [['clinchWithWin', 'CLINCHES with a win'], ['clinchWithLoss', 'CLINCHES even with a loss'], ['outWithLoss', 'ELIMINATED with a loss'], ['outWithWin', 'ELIMINATED even with a win']].forEach(([key, text]) => {
      if (r[key].length) { any = true; console.log(`  ${m} (vs ${r.opponent}): ${text}${say(r[key])}`); }
    });
  });
  if (!any) console.log('  Nothing: no team can clinch or be eliminated on record next week.');

  console.log(`\n=== REMAINING SCHEDULE ===`);
  for (let w = week + 1; w <= lastWeek; w++) console.log(`  Week ${w}: ${games.filter(g => g.week === w).map(g => `${g.a} v ${g.b}`).join(' | ')}`);
  console.log(`\n(${race.outcomes.toLocaleString()} win/loss outcomes tried. Coin-flip % is not a forecast: every game 50/50, level teams split by points for so far.)`);
})().catch(e => { console.error(e.message); process.exit(1); });
