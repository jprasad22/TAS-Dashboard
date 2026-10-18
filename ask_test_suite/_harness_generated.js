const RAW = require("/Users/jprasad/Documents/Claude Personal/TAS Dashboard/data/raw.json");

const GAMES = require("/Users/jprasad/Documents/Claude Personal/TAS Dashboard/data/games.json");

const DRAFTS = require("/Users/jprasad/Documents/Claude Personal/TAS Dashboard/data/drafts.json");

const ROSTERS_2025_VERIFIED = require("/Users/jprasad/Documents/Claude Personal/TAS Dashboard/data/rosters_2025.json");

const managers = [...new Set(RAW.map(d => d.manager))].sort();


const PALETTE = [
  '#e8a838', '#6fae7a', '#5b8fc7', '#c1553f', '#a678c9', '#4fb8b0',
  '#d98a3f', '#8fbd4d', '#e06a9b', '#7a95d1', '#c9a04f', '#5cb894'
];


const KEEPER_COUNTS = {
  2012: 2, 2013: 1, 2014: 1, 2015: 2, 2016: 0, 2017: 1, 2018: 1,
  2019: 0, 2020: 0, 2021: 0, 2022: 0, 2023: 1, 2024: 1,
};


const KEEPER_SELECTIONS_2026 = [
  { manager: "Jerome Prasad",   player: "Jaxon Smith-Njigba", round: 6, keeperYear: 2, position: "WR" },
  { manager: "Gurminder Kambo", player: "Emeka Egbuka",       round: 6, keeperYear: 1, position: "WR" },
  { manager: "Mac James",       player: "Josh Allen",         round: 4, keeperYear: 2, position: "QB" },
  { manager: "Mike Gostlin",    player: "Tyler Warren",       round: 7, keeperYear: 1, position: "TE" },
  { manager: "Jazz Dhillon",    player: "Brock Bowers",       round: 7, keeperYear: 2, position: "TE" },
  { manager: "Stuart Duncan",   player: "Ladd McConkey",      round: 8, keeperYear: 2, position: "WR" },
  { manager: "Ben Matsumoto",   player: "Javonte Williams",   round: 9, keeperYear: 1, position: "RB" },
  { manager: "Romie Jassal",    player: "Blake Corum",        round: 9, keeperYear: 1, position: "RB" },
  { manager: "Brad Harnum",     player: "Puka Nacua",         round: 7, keeperYear: 2, position: "WR" },
  { manager: "Ian Singh",       player: "Cam Skattebo",       round: 8, keeperYear: 1, position: "RB" },
  { manager: "Josh Dass",       player: "Zay Flowers",        round: 5, keeperYear: 1, position: "WR" },
  { manager: "Lucas Blair",     player: "Bhayshul Tuten",     round: 9, keeperYear: 1, position: "RB" },
];


