#!/usr/bin/env node
// Builds ALL_TIME_TEAM_DATA in index.html: each finished season's top 5 fantasy scorers at every
// position (QB/RB/WR/TE/K/DEF), scored with this league's own rules, plus who drafted them.
//
//   node tools/build_all_time_team.js <cache-dir>
//
// Run from the repo root. Re-run once a season finishes (its Playoff Standings rows are in
// raw.json) to add it -- only finished seasons are included. Downloads are cached in <cache-dir>.
//
// Method: Sleeper weekly stats for the NFL weeks the league actually played that season (the weeks
// present in games.json, playoffs included), scored with the dashboard's own leaguePoints() and
// the current league's scoring_settings -- one scoring system across every year. Position comes
// from the league's draft board when the player was drafted that year (players change position
// over a career), otherwise Sleeper's player database. "Drafted by" = the league draft board;
// in-season trades/pickups aren't recorded before 2025, so "Undrafted" means not on the board.
const fs = require('fs');
const path = require('path');

const cache = process.argv[2];
if (!cache) { console.error('usage: node tools/build_all_time_team.js <cache-dir>'); process.exit(2); }
fs.mkdirSync(cache, { recursive: true });

const html = fs.readFileSync('index.html', 'utf8');
const grab = (start, end) => { const s = html.indexOf(start); if (s < 0) throw new Error('index.html is missing ' + start); return html.slice(s, html.indexOf(end, s) + end.length); };
const fn = name => { const s = html.indexOf('function ' + name + '('); if (s < 0) throw new Error('index.html is missing ' + name); return html.slice(s, html.indexOf('\n}\n', s) + 3); };
const RAW = JSON.parse(fs.readFileSync('data/raw.json'));
const GAMES = JSON.parse(fs.readFileSync('data/games.json'));
eval([grab('const SLEEPER_LEAGUE_ID =', ';\n'), grab('const PTS_ALLOW_TIERS = [', '];\n'), fn('leaguePoints'),
      grab('const DRAFTS = {', '\n};\n'), grab('const KEEPER_COUNTS = {', '};\n'), fn('draftNorm'), fn('managerForTeam')]
  .join('\n').replace(/^const /gm, 'var '));

async function cached(file, url) {
  const f = path.join(cache, file);
  if (!fs.existsSync(f)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(f, await res.text());
  }
  return JSON.parse(fs.readFileSync(f));
}

const POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const TEAM = { ARI:'Arizona Cardinals', ATL:'Atlanta Falcons', BAL:'Baltimore Ravens', BUF:'Buffalo Bills', CAR:'Carolina Panthers', CHI:'Chicago Bears', CIN:'Cincinnati Bengals', CLE:'Cleveland Browns', DAL:'Dallas Cowboys', DEN:'Denver Broncos', DET:'Detroit Lions', GB:'Green Bay Packers', HOU:'Houston Texans', IND:'Indianapolis Colts', JAX:'Jacksonville Jaguars', KC:'Kansas City Chiefs', MIA:'Miami Dolphins', MIN:'Minnesota Vikings', NE:'New England Patriots', NO:'New Orleans Saints', NYG:'New York Giants', NYJ:'New York Jets', PHI:'Philadelphia Eagles', PIT:'Pittsburgh Steelers', SEA:'Seattle Seahawks', SF:'San Francisco 49ers', TB:'Tampa Bay Buccaneers', TEN:'Tennessee Titans', STL:'St. Louis Rams', LAR:'Los Angeles Rams', SD:'San Diego Chargers', LAC:'Los Angeles Chargers', OAK:'Oakland Raiders', LV:'Las Vegas Raiders', WAS:null };
const defName = (code, season) => code === 'WAS' ? (season <= 2019 ? 'Washington Redskins' : season <= 2021 ? 'Washington Football Team' : 'Washington Commanders') : TEAM[code];
const norm = s => s.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
// Same player spelled differently on an old draft board vs Sleeper (found by reviewing near-misses).
const ALIASES = { stevenhauschka: 'stephenhauschka' };
const normName = s => { const n = norm(s); return ALIASES[n] || n; };

(async () => {
  const league = await cached('league.json', `https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}`);
  const scoring = league.scoring_settings;
  const P = await cached('players_nfl.json', 'https://api.sleeper.app/v1/players/nfl');
  const finished = new Set(RAW.filter(d => d.category === 'Playoff Standings').map(d => d.season));
  const seasons = [...finished].filter(s => DRAFTS[s]).sort((a, b) => a - b);

  const out = {};
  for (const season of seasons) {
    const weeks = [...new Set(GAMES.filter(g => g.season === season).map(g => g.week))].sort((a, b) => a - b);
    const pickByName = {};
    DRAFTS[season].picks.forEach(p => { pickByName[normName(p.player)] = p; });
    const totals = {};
    for (const w of weeks) {
      const wk = await cached(`stats_${season}_${w}.json`, `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${w}`);
      for (const [id, st] of Object.entries(wk)) {
        if (id.startsWith('TEAM_')) continue;
        const pts = leaguePoints(st, scoring);
        if (!pts && !st.gp) continue;
        const t = totals[id] = totals[id] || { pts: 0, gp: 0 };
        t.pts += pts;
        if (st.gp) t.gp += 1;
      }
    }
    const rows = [];
    for (const [id, t] of Object.entries(totals)) {
      const isDef = id in TEAM;
      const name = isDef ? defName(id, season) : (P[id] && (P[id].full_name || `${P[id].first_name} ${P[id].last_name}`));
      if (!name) continue;
      const pick = pickByName[normName(name)];
      const pos = isDef ? 'DEF' : ((pick && pick.position) || (P[id] && P[id].position));
      if (!POS.includes(pos)) continue;
      const keeper = pick ? (KEEPER_COUNTS[season] !== undefined ? pick.round <= KEEPER_COUNTS[season] : !!pick.keeper) : false;
      rows.push([name, pos, Math.round(t.pts * 100) / 100, t.gp, pick ? managerForTeam(season, pick.team) : null, pick ? pick.round : null, keeper ? 1 : 0]);
    }
    out[season] = {};
    for (const pos of POS) {
      out[season][pos] = rows.filter(r => r[1] === pos).sort((a, b) => b[2] - a[2]).slice(0, 5)
        .map(([name, , pts, gp, owner, round, keeper]) => [name, pts, gp, owner, round, keeper]);
    }
    console.log(`${season}: weeks ${weeks[0]}-${weeks[weeks.length - 1]}, ${rows.length} scored players`);
  }

  const block = 'const ALL_TIME_TEAM_DATA = {\n' +
    Object.entries(out).map(([s, d]) => `  "${s}": ${JSON.stringify(d)}`).join(',\n') + '\n};\n';
  const re = /const ALL_TIME_TEAM_DATA = \{[\s\S]*?\n\};\n/;
  if (!re.test(html)) throw new Error('ALL_TIME_TEAM_DATA block not found in index.html');
  fs.writeFileSync('index.html', html.replace(re, () => block));
  console.log(`Wrote ALL_TIME_TEAM_DATA for ${seasons.length} seasons (${seasons[0]}-${seasons[seasons.length - 1]}).`);
})().catch(e => { console.error(e.message); process.exit(1); });
