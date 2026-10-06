#!/usr/bin/env python3
"""
weekly_update.py -- adds one finished week of the current season to data/games.json and
data/raw.json, straight from Sleeper.

    python3 tools/weekly_update.py <week>          # run from the repo root

What it does (the "Weekly update procedure" in the project handoff, automated):
  1. Refuses unless that week is final in Sleeper (every roster's wins+losses+ties >= week)
     and not already in games.json.
  2. Appends the week's 6 matchups to games.json (append-only), with each manager's current
     team name from raw.json.
  3. Recomputes the season's 5 in-progress RAW categories (Wins, Losses, Pts For, Pts Against,
     Pts Differential) from games.json and updates those rows IN PLACE -- never appends.
  4. Cross-checks the new totals against Sleeper's own server-side standings
     (roster settings) and refuses to write anything if they disagree.

Ties count as neither a win nor a loss in RAW (RAW has no Ties category; the dashboard derives
ties from games.json). Run validate.py afterwards, then update BUILD_DATE in index.html.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(".")
HTML = ROOT / "index.html"
RAW_PATH = ROOT / "data" / "raw.json"
GAMES_PATH = ROOT / "data" / "games.json"
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


def main():
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        sys.exit(__doc__)
    week = int(sys.argv[1])

    html = HTML.read_text(encoding="utf-8")
    league_id = from_html(r'const SLEEPER_LEAGUE_ID = "(\d+)"', html)
    season = int(from_html(r"const CURRENT_SEASON = \{\s*year: (\d+)", html))
    name_map = dict(re.findall(r"'([^']+)':\s*'([^']+)'", from_html(r"const SLEEPER_USERNAME_TO_MANAGER = \{(.*?)\};", html)))

    raw_text, games_text = RAW_PATH.read_text(), GAMES_PATH.read_text()
    raw, games = json.loads(raw_text), json.loads(games_text)
    if json.dumps(raw) != raw_text or json.dumps(games) != games_text:
        sys.exit("raw.json / games.json aren't in the expected compact format -- refusing to rewrite them")
    if any(g["season"] == season and g["week"] == week for g in games):
        sys.exit(f"Week {week} of {season} is already in games.json")
    missing = [w for w in range(1, week) if not any(g["season"] == season and g["week"] == w for g in games)]
    if missing:
        sys.exit(f"Earlier week(s) {missing} aren't in games.json yet -- add those first")

    users = {u["user_id"]: name_map.get(u["display_name"], u["display_name"]) for u in sleeper(f"league/{league_id}/users")}
    rosters = sleeper(f"league/{league_id}/rosters")
    manager_of = {r["roster_id"]: users[r["owner_id"]] for r in rosters}
    played = {manager_of[r["roster_id"]]: r["settings"]["wins"] + r["settings"]["losses"] + r["settings"].get("ties", 0) for r in rosters}
    if min(played.values()) < week:
        sys.exit(f"Week {week} isn't final in Sleeper yet (games played per team: {sorted(set(played.values()))})")

    team_of = {r["manager"]: r["team"] for r in raw if r["season"] == season}
    pairs = {}
    for m in sleeper(f"league/{league_id}/matchups/{week}"):
        pairs.setdefault(m["matchup_id"], []).append(m)
    new_games = []
    for mid in sorted(pairs):
        if len(pairs[mid]) != 2:
            sys.exit(f"Matchup {mid} doesn't have exactly 2 teams")
        a, b = pairs[mid]
        ma, mb = manager_of[a["roster_id"]], manager_of[b["roster_id"]]
        new_games.append({"season": season, "week": week, "type": "regular",
                          "mA": ma, "tA": team_of[ma], "sA": round(a["points"], 2),
                          "mB": mb, "tB": team_of[mb], "sB": round(b["points"], 2)})

    games += new_games
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

    # Cross-check against Sleeper's own standings before writing anything (only meaningful when
    # Sleeper's standings are exactly through this week, i.e. nothing later has been played).
    if max(played.values()) == week:
        problems = []
        for r in rosters:
            m, s = manager_of[r["roster_id"]], r["settings"]
            theirs = {"Wins": s["wins"], "Losses": s["losses"],
                      "Pts For": s.get("fpts", 0) + s.get("fpts_decimal", 0) / 100,
                      "Pts Against": s.get("fpts_against", 0) + s.get("fpts_against_decimal", 0) / 100}
            for cat, val in theirs.items():
                if abs(totals[m][cat] - val) > 0.011:
                    problems.append(f"{m} {cat}: games.json {round(totals[m][cat], 2)} vs Sleeper {round(val, 2)}")
        if problems:
            sys.exit("Totals don't match Sleeper's standings -- nothing written:\n  " + "\n  ".join(problems))
        print("Cross-check: totals match Sleeper's standings for all managers.")
    else:
        print("Note: Sleeper's standings are past this week, so the standings cross-check was skipped.")

    updated = 0
    for r in raw:
        if r["season"] == season and r["category"] in IN_PROGRESS_CATEGORIES:
            t = totals[r["manager"]]
            value = t["Pts For"] - t["Pts Against"] if r["category"] == "Pts Differential" else t[r["category"]]
            r["value"] = round(float(value), 2)
            updated += 1

    GAMES_PATH.write_text(json.dumps(games))
    RAW_PATH.write_text(json.dumps(raw))
    print(f"games.json: +{len(new_games)} rows ({len(games)} total); raw.json: {updated} rows updated in place")
    for g in new_games:
        print(f"  {g['mA']:16} {g['sA']:7.2f}  vs  {g['sB']:7.2f}  {g['mB']}")
    print("Next: python3 validate.py, then update BUILD_DATE in index.html.")


if __name__ == "__main__":
    main()