const LEAGUE_SETTINGS = {
  scoring: "<div class=\"settings-subhead\">Passing</div>\n<ul>\n<li><b>1 point</b> per 25 passing yards</li>\n<li><b>4 points</b> per passing touchdown</li>\n<li><b>2 points</b> per 2-point conversion</li>\n<li><b>-2 points</b> per interception thrown</li>\n</ul>\n<div class=\"settings-subhead\">Rushing</div>\n<ul>\n<li><b>1 point</b> per 10 rushing yards</li>\n<li><b>6 points</b> per rushing touchdown</li>\n<li><b>2 points</b> per 2-point conversion</li>\n</ul>\n<div class=\"settings-subhead\">Receiving</div>\n<ul>\n<li><b>1 point</b> per reception (full PPR)</li>\n<li><b>1 point</b> per 10 receiving yards</li>\n<li><b>6 points</b> per receiving touchdown</li>\n<li><b>2 points</b> per 2-point conversion</li>\n</ul>\n<div class=\"settings-subhead\">Kicking</div>\n<ul>\n<li><b>3 points</b> per field goal made, 0&ndash;39 yards</li>\n<li><b>4 points</b> per field goal made, 40&ndash;49 yards</li>\n<li><b>5 points</b> per field goal made, 50&ndash;59 yards</li>\n<li><b>6 points</b> per field goal made, 60+ yards</li>\n<li><b>1 point</b> per extra point (PAT) made</li>\n<li>No penalty for missed kicks</li>\n</ul>\n<div class=\"settings-subhead\">Team Defense / Special Teams</div>\n<ul>\n<li><b>6 points</b> per defensive or special teams touchdown</li>\n<li><b>1 point</b> per sack</li>\n<li><b>2 points</b> per interception</li>\n<li><b>2 points</b> per fumble recovery</li>\n<li><b>2 points</b> per safety</li>\n<li><b>1 point</b> per special teams forced fumble</li>\n<li><b>1 point</b> per special teams fumble recovery</li>\n</ul>\n<div class=\"settings-subhead\">Points Allowed (Team Defense)</div>\n<ul>\n<li><b>10 points</b> &mdash; shutout (0 points allowed)</li>\n<li><b>7 points</b> &mdash; 1&ndash;6 points allowed</li>\n<li><b>4 points</b> &mdash; 7&ndash;13 points allowed</li>\n<li><b>1 point</b> &mdash; 14&ndash;20 points allowed</li>\n<li><b>0 points</b> &mdash; 21&ndash;27 points allowed</li>\n<li><b>-1 point</b> &mdash; 28&ndash;34 points allowed</li>\n<li><b>-4 points</b> &mdash; 35+ points allowed</li>\n</ul>\n<div class=\"settings-subhead\">Misc</div>\n<ul>\n<li><b>-2 points</b> per fumble lost</li>\n<li><b>6 points</b> per fumble recovery touchdown</li>\n</ul>",
  keeper: "<div class=\"settings-subhead\">Draft Round Cost</div>\n<ul>\n<li>Each keeper costs the draft pick from the round they were originally drafted in the previous season.</li>\n</ul>\n<div class=\"settings-subhead\">Repeated Keeper Rule</div>\n<ul>\n<li>If a player is kept for a second consecutive year (or more), their draft round cost moves up one round earlier each additional year.</li>\n<li>Example: Drafted in Round 8 &rarr; Year 1 keeper cost = Round 8 &rarr; Year 2 keeper cost = Round 7 &rarr; Year 3 keeper cost = Round 6.</li>\n</ul>\n<div class=\"settings-subhead\">Undrafted / Waiver Players</div>\n<ul>\n<li>If a keeper was originally undrafted (added from waivers), they are assigned a 9th-round cost in the first year they are kept.</li>\n</ul>\n<div class=\"settings-subhead\">Maximum Keeper Duration</div>\n<ul>\n<li>You may keep the same player for a maximum of 3 consecutive years (including the original year you first keep them). After that, they must re-enter the draft.</li>\n</ul>\n<div class=\"settings-subhead\">Round 1 Restrictions</div>\n<ul>\n<li>Players drafted in Round 1 cannot be kept under any circumstances.</li>\n<li>Players whose keeper cost would advance into Round 1 in a future season are also ineligible to be kept in the year before they would reach Round 1.</li>\n</ul>\n<div class=\"settings-subhead\">Traded Players</div>\n<ul>\n<li>All keeper rules and costs apply equally to traded players. A traded player&rsquo;s draft round cost and keeper eligibility continue from their original status and history, regardless of which team owns them.</li>\n</ul>\n<div class=\"settings-subhead\">Keeper Limit</div>\n<ul>\n<li>Each team may keep only 1 player per season.</li>\n</ul>\n<div class=\"settings-subhead\">Late-Round Draft Rule</div>\n<ul>\n<li>Any player drafted after Round 9 is defaulted to a Round 9 keeper cost in their first keeper year (same as an undrafted/waiver pickup).</li>\n</ul>",
  draftPickRules: "<div class=\"settings-subhead\">Tradable Picks (New for 2026)</div>\n<ul>\n<li>Draft picks may now be traded between managers.</li>\n<li><b>Only 2027 picks are tradable right now.</b> Current-year (2026) picks cannot be traded at all, and nothing beyond 2027 is allowed either \u2014 a strict 1-year lookahead, not this season plus next.</li>\n</ul>\n<div class=\"settings-subhead\">Trade Requirements</div>\n<ul>\n<li>Pick trades must be <b>pick-for-pick</b> \u2014 picks cannot be packaged with players or cash in the same trade.</li>\n<li>Trading a future pick requires that manager's <b>next season's league dues ($175) be paid upfront</b> before the trade is approved.</li>\n<li><b>No side deals:</b> all compensation for a pick trade must be spelled out explicitly within the trade itself \u2014 no off-the-books agreements.</li>\n</ul>\n<div class=\"settings-subhead\">Restrictions</div>\n<ul>\n<li>Maximum <b>2 picks from Rounds 1\u20135</b> may be traded away per future draft, per team.</li>\n</ul>",
  draftRules: "<div class=\"settings-subhead\">Draft Format</div>\n<ul>\n<li>Draft type: <b>Snake</b></li>\n<li>Time per pick: <b>60 seconds</b></li>\n</ul>\n<div class=\"settings-subhead\">Automation</div>\n<ul>\n<li><b>Autostart:</b> the draft automatically begins at the scheduled start time.</li>\n<li><b>CPU Auto Pick:</b> enabled &mdash; if a manager runs out of time on their pick, the system auto-picks for them.</li>\n</ul>",

  roster: "<div class=\"settings-subhead\">Starting Lineup</div>\n<ul>\n<li><b>1</b> Quarterback (QB)</li>\n<li><b>2</b> Running Back (RB)</li>\n<li><b>2</b> Wide Receiver (WR)</li>\n<li><b>1</b> Tight End (TE)</li>\n<li><b>2</b> Flex (WR/RB/TE)</li>\n<li><b>1</b> Kicker (K)</li>\n<li><b>1</b> Defense (DEF)</li>\n</ul>\n<div class=\"settings-subhead\">Bench</div>\n<ul>\n<li><b>5</b> bench spots</li>\n</ul>\n<div class=\"settings-subhead\">Injured Reserve (IR)</div>\n<ul>\n<li><b>1</b> IR slot</li>\n<li>OUT players allowed on IR</li>\n<li>Suspended players allowed on IR</li>\n<li>NA, DNR/Holdout/Opt-out, and Doubtful players are <b>not</b> allowed on IR</li>\n</ul>",
  general: "<div class=\"settings-subhead\">League Format</div>\n<ul>\n<li>League type: <b>Keeper</b></li>\n<li><b>12</b> teams</li>\n<li>Keeper decisions due <b>1 week (7 days)</b> before the draft</li>\n</ul>\n<div class=\"settings-subhead\">Waivers</div>\n<ul>\n<li>Waiver type: <b>FAAB</b> (Free Agent Auction Budget) bidding</li>\n<li><b>$100</b> FAAB budget per season</li>\n<li>Dropped players stay on waivers for <b>1 day</b> before clearing to free agency</li>\n<li>Waivers process daily; final weekly clear is <b>Wednesdays at 3:00 AM EDT</b></li>\n</ul>\n<div class=\"settings-subhead\">Trades</div>\n<ul>\n<li><b>1-day</b> review period on pending trades</li>\n<li>Trade deadline: <b>Week 11</b></li>\n<li>Draft pick trading is <b>allowed</b></li>\n</ul>\n<div class=\"settings-subhead\">Playoffs</div>\n<ul>\n<li>Playoffs start <b>Week 15</b></li>\n<li><b>8</b> teams make the playoffs</li>\n<li>One week per playoff round</li>\n<li>Seeding: set by regular-season record; ties broken first by total points scored, then by total points scored against</li>\n<li>Non-playoff teams play in a separate <b>Consolation bracket</b></li>\n</ul>\n<div class=\"settings-subhead\">Transaction Rules</div>\n<ul>\n<li>Roster moves are <b>locked</b> until after the draft</li>\n<li>Bench players <b>can&rsquo;t be dropped</b> once their game has started</li>\n</ul>\n<div class=\"settings-subhead\">Competitive Lineup Rule (New for 2026)</div>\n<ul>\n<li>Each manager must submit their <b>highest-scoring reasonable lineup</b> every week.</li>\n<li>If a bench player is eligible for an empty starting spot, they <b>must be started</b>.</li>\n</ul>\n<div class=\"settings-subhead\">Trade Review Committee (New for 2026)</div>\n<ul>\n<li>A 4-person committee reviews trades, but may only overturn one for <b>collusion</b>, a <b>deliberate tanking arrangement</b>, or a <b>rule violation</b> \u2014 not simple fairness disagreements.</li>\n<li>If a trade involves a Committee member, the other <b>3 Committee members</b> review it instead.</li>\n</ul>\n<div class=\"settings-subhead\">Toilet Bowl Punishment (New for 2026 \u2014 TBD)</div>\n<ul>\n<li>Not yet decided. The Committee will present punishment options for the league to vote on before the draft.</li>\n<li>Intent: a known consequence to reduce incentive for intentional losing.</li>\n</ul>",
  goodToKnow: "<ul>\n<li><b>The Ask tab isn&rsquo;t AI</b> &mdash; it&rsquo;s a lookup tool that recognizes known question patterns (manager names, years, stats, rules). If it doesn&rsquo;t understand something, it says so rather than guessing.</li>\n<li><b>Live data</b> (this week&rsquo;s standings and scoreboard, the NFL ticker, and 2026+ draft results) is pulled live from Sleeper (and ESPN for the NFL ticker). If their systems are slow or briefly wrong, this dashboard will reflect that.</li>\n<li><b>Standings ties stay ties, on purpose.</b> If two teams are tied on both wins and points, they&rsquo;ll show at the same rank &mdash; not resolved by points against. Same logic as a regular-season NFL game itself being allowed to end in a tie.</li>\n<li><b>The NFL ticker uses an unofficial, undocumented ESPN source.</b> It could stop working without warning &mdash; that&rsquo;s a limitation of the source, not necessarily something broken here.</li>\n<li><b>The Trade Analyzer&rsquo;s compliance checker</b> automatically checks the year rule, pick-for-pick, and the Rounds 1&ndash;5 limit &mdash; but only for the trade being built right now, not any prior trades made outside this tool. It can&rsquo;t verify fee-paid-upfront or no-side-deals at all &mdash; confirm those manually.</li>\n<li><b>Player and pick trade values</b> come from FantasyCalc, a third-party crowd-sourced site &mdash; a reference point, not an official or binding valuation.</li>\n<li><b>2012&ndash;2025 seasons are fully validated, start to finish, including playoffs.</b> 2026 is being added week by week as it's actually played &mdash; Stats, Head-to-Head, and Power Rankings for 2026 reflect completed weeks only, and won't have a final standings/champion until the season (playoffs included) actually finishes.</li>\n</ul>",
};


