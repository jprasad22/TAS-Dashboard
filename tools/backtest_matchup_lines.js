#!/usr/bin/env node
// Backtests the matchup-line model (LINE_MODEL in index.html) against a finished Sleeper season.
//
//   node tools/backtest_matchup_lines.js <cache-dir>
//
// Run from the repo root. Rebuilds every 2025 game from what was known before kickoff (that week's
// Sleeper projections for the actual starters, earlier weeks' league points, GAMES for H2H), grid-
// searches the weights, and reports error / winner-accuracy for the best fit, simple baselines,
// leave-one-week-out cross-validation, and 2026 Weeks 1-2 as a small holdout. Re-run before changing
// LINE_MODEL; to re-fit on a newer season, add its league ID + weeks below.
const fs = require('fs'); const path = require('path');
const d = process.argv[2]; const repo = '.';
if (!d) { console.error('usage: node tools/backtest_matchup_lines.js <cache-dir>'); process.exit(2); }
fs.mkdirSync(d, { recursive: true });
const LEAGUES = { '25': '1253579616279330816', '26': '1358592254683402240' };
const POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(p => `position%5B%5D=${p}`).join('&');
async function download() {
  const jobs = [];
  const add = (f, u) => { if (!fs.existsSync(path.join(d, f))) jobs.push([f, u]); };
  add('league26.json', `https://api.sleeper.app/v1/league/${LEAGUES['26']}`);
  for (const [tag, weeks] of [['25', 17], ['26', 2]]) {
    const season = 2000 + Number(tag);
    add(`users${tag}.json`, `https://api.sleeper.app/v1/league/${LEAGUES[tag]}/users`);
    add(`rosters${tag}.json`, `https://api.sleeper.app/v1/league/${LEAGUES[tag]}/rosters`);
    for (let w = 1; w <= weeks; w++) {
      add(`m${tag}_${w}.json`, `https://api.sleeper.app/v1/league/${LEAGUES[tag]}/matchups/${w}`);
      add(`proj${tag}_${w}.json`, `https://api.sleeper.com/projections/nfl/${season}/${w}?season_type=regular&${POS}`);
    }
  }
  for (const [f, u] of jobs) {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`${u}: HTTP ${res.status}`);
    fs.writeFileSync(path.join(d, f), await res.text());
  }
}
download().then(() => {
  const html = fs.readFileSync('index.html', 'utf8');
  const grab = (a, b) => { const s = html.indexOf(a); return html.slice(s, html.indexOf(b, s) + b.length); };
  const fn = n => { const s = html.indexOf('function ' + n + '('); return html.slice(s, html.indexOf('\n}\n', s) + 3); };
  eval([grab('const PTS_ALLOW_TIERS = [', '];\n'), fn('leaguePoints'), grab('const SLEEPER_USERNAME_TO_MANAGER = {', '};\n')].join('\n').replace(/^const /gm, 'var '));
  const GAMES = JSON.parse(fs.readFileSync('data/games.json'));
  const J = f => JSON.parse(fs.readFileSync(d + '/' + f));
  const scoring = J('league26.json').scoring_settings;

  function seasonGames(tag, weeks) {
    const users = J(`users${tag}.json`), rosters = J(`rosters${tag}.json`);
    const uname = {}; users.forEach(u => uname[u.user_id] = SLEEPER_USERNAME_TO_MANAGER[u.display_name] || u.display_name);
    const mgr = {}; rosters.forEach(r => mgr[r.roster_id] = uname[r.owner_id]);
    const M = {}, PROJ = {};
    weeks.forEach(w => { M[w] = J(`m${tag}_${w}.json`); const p = {}; J(`proj${tag}_${w}.json`).forEach(x => p[x.player_id] = leaguePoints(x.stats, scoring)); PROJ[w] = p; });
    const season = 2000 + Number(tag);
    const games = [];
    weeks.forEach(w => {
      // recent-form history: every rostered player's league points in earlier weeks (0s dropped: bye/DNP)
      const hist = {}; weeks.filter(x => x < w).forEach(x => M[x].forEach(r => Object.entries(r.players_points || {}).forEach(([pid, pts]) => { if (pts) (hist[pid] = hist[pid] || []).push([x, pts]); })));
      const teamPts = {}; weeks.filter(x => x < w).forEach(x => M[x].forEach(r => (teamPts[mgr[r.roster_id]] = teamPts[mgr[r.roster_id]] || []).push(r.points)));
      const byM = {}; M[w].forEach(r => { if (r.matchup_id) (byM[r.matchup_id] = byM[r.matchup_id] || []).push(r); });
      Object.values(byM).filter(p => p.length === 2).forEach(([a, b]) => {
        const feat = r => {
          const starters = (r.starters || []).filter(pid => pid && pid !== '0');
          const P = starters.reduce((n, pid) => n + (PROJ[w][pid] || 0), 0);
          const form = k => starters.reduce((n, pid) => { const h = (hist[pid] || []).filter(([x]) => x >= w - k); return n + (h.length ? h.reduce((s, [, p]) => s + p, 0) / h.length : (PROJ[w][pid] || 0)); }, 0);
          const tp = teamPts[mgr[r.roster_id]];
          return { m: mgr[r.roster_id], P, F2: form(2), F3: form(3), F4: form(4), Fall: form(99), S: tp ? tp.reduce((x, y) => x + y, 0) / tp.length : null, actual: r.points };
        };
        const A = feat(a), B = feat(b);
        const prior = GAMES.filter(g => (g.season < season || (g.season === season && g.week < w)) && ((g.mA === A.m && g.mB === B.m) || (g.mA === B.m && g.mB === A.m)));
        const margins = prior.map(g => g.mA === A.m ? g.sA - g.sB : g.sB - g.sA);
        const H = margins.length ? margins.reduce((x, y) => x + y, 0) / margins.length : 0;
        games.push({ season, w, A, B, H, n: margins.length });
      });
    });
    return games;
  }
  const g25 = seasonGames('25', [...Array(17).keys()].map(i => i + 1));
  const g26 = seasonGames('26', [1, 2]);
  console.log('2025 games:', g25.length, '| 2026 holdout games:', g26.length);

  const exp = (t, p) => { const S = t.S == null ? t.P : t.S; return p.a * t.P + p.b * t[p.F] + (1 - p.a - p.b) * S; };
  const predMargin = (g, p) => exp(g.A, p) - exp(g.B, p) + p.d * g.H * g.n / (g.n + p.c);
  const metrics = (games, p) => { let se = 0, hit = 0, n = 0; games.forEach(g => { const pm = predMargin(g, p), am = g.A.actual - g.B.actual; se += (pm - am) ** 2; if (Math.sign(pm) === Math.sign(am)) hit++; n++; }); return { rmse: Math.sqrt(se / n), acc: hit / n }; };
  const grid = []; for (let a = 0; a <= 1.0001; a += 0.05) for (let b = 0; a + b <= 1.0001; b += 0.05) for (const F of ['F2', 'F3', 'F4', 'Fall']) for (const d of [0, 0.1, 0.2, 0.3, 0.5]) for (const c of [5, 10, 20]) grid.push({ a: +a.toFixed(2), b: +b.toFixed(2), F, d, c });
  const best = games => grid.reduce((bst, p) => { const m = metrics(games, p).rmse; return m < bst.m ? { p, m } : bst; }, { m: Infinity }).p;
  const fitAll = best(g25);
  // leave-one-week-out CV for the whole model-selection procedure
  let cvSe = 0, cvHit = 0, cvN = 0; const cvResid = [];
  for (let w = 1; w <= 17; w++) { const p = best(g25.filter(g => g.w !== w)); g25.filter(g => g.w === w).forEach(g => { const pm = predMargin(g, p), am = g.A.actual - g.B.actual; cvSe += (pm - am) ** 2; cvResid.push(pm - am); if (Math.sign(pm) === Math.sign(am)) cvHit++; cvN++; }); }
  const base = { projOnly: { a: 1, b: 0, F: 'F3', d: 0, c: 10 }, formOnly: { a: 0, b: 1, F: 'F3', d: 0, c: 10 }, seasonAvgOnly: { a: 0, b: 0, F: 'F3', d: 0, c: 10 }, h2hOnly: { a: 0, b: 0, F: 'F3', d: 1, c: 10 } };
  console.log('\nRaw margin SD (predicting 0 every game):', Math.sqrt(g25.reduce((s, g) => s + (g.A.actual - g.B.actual) ** 2, 0) / g25.length).toFixed(1));
  Object.entries(base).forEach(([k, p]) => { const m = k === 'h2hOnly' ? metrics(g25, { ...p, a: 0, b: 0 }) : metrics(g25, p); console.log(`baseline ${k.padEnd(14)} RMSE ${m.rmse.toFixed(1)}  picks winner ${(m.acc * 100).toFixed(0)}%`); });
  const mAll = metrics(g25, fitAll);
  console.log('\nBEST FIT (all 2025):', JSON.stringify(fitAll), `RMSE ${mAll.rmse.toFixed(1)}, winner ${(mAll.acc * 100).toFixed(0)}%`);
  console.log(`leave-one-week-out CV: RMSE ${Math.sqrt(cvSe / cvN).toFixed(1)}, winner ${(cvHit / cvN * 100).toFixed(0)}% (n=${cvN})`);
  const m26 = metrics(g26, fitAll); console.log(`2026 Weeks 1-2 holdout: RMSE ${m26.rmse.toFixed(1)}, winner ${(m26.acc * 100).toFixed(0)}% (n=${g26.length})`);
  // totals bias
  const tot = g25.map(g => [exp(g.A, fitAll) + exp(g.B, fitAll), g.A.actual + g.B.actual]);
  const bias = tot.reduce((s, [p, a]) => s + (a - p), 0) / tot.length; const ratio = tot.reduce((s, [p, a]) => s + a, 0) / tot.reduce((s, [p]) => s + p, 0);
  console.log(`totals: mean actual-minus-predicted ${bias.toFixed(1)} pts/game, actual/predicted ratio ${ratio.toFixed(3)}, total RMSE ${Math.sqrt(tot.reduce((s, [p, a]) => s + (a - p) ** 2, 0) / tot.length).toFixed(1)}`);
  // what H2H alone is worth on top of the best non-H2H model
  const noHfit = grid.filter(p => p.d === 0).reduce((bst, p) => { const m = metrics(g25, p).rmse; return m < bst.m ? { p, m } : bst; }, { m: Infinity });
  console.log(`best without H2H: RMSE ${noHfit.m.toFixed(1)} ${JSON.stringify(noHfit.p)}`);
}).catch(e => { console.error(e.message); process.exit(1); });
