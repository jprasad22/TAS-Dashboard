// Loads the dashboard's own functions and constants out of index.html into a sandbox, so the
// tools compute exactly what the page computes -- one implementation, no drifting copies.
//
//   const dash = loadDashboard({ functions: ['h2hRecord', ...], consts: ['LINE_MODEL', ...] });
//   dash.h2hRecord(a, b, 'all');   dash.GAMES = filtered;   // globals can be swapped
//
// Run tools from the repo root (paths are relative to it).
const fs = require('fs');
const vm = require('vm');

// api.sleeper.* rejects some default script user-agents
const uaFetch = (url, opts) => fetch(url, { ...(opts || {}), headers: { 'User-Agent': 'Mozilla/5.0', ...((opts || {}).headers || {}) } });

const CONST_ENDS = {
  PTS_ALLOW_TIERS: '];\n', SLEEPER_USERNAME_TO_MANAGER: '};\n', CURRENT_SEASON: '\n};\n',
  SLEEPER_LEAGUE_ID: ';\n', LINE_MODEL: ';\n', KEEPER_COUNTS: '};\n',
};

function loadDashboard({ functions = [], consts = [] } = {}) {
  const html = fs.readFileSync('index.html', 'utf8');
  const constSrc = name => {
    const start = html.indexOf(`const ${name} =`);
    if (start < 0) throw new Error(`index.html is missing const ${name}`);
    return html.slice(start, html.indexOf(CONST_ENDS[name] || ';\n', start) + (CONST_ENDS[name] || ';\n').length);
  };
  const fnSrc = name => {
    let start = html.indexOf(`\nfunction ${name}(`);
    if (start < 0) start = html.indexOf(`\nasync function ${name}(`);
    if (start < 0) throw new Error(`index.html is missing function ${name}`);
    return html.slice(start + 1, html.indexOf('\n}\n', start) + 3);
  };
  const RAW = JSON.parse(fs.readFileSync('data/raw.json'));
  const ctx = vm.createContext({
    console, fetch: uaFetch, URL, setTimeout,
    RAW, GAMES: JSON.parse(fs.readFileSync('data/games.json')),
    DRAFTS: JSON.parse(fs.readFileSync('data/drafts.json')),
    managers: [...new Set(RAW.map(d => d.manager))].sort(),
    loadJson: async p => JSON.parse(fs.readFileSync(p)),
  });
  // const/let at the top of a vm script aren't visible on the context object -- use var.
  const src = [...consts.map(constSrc), ...functions.map(fnSrc)].join('\n').replace(/^const /gm, 'var ');
  vm.runInContext(src, ctx);
  return ctx;
}

module.exports = { loadDashboard };