const CURRENT_SEASON = {
  year: 2026,
  draftDate: "2026-09-07T18:30:00",   // Mon Sep 7, 2026 (Labor Day), 6:30 PM Eastern -- confirmed
  // Manual override on purpose: the real 2026 lock (Aug 30) predates the permanent "exactly 7 days
  // before the draft" rule, which would compute Aug 31. Don't "fix" it; future seasons use the rule.
  keeperLockDate: "2026-08-30T23:59:00",
  tradeDeadline: null,      // e.g. "2026-11-17T23:59:00"
  playoffStart: null,       // e.g. "2026-12-05T00:00:00"
  leagueFeeAmount: "$175",  // increased from $150 for 2026
  leagueFeeDeadline: null,  // e.g. "2026-08-17T23:59:00"
  draftOrder: [
    "Mike Gostlin", "Jazz Dhillon", "Stuart Duncan", "Ben Matsumoto",
    "Romie Jassal", "Gurminder Kambo", "Mac James", "Brad Harnum",
    "Jerome Prasad", "Ian Singh", "Josh Dass", "Lucas Blair"
  ],                         // set 2026-08-23 from the F1 Dutch GP result; matches the real
                              // 2026 draft (DRAFTS["2026"])
};


const TICKER_STATS = {
  winpct: {
    label: 'All-Time Win %',
    rows: () => managers.map(m => {
      const w = RAW.filter(d => d.manager === m && d.category === 'Wins').reduce((a, b) => a + b.value, 0);
      const l = RAW.filter(d => d.manager === m && d.category === 'Losses').reduce((a, b) => a + b.value, 0);
      const t = tiesFor(m);
      const pct = winPctOf(w, l, t);
      return { manager: m, sortVal: pct, display: `${recordStr(w, l, t)} <span class="pct">${(pct * 100).toFixed(1)}%</span>` };
    }),
  },
  ptsfor: {
    label: 'Points For',
    rows: () => managers.map(m => {
      const total = RAW.filter(d => d.manager === m && d.category === 'Pts For').reduce((a, b) => a + b.value, 0);
      return { manager: m, sortVal: total, display: `<span class="pct">${total.toFixed(1)}</span> pts` };
    }),
  },
  ptsdiff: {
    label: 'Point Diff',
    rows: () => managers.map(m => {
      const total = RAW.filter(d => d.manager === m && d.category === 'Pts Differential').reduce((a, b) => a + b.value, 0);
      return { manager: m, sortVal: total, display: `<span class="pct">${total > 0 ? '+' : ''}${total.toFixed(1)}</span>` };
    }),
  },
  championships: {
    label: 'Championships',
    rows: () => managers.map(m => {
      const count = RAW.filter(d => d.manager === m && d.category === 'Playoff Standings' && d.value === 1).length;
      return { manager: m, sortVal: count, display: `<span class="pct">${count}</span> ${count === 1 ? 'title' : 'titles'}` };
    }),
  },
  playoffwins: {
    label: 'Playoff Wins',
    rows: () => managers.map(m => {
      const total = RAW.filter(d => d.manager === m && d.category === 'Playoff Wins').reduce((a, b) => a + b.value, 0);
      return { manager: m, sortVal: total, display: `<span class="pct">${total}</span> wins` };
    }),
  },
  sackos: {
    label: 'Sackos',
    rows: () => managers.map(m => {
      const count = RAW.filter(d => d.manager === m && d.category === 'Playoff Standings' && d.value === 12).length;
      return { manager: m, sortVal: count, display: `<span class="pct">${count}</span> ${count === 1 ? 'sacko' : 'sackos'}` };
    }),
  },
};


let ALL_PLAYERS = (() => {
  const set = new Set();
  Object.values(DRAFTS).forEach(d => d.picks.forEach(p => { if (p.player) set.add(p.player); }));
  return [...set].sort((a,b) => b.length - a.length); // longest first, so specific names match before short substrings
})();

function fmt(n, dec=0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}


function valueFor(manager, season, category) {
  const row = RAW.find(d => d.manager===manager && d.season===season && d.category===category);
  return row ? row.value : null;
}


function tiesFor(manager, seasonFilter) {
  const inRange = s => seasonFilter === undefined || (typeof seasonFilter === 'function' ? seasonFilter(s) : s === seasonFilter);
  return GAMES.filter(g => g.type === 'regular' && g.sA === g.sB && (g.mA === manager || g.mB === manager) && inRange(g.season)).length;
}


function winPctOf(w, l, t = 0) {
  return (w + l + t) > 0 ? (w + t / 2) / (w + l + t) : 0;
}


function recordStr(w, l, t = 0) {
  return `${w}-${l}${t ? '-' + t : ''}`;
}


function getFinishedSeasons() {
  return new Set(RAW.filter(d => d.category === 'Playoff Standings').map(d => d.season));
}


function latestFinishedSeason() {
  return Math.max(...getFinishedSeasons());
}


function inProgressPowerNote(yr) {
  if (yr) return '';
  const newest = Math.max(...RAW.map(d => d.season));
  return newest > latestFinishedSeason()
    ? ` (Most recent completed season -- ${newest} is still in progress; see Stats > Power Rankings > ${newest} (Live).)`
    : '';
}


function draftNorm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g,''); }
function managerForTeam(year, team) {
  const n = draftNorm(team);
  const match = RAW.find(d => d.season === year && draftNorm(d.team) === n);
  return match ? match.manager : '?';
}


function managerForTeam(year, team) {
  const n = draftNorm(team);
  const match = RAW.find(d => d.season === year && draftNorm(d.team) === n);
  return match ? match.manager : '?';
}


function computeKeeperHistory() {
  const rows = [];
  Object.entries(KEEPER_COUNTS).forEach(([yearStr, n]) => {
    if (n === 0) return;
    const year = parseInt(yearStr);
    if (!DRAFTS[year]) return;
    DRAFTS[year].picks.filter(p => p.round <= n).forEach(p => {
      rows.push({
        year, manager: managerForTeam(year, p.team),
        round: p.round, pick: p.pick, player: p.player, position: p.position,
      });
    });
  });
  // Years outside KEEPER_COUNTS (2025+): use explicit per-pick keeper flags instead of round inference.
  Object.keys(DRAFTS).forEach(yearStr => {
    const year = parseInt(yearStr);
    if (KEEPER_COUNTS[year] !== undefined) return; // already handled above
    DRAFTS[year].picks.filter(p => p.keeper === true).forEach(p => {
      rows.push({
        year, manager: managerForTeam(year, p.team),
        round: p.round, pick: p.pick, player: p.player, position: p.position,
      });
    });
  });
  return rows.sort((a,b) => b.year - a.year || a.round - b.round || a.pick - b.pick);
}


function scorePowerRankingRows(rows) {
  if (!rows.length) return [];
  const scale = (vals, v) => {
    const min = Math.min(...vals), max = Math.max(...vals);
    return max === min ? 0.5 : (v - min) / (max - min);
  };
  const ptsForVals = rows.map(r => r.ptsFor);
  const ptsDiffVals = rows.map(r => r.ptsDiff);
  rows.forEach(r => {
    r.score = (0.5 * r.winPct + 0.3 * scale(ptsForVals, r.ptsFor) + 0.2 * scale(ptsDiffVals, r.ptsDiff)) * 100;
  });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}


function computePowerRankings(season) {
  const rows = managers.map(m => {
    const wins = valueFor(m, season, 'Wins');
    const losses = valueFor(m, season, 'Losses');
    const ptsFor = valueFor(m, season, 'Pts For');
    const ptsDiff = valueFor(m, season, 'Pts Differential');
    if (wins === null || losses === null || ptsFor === null || ptsDiff === null) return null;
    const ties = tiesFor(m, season);
    return { manager: m, wins, losses, ties, ptsFor, ptsDiff, winPct: winPctOf(wins, losses, ties) };
  }).filter(r => r !== null);

  return scorePowerRankingRows(rows);
}


