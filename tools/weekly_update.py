#!/usr/bin/env python3
"""
weekly_update.py -- adds one finished week of the current season to data/games.json and
data/raw.json, straight from Sleeper. Handles regular-season and playoff weeks.

    python3 tools/weekly_update.py <week>          # run from the repo root

Regular-season weeks (before the league's playoff_week_start):
  1. Refuses unless that week is final in Sleeper (every roster's wins+losses+ties >= week),
     isn't already in games.json, and every earlier week is.
  2. Appends the week's 6 matchups to games.json (type "regular"; append-only), with each
     manager's current team name from raw.json.
  3. Recomputes the season's 5 in-progress RAW categories (Wins, Losses, Pts For, Pts Against,
     Pts Differential) from games.json and updates those rows IN PLACE -- never appends.
  4. Cross-checks the new totals against Sleeper's own standings (roster settings) and refuses
     to write anything if they disagree.

Playoff weeks (playoff_week_start and later):
  1. Refuses unless every bracket game of that round (winners and losers brackets) has a
     winner, and Sleeper's matchups for the week are exactly those bracket pairings.
  2. Appends them to games.json as type "playoff". Teams with no game that week (eliminated
     from both brackets) are skipped, so a playoff week can have fewer than 6 games.
  3. Leaves RAW alone -- its Wins/Losses/points are regular-season only -- but still checks
     those totals against Sleeper's standings, which also stop at the regular season.
  End-of-season rows (standings, playoff finishes, playoff wins) come from tools/season_end.py.

Ties count as neither a win nor a loss in RAW (RAW has no Ties category; the dashboard derives
ties from games.json). Run validate.py afterwards, then update BUILD_DATE in index.html.

Testing against a past season: --league <id> --season <year> --data-dir <copy of data/> --dry-run
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

IN_PROGRESS_CATEGORIES = ["Wins", "Losses", "Pts For", "Pts Against", "Pts Differential"]


def sleeper(path):
    # api.sleeper.* rejects some default script user-agents
    req = urllib.request.Request(f"https://api.sleeper.app/v1/{path}", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def from_html(pattern, html):
    m = re.search(pattern, html, re.S)
    if not m:
        sys.exit(f"index.html: couldn't find {pattern!r}")
    return m.group(1)


def regular_totals(games, season):
    totals = {}
    for g in games:
        if g["season"] != season or g["type"] != "regular":
            continue
        for m, pf, pa in ((g["mA"], g["sA"], g["sB"]), (g["mB"], g["sB"], g["sA"])):
            t = totals.setdefault(m, {"Wins": 0, "Losses": 0, "Pts For": 0.0, "Pts Against": 0.0})
            t["Wins"] += pf > pa
            t["Losses"] += pf < pa
            t["Pts For"] += pf
            t["Pts Against"] += pa
    return totals


def standings_mismatches(totals, rosters, manager_of):
    problems = []
    for r in rosters:
        m, s = manager_of[r["roster_id"]], r["settings"]
        theirs = {"Wins": s["wins"], "Losses": s["losses"],
                  "Pts For": s.get("fpts", 0) + s.get("fpts_decimal", 0) / 100,
                  "Pts Against": s.get("fpts_against", 0) + s.get("fpts_against_decimal", 0) / 100}
        for cat, val in theirs.items():
            if abs(totals.get(m, {}).get(cat, 0) - val) > 0.011:
                problems.append(f"{m} {cat}: games.json {round(totals.get(m, {}).get(cat, 0), 2)} vs Sleeper {round(val, 2)}")
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("week", type=int)
    ap.add_argument("--league", help="Sleeper league ID (default: SLEEPER_LEAGUE_ID in index.html)")
    ap.add_argument("--season", type=int, help="season year (default: CURRENT_SEASON.year in index.html)")
    ap.add_argument("--data-dir", default="data", help="folder holding raw.json and games.json")
    ap.add_argument("--dry-run", action="store_true", help="print what would be written, write nothing")
    args = ap.parse_args()
    week = args.week

    html = Path("index.html").read_text(encoding="utf-8")
    league_id = args.league or from_html(r'const SLEEPER_LEAGUE_ID = "(\d+)"', html)
    season = args.season or int(from_html(r"const CURRENT_SEASON = \{\s*year: (\d+)", html))
    name_map = dict(re.findall(r"'([^']+)':\s*'([^']+)'", from_html(r"const SLEEPER_USERNAME_TO_MANAGER = \{(.*?)\};", html)))
    raw_path, games_path = Path(args.data_dir) / "raw.json", Path(args.data_dir) / "games.json"

    raw_text, games_text = raw_path.read_text(), games_path.read_text()
    raw, games = json.loads(raw_text), json.loads(games_text)
    if json.dumps(raw) != raw_text or json.dumps(games) != games_text:
        sys.exit("raw.json / games.json aren't in the expected compact format -- refusing to rewrite them")
    if any(g["season"] == season and g["week"] == week for g in games):
        sys.exit(f"Week {week} of {season} is already in games.json")
    missing = [w for w in range(1, week) if not any(g["season"] == season and g["week"] == w for g in games)]
    if missing:
        sys.exit(f"Earlier week(s) {missing} aren't in games.json yet -- add those first")

    league = sleeper(f"league/{league_id}")
    playoff_start = league["settings"].get("playoff_week_start") or 99
    is_playoff = week >= playoff_start
    users = {u["user_id"]: name_map.get(u["display_name"], u["display_name"]) for u in sleeper(f"league/{league_id}/users")}
    rosters = sleeper(f"league/{league_id}/rosters")
    manager_of = {r["roster_id"]: users[r["owner_id"]] for r in rosters}
    played = {manager_of[r["roster_id"]]: r["settings"]["wins"] + r["settings"]["losses"] + r["settings"].get("ties", 0) for r in rosters}
    team_of = {r["manager"]: r["team"] for r in raw if r["season"] == season}

    pairs = {}
    for m in sleeper(f"league/{league_id}/matchups/{week}"):
        if m.get("matchup_id") is None:
            continue  # no game this week (only happens in the playoffs)
        pairs.setdefault(m["matchup_id"], []).append(m)

    if is_playoff:
        rnd = week - playoff_start + 1
        bracket = [m for b in ("winners_bracket", "losers_bracket") for m in sleeper(f"league/{league_id}/{b}") if m["r"] == rnd]
        if not bracket:
            sys.exit(f"No bracket games in round {rnd} (week {week}) -- is the season over?")
        undecided = [m for m in bracket if not m.get("w")]
        if undecided:
            sys.exit(f"Week {week} (playoff round {rnd}) isn't final: {len(undecided)} bracket game(s) have no winner yet")
        bracket_pairs = sorted(sorted([manager_of[m["t1"]], manager_of[m["t2"]]]) for m in bracket)
        sleeper_pairs = sorted(sorted(manager_of[x["roster_id"]] for x in p) for p in pairs.values())
        if bracket_pairs != sleeper_pairs:
            sys.exit(f"Week {week} matchups don't match the playoff bracket:\n  bracket: {bracket_pairs}\n  matchups: {sleeper_pairs}")
    elif min(played.values()) < week:
        sys.exit(f"Week {week} isn't final in Sleeper yet (games played per team: {sorted(set(played.values()))})")

    new_games = []
    for mid in sorted(pairs):
        if len(pairs[mid]) != 2:
            sys.exit(f"Matchup {mid} doesn't have exactly 2 teams")
        a, b = pairs[mid]
        ma, mb = manager_of[a["roster_id"]], manager_of[b["roster_id"]]
        new_games.append({"season": season, "week": week, "type": "playoff" if is_playoff else "regular",
                          "mA": ma, "tA": team_of[ma], "sA": round(a["points"], 2),
                          "mB": mb, "tB": team_of[mb], "sB": round(b["points"], 2)})

    games += new_games
    totals = regular_totals(games, season)

    # Sleeper's standings (roster settings) are regular-season only, so they can be checked whenever
    # they cover exactly the regular-season weeks in games.json: this week (regular) or all of them (playoffs).
    regular_weeks = len({g["week"] for g in games if g["season"] == season and g["type"] == "regular"})
    if max(played.values()) == regular_weeks:
        problems = standings_mismatches(totals, rosters, manager_of)
        if problems:
            sys.exit("Totals don't match Sleeper's standings -- nothing written:\n  " + "\n  ".join(problems))
        print("Cross-check: regular-season totals match Sleeper's standings for all managers.")
    else:
        print("Note: Sleeper's standings cover a different number of weeks, so the standings cross-check was skipped.")

    updated = 0
    if not is_playoff:
        for r in raw:
            if r["season"] == season and r["category"] in IN_PROGRESS_CATEGORIES:
                t = totals[r["manager"]]
                value = t["Pts For"] - t["Pts Against"] if r["category"] == "Pts Differential" else t[r["category"]]
                r["value"] = round(float(value), 2)
                updated += 1

    kind = "playoff" if is_playoff else "regular-season"
    print(f"{'[dry run] ' if args.dry_run else ''}Week {week} ({kind}): +{len(new_games)} games ({len(games)} total); "
          f"raw.json: {updated} rows updated in place{' (unchanged in the playoffs)' if is_playoff else ''}")
    for g in new_games:
        print(f"  {g['mA']:16} {g['sA']:7.2f}  vs  {g['sB']:7.2f}  {g['mB']}")
    if args.dry_run:
        return
    games_path.write_text(json.dumps(games))
    raw_path.write_text(json.dumps(raw))
    print("Next: python3 validate.py, then update BUILD_DATE in index.html."
          + (" When the last playoff week is in, run tools/season_end.py." if is_playoff else ""))


if __name__ == "__main__":
    main()