function computeCareerPowerRankings() {
  // Only finished seasons: a few weeks of an in-progress season would swing career averages (2 weeks
  // of 2026 once moved some by 3+ points). See getFinishedSeasons().
  const seasons = [...getFinishedSeasons()].sort((a, b) => a - b);
  const perManager = {};
  managers.forEach(m => { perManager[m] = { scores: [], wins: 0, losses: 0, ties: 0, ptsFor: 0, ptsDiff: 0, seasonsPlayed: 0 }; });

  seasons.forEach(season => {
    computePowerRankings(season).forEach(r => {
      const p = perManager[r.manager];
      p.scores.push(r.score);
      p.wins += r.wins;
      p.ties += r.ties || 0;
      p.losses += r.losses;
      p.ptsFor += r.ptsFor;
      p.ptsDiff += r.ptsDiff;
      p.seasonsPlayed += 1;
    });
  });

  return managers.map(m => {
    const p = perManager[m];
    const score = p.scores.length ? p.scores.reduce((a, b) => a + b, 0) / p.scores.length : 0;
    return { manager: m, score, wins: p.wins, losses: p.losses, ties: p.ties, ptsFor: p.ptsFor, ptsDiff: p.ptsDiff, seasonsPlayed: p.seasonsPlayed };
  }).sort((a, b) => b.score - a.score);
}


function computeValueKeepers() {
  const grouped = {};
  KEEPER_HISTORY.forEach(r => {
    const key = r.manager + '||' + r.player;
    if (!grouped[key]) grouped[key] = { manager: r.manager, player: r.player, position: r.position, years: [], rounds: [] };
    grouped[key].years.push(r.year);
    grouped[key].rounds.push(r.round);
  });

  return Object.values(grouped)
    .filter(g => g.years.length >= 2)
    .map(g => {
      const minYear = Math.min(...g.years);
      const firstRoundIdx = g.years.indexOf(minYear);
      return {
        manager: g.manager, player: g.player, position: g.position,
        timesKept: g.years.length,
        years: [...g.years].sort((a, b) => a - b),
        firstRound: g.rounds[firstRoundIdx],
      };
    })
    .sort((a, b) => b.timesKept - a.timesKept || b.firstRound - a.firstRound);
}


function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}


function findManagersInText(text) {
  const lower = text.toLowerCase();
  const found = new Set();

  managers.forEach(m => {
    const full = m.toLowerCase();
    if (lower.includes(full)) { found.add(m); return; }

    const parts = full.split(' ');
    const first = parts[0];
    const last = parts.slice(-1)[0];

    // Last name: only match if it's unique among all managers' last names, so "Kambo" can't
    // accidentally resolve to the wrong person if a future manager shares a surname.
    const lastNameOwners = managers.filter(mm => mm.toLowerCase().split(' ').slice(-1)[0] === last);
    if (lastNameOwners.length === 1 && new RegExp(`\\b${last}\\b`).test(lower)) { found.add(m); return; }

    // First name: same uniqueness safety check as last name above.
    const firstNameOwners = managers.filter(mm => mm.toLowerCase().split(' ')[0] === first);
    if (firstNameOwners.length === 1 && new RegExp(`\\b${first}\\b`).test(lower)) { found.add(m); return; }
  });

  // Typo-tolerant fallback. Deliberately NOT gated behind "zero exact matches so far" -- a mixed
  // H2H-style query like "Jaz vs Jerome" (one typo, one correct) needs fuzzy matching to still run
  // for "Jaz" even though "Jerome" already matched exactly. Managers already found exactly are
  // skipped here, both to avoid redundant work and so an already-confirmed match can't be
  // second-guessed by a coincidental fuzzy hit elsewhere in the query.
  //
  // FUZZY_STOPWORDS exists because short manager names collide with ordinary English words at
  // edit-distance 1 -- "been" vs "Ben" is exactly 1 edit, and "been" is an extremely common word
  // in natural questions ("how long has X been..."). Found this the hard way: it silently turned
  // a 1-manager query into a 2-manager one and broke routing for an otherwise-correct answer.
  // Rather than enumerate every possible collision case by case, common query/function words are
  // blocked from ever being treated as a fuzzy name candidate at all.
  const FUZZY_STOPWORDS = new Set([
    'the', 'has', 'have', 'had', 'been', 'was', 'were', 'are', 'and', 'for', 'how', 'many',
    'what', 'when', 'where', 'why', 'which', 'with', 'from', 'this', 'that', 'these', 'those',
    'does', 'did', 'can', 'could', 'would', 'should', 'will', 'shall', 'not', 'all', 'any', 'some',
    'most', 'best', 'worst', 'total', 'career', 'average', 'over', 'across', 'out', 'off', 'per',
    'record', 'power', 'score', 'scores', 'rank', 'ranking', 'rankings', 'kept', 'keep', 'keeper',
    'roster', 'draft', 'drafted', 'picks', 'pick', 'season', 'seasons', 'year', 'years', 'week',
    'weeks', 'game', 'games', 'league', 'rules', 'settings', 'team', 'teams', 'times', 'time',
    'much', 'more', 'less', 'than', 'then', 'there', 'their', 'them', 'they', 'his', 'her', 'him',
    'she', 'won', 'win', 'wins', 'loss', 'losses', 'point', 'points', 'differential', 'diff',
    'championship', 'championships', 'title', 'titles', 'sacko', 'sackos', 'playoff', 'playoffs',
    // Everyday words one or two letters off a manager's name (found by scanning a dictionary against
    // every first/last name): "how many teams make the playoffs" was answering with Mike's roster.
    'make', 'like', 'mine', 'bike', 'hike', 'mile', 'mice', 'mime', 'mite', 'pike',            // Mike
    'may', 'map', 'mad', 'man', 'mat', 'max', 'mag', 'mar', 'mace',                            // Mac
    'bet', 'ten', 'men', 'pen', 'hen', 'den', 'bed', 'bee', 'beg', 'bend', 'bent', 'bean',     // Ben
    'ban', 'bin', 'bun', 'gen', 'yen', 'fan', 'ran', 'tan', 'van', 'pan', 'inn', 'ion',        // Ben / Ian
    'start', 'smart', 'star', 'stare', 'stark', 'stunt', 'squat', 'quart', 'strait', 'tart',   // Stuart
    'pass', 'days', 'dash', 'mass', 'bass', 'lass', 'ass',                                     // Dass
    'sing', 'sigh', 'gosh', 'posh', 'nosh', 'flair', 'lair', 'jazzy', 'roomie', 'dunce',      // Singh / Josh / Blair / Jazz / Romie / Duncan
    'bad', 'bra', 'brag', 'brand', 'bran', 'brat', 'bray', 'bread', 'bred', 'broad', 'grad', 'bead', 'braid', // Brad
    'harm', 'harem', 'magnum', 'casual', 'causal', 'nasal', 'rascal', 'tassel', 'become', 'chrome', 'erode', 'genome', 'goblin', 'grinder', // other names
  ]);
  const words = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !FUZZY_STOPWORDS.has(w));
  words.forEach(word => {
    let best = null, bestDist = Infinity, ambiguous = false;
    managers.forEach(m => {
      if (found.has(m)) return;
      const parts = m.toLowerCase().split(' ');
      [parts[0], parts[parts.length - 1]].forEach(namePart => {
        const dist = levenshtein(word, namePart);
        const threshold = namePart.length <= 5 ? 1 : 2;
        if (dist <= threshold) {
          if (dist < bestDist) { bestDist = dist; best = m; ambiguous = false; }
          else if (dist === bestDist && best !== m) { ambiguous = true; }
        }
      });
    });
    if (best && !ambiguous) found.add(best);
  });

  return [...found];
}


function findYearInText(text) {
  const m = text.match(/\b(20(1[2-9]|2[0-6]))\b/);
  return m ? parseInt(m[1]) : null;
}


function findPlayerInText(text) {
  const lower = text.toLowerCase();
  for (const p of ALL_PLAYERS) {
    if (p.length > 3 && lower.includes(p.toLowerCase())) return p;
  }
  return null;
}


function findRelativeSeason(lower) {
  if (/\b(this|current) (season|year)\b|\bso far\b/.test(lower)) return CURRENT_SEASON.year;
  if (/\blast (season|year)\b|\bmost recent\b|\bdefending\b|\breigning\b/.test(lower)) return latestFinishedSeason();
  return null;
}


function h2hRecord(m1, m2, filter) {
  filter = filter || 'all';
  let games = GAMES.filter(g => (g.mA===m1 && g.mB===m2) || (g.mA===m2 && g.mB===m1));
  if (filter !== 'all') games = games.filter(g => g.type === filter);
  let w1=0, w2=0, ties=0, pts1=0, pts2=0;
  games.forEach(g => {
    const s1 = g.mA===m1 ? g.sA : g.sB;
    const s2 = g.mA===m1 ? g.sB : g.sA;
    pts1 += s1; pts2 += s2;
    if (s1>s2) w1++; else if (s2>s1) w2++; else ties++;
  });
  return { games, w1, w2, ties, pts1, pts2 };
}


function winnerOf(g) { return g.sA > g.sB ? g.mA : (g.sB > g.sA ? g.mB : 'TIE'); }

function buildH2HSelectors() {
  const selA = document.getElementById('h2hA');
  const selB = document.getElementById('h2hB');
  const opts = managers.map(m => `<option value="${m}">${m}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  selA.value = managers[0];
  selB.value = managers[1];
  selA.addEventListener('change', () => { if (selA.value===selB.value) selB.value = managers.find(m=>m!==selA.value); renderH2HSummary(); });
  selB.addEventListener('change', () => { if (selB.value===selA.value) selA.value = managers.find(m=>m!==selB.value); renderH2HSummary(); });
}


function marginOf(g) { return Math.abs(g.sA - g.sB); }
function winnerOf(g) { return g.sA > g.sB ? g.mA : (g.sB > g.sA ? g.mB : 'TIE'); }

function buildH2HSelectors() {
  const selA = document.getElementById('h2hA');
  const selB = document.getElementById('h2hB');
  const opts = managers.map(m => `<option value="${m}">${m}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  selA.value = managers[0];
  selB.value = managers[1];
  selA.addEventListener('change', () => { if (selA.value===selB.value) selB.value = managers.find(m=>m!==selA.value); renderH2HSummary(); });
  selB.addEventListener('change', () => { if (selB.value===selA.value) selA.value = managers.find(m=>m!==selB.value); renderH2HSummary(); });
}


function formatDateTime(iso) {
  // Null-safe on purpose: callers can pass a field that isn't set yet (e.g. the fee deadline when
  // only the amount is known) -- this once crashed an Ask answer.
  if (!iso) return 'TBD';
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const hasTime = iso.includes('T') && iso.split('T')[1] !== '00:00:00';
  if (!hasTime) return dateStr;
  const timeStr = d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
  return `${dateStr} · ${timeStr}`;
}


function computeKeeperLockDate(cs) {
  if (cs.keeperLockDate) return cs.keeperLockDate; // manual override, if ever set
  if (!cs.draftDate) return null;
  const d = new Date(cs.draftDate);
  d.setDate(d.getDate() - 7); // permanently changed from -2 to -7, decided by the league 2026-08-31
  return d.toISOString();
}


function askAnswer(raw) {
  const text = raw.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const yr = findYearInText(text) || findRelativeSeason(lower);
  const mgrs = findManagersInText(text);
  const player = findPlayerInText(text);

  // Head-to-head record
  if (mgrs.length >= 2 && /(record against|\bvs?\b|versus|head.to.head|h2h|compare|against|\brecord\b)/.test(lower)) {
    const all = h2hRecord(mgrs[0], mgrs[1], 'all');
    const games = yr ? all.games.filter(g => g.season === yr) : all.games;
    const when = yr ? `in ${yr}` : 'all-time';
    if (games.length === 0) return yr ? `${mgrs[0]} and ${mgrs[1]} didn't play each other in ${yr}${yr === CURRENT_SEASON.year ? ' (so far)' : ''}.` : `${mgrs[0]} and ${mgrs[1]} have never played each other.`;
    let w1 = 0, w2 = 0, ties = 0, pts1 = 0, pts2 = 0;
    games.forEach(g => {
      const s1 = g.mA === mgrs[0] ? g.sA : g.sB, s2 = g.mA === mgrs[0] ? g.sB : g.sA;
      pts1 += s1; pts2 += s2;
      if (s1 > s2) w1++; else if (s2 > s1) w2++; else ties++;
    });
    return `${mgrs[0]} is ${w1}-${w2}${ties ? '-' + ties : ''} ${when} against ${mgrs[1]} (${fmt(pts1,1)} to ${fmt(pts2,1)} in total points, ${games.length} game${games.length === 1 ? '' : 's'}).`;
  }

  // Who drafted a specific player
  if (player && /(draft|pick|took|selected)/.test(lower)) {
    const hits = [];
    Object.keys(DRAFTS).forEach(year => {
      DRAFTS[year].picks.forEach(p => {
        if (p.player === player) hits.push({ year, ...p, manager: managerForTeam(parseInt(year), p.team) });
      });
    });
    if (hits.length) {
      return hits.map(h => `${h.year}: ${h.manager} drafted ${h.player} in Round ${h.round}, Pick ${h.pick} (overall ${h.overall}).`).join('<br>');
    }
  }

  // A manager's draft picks in a specific year
  if (mgrs.length === 1 && yr && DRAFTS[yr] && /draft/.test(lower)) {
    const picks = DRAFTS[yr].picks.filter(p => managerForTeam(yr, p.team) === mgrs[0]).sort((a,b) => a.overall-b.overall);
    if (picks.length) {
      return `${mgrs[0]}'s ${yr} draft: ` + picks.map(p => `R${p.round} - ${p.player}`).join(', ');
    }
  }

  // Draft order for a year
  if (yr && DRAFTS[yr] && !mgrs.length && /(draft order|drafting first|first pick|draft position)/.test(lower)) {
    return `${yr} draft order: ` + DRAFTS[yr].draft_order.map((t,i) => `${i+1}. ${managerForTeam(yr,t)}`).join(', ');
  }

  // Season champion / who won a given year
  if (yr && /(champion|who won|winner|title)/.test(lower)) {
    const champ = RAW.find(d => d.season===yr && d.category==='Playoff Standings' && d.value===1);
    if (champ) return `${champ.manager} won the ${yr} championship (playing as "${champ.team}").`;
    // A real, existing season (e.g. the current in-progress one) can now legitimately have no
    // champion decided yet -- give an accurate answer instead of silently falling through to the
    // generic "couldn't match" fallback, which would be confusing for a perfectly valid question.
    if (RAW.some(d => d.season === yr)) return `The ${yr} season is still in progress -- no champion has been decided yet.`;
  }

  // Sacko for a given year
  if (yr && /sacko|last place/.test(lower)) {
    const sacko = RAW.find(d => d.season===yr && d.category==='Playoff Standings' && d.value===12);
    if (sacko) return `${sacko.manager} was the ${yr} Sacko, finishing dead last (playing as "${sacko.team}").`;
    if (RAW.some(d => d.season === yr)) return `The ${yr} season is still in progress -- no Sacko has been decided yet.`;
  }

  // Career-stat lookup, reusing TICKER_STATS so answers always match the ticker. Requires !yr so it
  // never competes with single-year branches, and uses multi-word/distinctive aliases (not bare
  // "wins"/"points") so it doesn't collide with the league-leader branches further down.
  const CAREER_STAT_ALIASES = {
    ptsfor: ['points for', 'total points', 'career points', 'points scored'],
    ptsdiff: ['point differential', 'points differential', 'point diff', 'points diff'],
    championships: ['championships', 'championship', 'titles', 'rings'],
    playoffwins: ['playoff wins', 'playoff win'],
    sackos: ['sackos', 'sacko'],
    // Deliberately NOT "career wins"/"most wins"/"winningest": those belong to the legacy "Career wins
    // leader" branch further down, and since this engine runs first it would intercept them.
    winpct: ['how many wins', 'wins does', 'win total', 'how many losses', 'losses does', 'loss total',
      'win percentage', 'win %', 'win pct', 'winning percentage', 'best record', 'worst record', 'fewest wins'],
  };
  let careerStatKey = null;
  for (const [key, aliases] of Object.entries(CAREER_STAT_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) { careerStatKey = key; break; }
  }
  if (careerStatKey && !yr) {
    // Direction matters: least/fewest/lowest/worst picks from the bottom (this once always returned
    // the MOST). A named manager's rank is always relative to "most" (#1 = most), whatever the wording.
    const wantsLeast = /least|fewest|lowest|worst|bottom/.test(lower);
    const descRows = TICKER_STATS[careerStatKey].rows().sort((a, b) => b.sortVal - a.sortVal);
    const plain = s => s.display.replace(/<[^>]+>/g, '');
    if (mgrs.length === 1) {
      const idx = descRows.findIndex(r => r.manager === mgrs[0]);
      if (idx !== -1) {
        return `${mgrs[0]}'s career ${TICKER_STATS[careerStatKey].label}: ${plain(descRows[idx])} (ranked #${idx + 1} of ${descRows.length}).`;
      }
    } else if (!mgrs.length) {
      const row = wantsLeast ? descRows[descRows.length - 1] : descRows[0];
      const label = wantsLeast ? `${careerStatKey === 'winpct' ? 'Lowest' : 'Fewest'} career ${TICKER_STATS[careerStatKey].label}` : `Career ${TICKER_STATS[careerStatKey].label} leader`;
      return `${label}: ${row.manager} — ${plain(row)}.`;
    }
  }

  // Career-average Power Score -- must come before the single-season version below, since that
  // one matches on any "power score/rank" phrase for a matched manager regardless of wording, and
  // would otherwise wrongly intercept an "average"/"career" query and answer with just one season.
  if (mgrs.length === 1 && /power (score|rank|ranking)/.test(lower) && /(average|career|overall|all.?time)/.test(lower)) {
    const rows = computeCareerPowerRankings();
    const idx = rows.findIndex(r => r.manager === mgrs[0]);
    if (idx !== -1) {
      return `${mgrs[0]}'s average Power Score across all ${rows[idx].seasonsPlayed} seasons: ${rows[idx].score.toFixed(1)} (ranked #${idx + 1} of ${rows.length}).`;
    }
  }
  if (!mgrs.length && /power (score|rank|ranking)/.test(lower) && /(average|career|overall|all.?time)/.test(lower)) {
    const rows = computeCareerPowerRankings();
    if (rows.length) return `Best career-average Power Score: ${rows[0].manager} (${rows[0].score.toFixed(1)}).`;
  }

  // Power Score for a specific manager -- defaults to the most recent FINISHED season if none
  // given, same as the Power Rankings tab (a few weeks of an in-progress season isn't a fair default)
  if (mgrs.length === 1 && /power (score|rank|ranking)/.test(lower)) {
    const season = yr || latestFinishedSeason();
    const rows = computePowerRankings(season);
    const idx = rows.findIndex(r => r.manager === mgrs[0]);
    if (idx !== -1) {
      return `${mgrs[0]}'s Power Score in ${season}: ${rows[idx].score.toFixed(1)} (ranked #${idx + 1} of ${rows.length}).` + inProgressPowerNote(yr);
    }
    return `No Power Rankings data for ${mgrs[0]} in ${season}.`;
  }

  // Keeper History: "who did X keep in Y" / "what has X kept" -- must come before the generic
  // manager+year fallback below, since a query like "what did X keep in 2018" has both a manager
  // and a year and would otherwise be swallowed by that broader check.
  if (mgrs.length === 1 && /keep|keeper|kept/.test(lower)) {
    const kept = KEEPER_HISTORY.filter(k => k.manager === mgrs[0] && (!yr || k.year === yr));
    if (kept.length) {
      const list = kept.map(k => `${k.year}: ${k.player} (R${k.round})`).join('; ');
      return `${mgrs[0]}'s keeper history${yr ? ' in ' + yr : ''}: ${list}`;
    } else if (yr) {
      return `${mgrs[0]} has no recorded keeper for ${yr}.`;
    }
  }

  // Team name -- before the roster lookup, whose "team" trigger would otherwise answer with a roster.
  if (mgrs.length === 1 && /team name/.test(lower)) {
    const season = yr || Math.max(...RAW.map(d => d.season));
    const rec = RAW.find(d => d.season === season && d.manager === mgrs[0]);
    if (rec) return `${mgrs[0]}'s team name in ${season}${season === CURRENT_SEASON.year ? ' is' : ' was'} "${rec.team}".`;
  }

  // Roster lookup: "who is on X's roster" / "what does X have" -- deliberately checked after
  // Keeper History above, since "who has X kept" would otherwise match a loose "who...has" here first.
  if (mgrs.length === 1 && /(roster|team|squad|what does .* have|who does .* have)/.test(lower) && typeof rosters2025Data !== 'undefined') {
    const players = rosters2025Data.filter(r => r.manager === mgrs[0]);
    if (players.length) {
      const list = players.map(p => `${p.player} (${p.position})`).join(', ');
      return `${mgrs[0]}'s 2025 season-end roster (${players.length} players): ${list}. (Current ${CURRENT_SEASON.year} rosters are in Sleeper.)`;
    }
  }

  // Reverse lookup: "who has [player]" / "who owns [player]". The only roster data this page has
  // is 2025 season-end (plus 2026 keepers), so answers say exactly that rather than "currently" --
  // a 2025 roster is not a current one (e.g. Jonathan Taylor ended 2025 on Josh's team but was
  // drafted by Mac in 2026).
  if (player && /(who (has|owns)|whose roster|which team)/.test(lower) && typeof rosters2025Data !== 'undefined') {
    const keeper26 = KEEPER_SELECTIONS_2026.find(k => k.player.toLowerCase() === player.toLowerCase());
    const keeperNote = keeper26 ? ` ${keeper26.manager} kept him for ${CURRENT_SEASON.year} (Round ${keeper26.round}).` : '';
    const hit = rosters2025Data.find(r => r.player.toLowerCase() === player.toLowerCase());
    if (hit) return `${hit.player} finished the 2025 season on ${hit.manager}'s roster (${hit.acquired.toLowerCase()}${hit.detail ? ', ' + hit.detail : ''}).${keeperNote || ` For current ${CURRENT_SEASON.year} rosters, check Sleeper.`}`;
    if (keeper26) return keeperNote.trim();
  }

  // A manager's record / team name in a given year
  if (mgrs.length === 1 && yr) {
    const w = RAW.find(d=>d.season===yr&&d.manager===mgrs[0]&&d.category==='Wins');
    const l = RAW.find(d=>d.season===yr&&d.manager===mgrs[0]&&d.category==='Losses');
    const team = RAW.find(d=>d.season===yr&&d.manager===mgrs[0]);
    const pf = RAW.find(d=>d.season===yr&&d.manager===mgrs[0]&&d.category==='Pts For');
    const inProgress = !getFinishedSeasons().has(yr);
    if (w && l && team) return `In ${yr}, ${mgrs[0]} ${inProgress ? 'is' : 'went'} ${recordStr(w.value, l.value, tiesFor(mgrs[0], yr))}${pf ? ` with ${fmt(pf.value, 1)} points for` : ''} playing as "${team.team}"${inProgress ? ' (season in progress)' : ''}.`;
  }

  // Standings leader for one season ("who has the most wins this season", "who is in first place").
  // Ties stay ties, same as Live Standings: sorted by wins then points for, and anyone level on both shares the lead.
  if (!mgrs.length && /(most wins|best record|first place|in first|standings leader|leading the league|top of the standings)/.test(lower) &&
      (yr || /first place|in first|standings leader|leading the league|top of the standings/.test(lower))) {
    const season = yr || Math.max(...RAW.map(d => d.season));
    const rows = managers.map(m => ({ m, w: valueFor(m, season, 'Wins'), l: valueFor(m, season, 'Losses'), t: tiesFor(m, season), pf: valueFor(m, season, 'Pts For') }))
      .filter(r => r.w !== null).map(r => ({ ...r, pct: winPctOf(r.w, r.l, r.t) })).sort((a, b) => b.pct - a.pct || b.pf - a.pf);
    if (rows.length) {
      const top = rows.filter(r => r.pct === rows[0].pct && r.pf === rows[0].pf);
      const weeks = GAMES.filter(g => g.season === season && g.type === 'regular').reduce((mx, g) => Math.max(mx, g.week), 0);
      const through = getFinishedSeasons().has(season) ? 'regular season' : `through Week ${weeks}`;
      return `${season} standings leader (${through}): ${top.map(r => `${r.m}, ${recordStr(r.w, r.l, r.t)} with ${fmt(r.pf, 1)} points for`).join(' & ')}.`;
    }
  }

  // Single-season records (finished seasons only) -- "most points in a single season" etc.
  if (!mgrs.length && /(single.season|one season|in a season|single year)/.test(lower)) {
    const finished = getFinishedSeasons();
    const record = (cat, pickMax) => {
      const rows = RAW.filter(d => d.category === cat && finished.has(d.season));
      const target = pickMax ? Math.max(...rows.map(r => r.value)) : Math.min(...rows.map(r => r.value));
      return rows.filter(r => r.value === target).map(r => `${r.manager} (${r.season})`).join(' & ') + ` — ${fmt(target, cat === 'Wins' ? 0 : 1)}`;
    };
    const least = /least|fewest|lowest|worst/.test(lower);
    if (/point/.test(lower)) return `${least ? 'Fewest' : 'Most'} points in a single season: ${record('Pts For', !least)}.`;
    if (/win/.test(lower)) return `${least ? 'Fewest' : 'Most'} wins in a single season: ${record('Wins', !least)}.`;
  }

  // Career wins leader
  if (/(most (career )?wins|winningest)/.test(lower)) {
    const totals = managers.map(m => ({ m, v: RAW.filter(d=>d.manager===m&&d.category==='Wins').reduce((a,b)=>a+b.value,0) }));
    const max = Math.max(...totals.map(t=>t.v));
    const leaders = totals.filter(t=>t.v===max).map(t=>t.m);
    return `Most career wins: ${leaders.join(' & ')} with ${fmt(max)} wins.`;
  }

  // Career points leader
  if (/(most (career )?points|highest scor)/.test(lower) && !mgrs.length) {
    const totals = managers.map(m => ({ m, v: RAW.filter(d=>d.manager===m&&d.category==='Pts For').reduce((a,b)=>a+b.value,0) }));
    const max = Math.max(...totals.map(t=>t.v));
    const leaders = totals.filter(t=>t.v===max).map(t=>t.m);
    return `Most career points: ${leaders.join(' & ')} with ${fmt(max,1)} points.`;
  }

  // Bridesmaid
  if (/bridesmaid|most runner.up/.test(lower)) {
    const totals = managers.map(m => ({ m, v: RAW.filter(d=>d.manager===m&&d.category==='Playoff Standings'&&d.value===2).length }));
    const max = Math.max(...totals.map(t=>t.v));
    const leaders = totals.filter(t=>t.v===max).map(t=>t.m);
    return `Bridesmaid (most runner-up finishes): ${leaders.join(' & ')} with ${max}.`;
  }

  // Career Sacko
  if (/most sacko|biggest sacko|career sacko/.test(lower)) {
    const totals = managers.map(m => ({ m, v: RAW.filter(d=>d.manager===m&&d.category==='Playoff Standings'&&d.value===12).length }));
    const max = Math.max(...totals.map(t=>t.v));
    const leaders = totals.filter(t=>t.v===max).map(t=>t.m);
    return `Career Sacko leader: ${leaders.join(' & ')} with ${max} last-place finishes.`;
  }

  // Power Rankings #1 for a season, no manager specified
  if (!mgrs.length && /(best power score|top power rank|#1 power rank|power rankings? (leader|top))/.test(lower)) {
    const season = yr || latestFinishedSeason();
    const rows = computePowerRankings(season);
    if (rows.length) return `${season} Power Rankings #1: ${rows[0].manager} (score ${rows[0].score.toFixed(1)}).` + inProgressPowerNote(yr);
  }

  // Best value keeper league-wide -- deliberately requires no manager in the query, since a
  // manager-specific "keeper" question is already handled by the Keeper History branch above.
  if (!mgrs.length && /best value keeper|best keeper (pick|value)/.test(lower)) {
    const rows = computeValueKeepers();
    if (rows.length) {
      const top = rows[0];
      return `Best value keeper: ${top.player} (${top.manager}), kept ${top.timesKept} times (${top.years.join(', ')}), first kept as a Round ${top.firstRound} pick.`;
    }
    return "No player has been kept 2+ times yet.";
  }

  // Longest win streak
  if (/(longest (win )?streak|win streak)/.test(lower)) {
    const sorted = [...GAMES].sort((a,b) => a.season-b.season || a.week-b.week);
    const streaks = {}, current = {}, lastSeason = {};
    managers.forEach(m => { streaks[m] = {len:0}; current[m]=0; lastSeason[m]=null; });
    sorted.forEach(g => {
      const win = winnerOf(g);
      [g.mA, g.mB].forEach(m => {
        if (lastSeason[m] !== null && lastSeason[m] !== g.season) current[m] = 0;
        lastSeason[m] = g.season;
        if (m === win) {
          current[m]++;
          if (current[m] > streaks[m].len) streaks[m] = { len: current[m], season: g.season };
        } else current[m] = 0;
      });
    });
    const top = managers.map(m => ({m, ...streaks[m]})).sort((a,b)=>b.len-a.len)[0];
    return `Longest win streak: ${top.manager||top.m} with ${top.len} straight wins in ${top.season}.`;
  }

  // Closest game / biggest blowout all-time
  const gamePool = yr ? GAMES.filter(g => g.season === yr) : GAMES;
  const poolLabel = yr ? `of ${yr}` : 'ever';
  if (/(closest game|closest margin|narrowest)/.test(lower) && gamePool.length) {
    const sorted = gamePool.filter(g=>g.sA!==g.sB).sort((a,b)=>marginOf(a)-marginOf(b));
    const g = sorted[0];
    const win = winnerOf(g);
    const lose = win===g.mA ? g.mB : g.mA;
    return `Closest game ${poolLabel}: ${win} beat ${lose} ${fmt(Math.max(g.sA,g.sB),1)}-${fmt(Math.min(g.sA,g.sB),1)} in ${g.season} Week ${g.week}, a margin of just ${fmt(marginOf(g),2)} points.`;
  }
  if (/(blowout|biggest margin|biggest win|most lopsided)/.test(lower) && gamePool.length) {
    const sorted = gamePool.filter(g=>g.sA!==g.sB).sort((a,b)=>marginOf(b)-marginOf(a));
    const g = sorted[0];
    const win = winnerOf(g);
    const lose = win===g.mA ? g.mB : g.mA;
    return `Biggest blowout ${poolLabel}: ${win} beat ${lose} ${fmt(Math.max(g.sA,g.sB),1)}-${fmt(Math.min(g.sA,g.sB),1)} in ${g.season} Week ${g.week}, a margin of ${fmt(marginOf(g),1)} points.`;
  }

  // Playoff tiebreakers -- a specific short fact, not a full settings dump. Deliberately
  // extracted as its own direct answer rather than folded into the general blob below, since
  // someone asking specifically "how are tiebreakers determined" wants that one sentence, not
  // the entire Playoffs/Waivers/Trades/Format section it happens to live inside in the data.
  if (/(tiebreak|tie break|tie-break|ties broken|playoff seed)/.test(lower)) {
    return "Playoff seeding is set by regular-season record. Ties are broken first by total points scored, then by total points scored against.";
  }

  // Live, per-season facts from CURRENT_SEASON (not the static LEAGUE_SETTINGS blobs below) --
  // these need to come before the general settings-topic loop so a specific date question gets
  // the specific date, not the whole general settings blob.
  if (/(fee|dues)/.test(lower)) {
    return CURRENT_SEASON.leagueFeeAmount ? `League fee is ${CURRENT_SEASON.leagueFeeAmount}, due ${formatDateTime(CURRENT_SEASON.leagueFeeDeadline)}.` : "The league fee hasn't been set for this season yet.";
  }
  // Draft order is checked before draft date, and draft date explicitly excludes "order" in its
  // own trigger below -- otherwise a question about draft ORDER ("when is the draft order
  // determined") gets wrongly matched by the looser "when.*draft" pattern and answered with the
  // draft DATE instead. Found this by actually running the query, not by inspecting the regex.
  if (/draft order|order.*determined|who picks first|who goes first/.test(lower)) {
    if (CURRENT_SEASON.draftOrder && CURRENT_SEASON.draftOrder.length) {
      return `${CURRENT_SEASON.year} draft order: ${CURRENT_SEASON.draftOrder.join(', ')}.`;
    }
    return "The 2026 draft order isn't set yet -- it's determined by the F1 Dutch Grand Prix (Sunday, Aug 23, 2026) and will be posted here once the race is run.";
  }
  if (/draft date|what time.*draft|(when.*draft(?!.*order))/.test(lower) && !yr) {
    return CURRENT_SEASON.draftDate ? `This season's draft is ${formatDateTime(CURRENT_SEASON.draftDate)}.` : "The draft date hasn't been set for this season yet.";
  }
  if (/keeper lock/.test(lower)) {
    const lockDate = computeKeeperLockDate(CURRENT_SEASON);
    return lockDate ? `Keeper lock date is ${formatDateTime(lockDate)}.` : "The keeper lock date hasn't been set for this season yet.";
  }
  if (/trade deadline/.test(lower)) {
    if (CURRENT_SEASON.tradeDeadline) return `Trade deadline is ${formatDateTime(CURRENT_SEASON.tradeDeadline)}.`;
    if (CURRENT_SEASON.tradeDeadlineWeek) return `Trade deadline is Week ${CURRENT_SEASON.tradeDeadlineWeek} (per Sleeper).`;
    return { html: LEAGUE_SETTINGS.general };
  }
  if (/playoffs? (start|begin)|when (do|does|are) (the )?playoffs/.test(lower)) {
    if (CURRENT_SEASON.playoffStart) return `Playoffs start ${formatDateTime(CURRENT_SEASON.playoffStart)}.`;
    if (CURRENT_SEASON.playoffStartWeek) return `Playoffs start in Week ${CURRENT_SEASON.playoffStartWeek} (per Sleeper).`;
    return { html: LEAGUE_SETTINGS.general };
  }

  // League-settings lookup: one alias-matching engine with broad natural phrasings per topic. roster
  // and keeperRules are gated on !mgrs.length so a named manager goes to the per-manager Roster /
  // Keeper History branches above instead.
  const SETTINGS_TOPICS = {
    scoring: {
      aliases: ['scoring', 'points per', 'ppr', 'point value', 'how many points', 'touchdown worth',
        'reception worth', 'field goal', 'passing yard', 'rushing yard', 'receiving yard', 'points allowed'],
      html: LEAGUE_SETTINGS.scoring, fallback: "Scoring settings haven't been added yet.", guard: true,
    },
    roster: {
      aliases: ['roster', 'starting lineup', 'bench spot', 'injured reserve', 'ir slot', 'flex spot', 'lineup requirement'],
      html: LEAGUE_SETTINGS.roster, fallback: "Roster settings haven't been added yet.", guard: !mgrs.length,
    },
    keeperRules: {
      aliases: ['keeper rule', 'keeper cost', 'keeper limit', 'keeper eligib', 'how many years can', 'how many keepers', 'keepers can',
        'keeper duration', 'how does keeper', 'keeper round', 'keeper deadline'],
      html: LEAGUE_SETTINGS.keeper, fallback: "Keeper rules haven't been added yet.", guard: !mgrs.length,
    },
    draftRules: {
      aliases: ['snake', 'autopick', 'auto pick', 'time per pick', 'draft format', 'draft type', 'draft rule'],
      html: LEAGUE_SETTINGS.draftRules, fallback: "Draft rules haven't been added yet.", guard: true,
    },
    draftPickRules: {
      aliases: ['draft pick rule', 'pick trading rule', 'future pick rule', 'trade draft picks',
        'trade a pick', 'trade picks', 'tradable pick', 'trading picks', 'pick for pick', 'pick-for-pick',
        'how many picks can', 'how many picks may'],
      html: LEAGUE_SETTINGS.draftPickRules, fallback: "Draft pick rules haven't been added yet.", guard: true,
    },
    general: {
      aliases: ['general settings', 'league settings', 'league format', 'how many teams', 'league type',
        'faab', 'waiver', 'trade review', 'transaction rule', 'competitive lineup', 'reasonable lineup',
        'toilet bowl', 'recusal', 'recuse', 'tanking', 'collusion'],
      html: LEAGUE_SETTINGS.general, fallback: "General settings haven't been added yet.", guard: true,
    },
  };
  for (const topic of Object.values(SETTINGS_TOPICS)) {
    if (topic.guard && topic.aliases.some(a => lower.includes(a))) {
      return { html: topic.html || topic.fallback };
    }
  }

  // Clarify instead of failing, but only when a recognized stat keyword was found and the problem is
  // "which manager?". A topic-less query ("how's Jerome doing?") falls through to the generic fallback.
  if (careerStatKey) {
    const label = TICKER_STATS[careerStatKey].label;
    return `I can tell that's about ${label}, but not whose. Try naming one manager (e.g. "Jerome's ${label}") or ask "who has the best ${label}".`;
  }
  if (/power (score|rank|ranking)/.test(lower)) {
    return `I can tell that's about Power Score, but not whose. Try naming one manager (e.g. "Jerome's power score") or ask "who has the best power score".`;
  }

  return null;
}


const KEEPER_HISTORY = computeKeeperHistory();

let rosters2025Data = ROSTERS_2025_VERIFIED;
