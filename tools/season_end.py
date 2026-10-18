#!/usr/bin/env python3
"""
season_end.py -- once a season's playoffs are complete, adds its end-of-season rows to
data/raw.json: Regular Season Standings, Playoff Standings and Playoff Wins (one each per manager).
Those rows are what mark a season as finished everywhere on the dashboard (getFinishedSeasons()).

    python3 tools/season_end.py               # run from the repo root, after the last playoff week
    python3 tools/season_end.py --check       # compute and compare to existing rows; write nothing

Everything comes from Sleeper and games.json, and is cross-checked before anything is written:
  - Refuses unless every bracket game (winners and losers brackets) has a winner, and every one of
    them is in games.json as a playoff game with the same winner (run tools/weekly_update.py first).
  - Regular Season Standings: by win % (a tie = half a win), then points for -- the league's
    tiebreak. If two teams are still level after that, it stops and asks rather than guessing.
    The order is then checked against Sleeper's actual round-1 seeding (1v8, 4v5, 3v6, 2v7 in the
    main bracket; 9v12, 10v11 in the losers bracket).
  - Playoff Standings: from the bracket placement games. Main bracket game "p" decides places p and
    p+1; the losers bracket's are offset by the number of playoff teams (its p=1 game = 9th/10th).
  - Playoff Wins: wins on the championship path only (round 1, then games between round-1 winners,
    then the final) -- consolation and placement wins don't count. This matches every season
    2012-2025 in raw.json (champion 3, runner-up 2, semi-final losers 1), except 2023's runner-up,
    which raw.json records as 1.

Testing against a past season: --league <id> --season <year> --check
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

END_CATEGORIES = ["Regular Season Standings", "Playoff Standings", "Playoff Wins"]


def sleeper(path):
    req = urllib.request.Request(f"https://api.sleeper.app/v1/{path}", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def from_html(pattern, html):
    m = re.search(pattern, html, re.S)
    if not m:
        sys.exit(f"index.html: couldn't find {pattern!r}")
    return m.group(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--league", help="Sleeper league ID (default: SLEEPER_LEAGUE_ID in index.html)")
    ap.add_argument("--season", type=int, help="season year (default: CURRENT_SEASON.year in index.html)")
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--check", action="store_true", help="compare with existing rows instead of writing")
    args = ap.parse_args()

    html = Path("index.html").read_text(encoding="utf-8")
    league_id = args.league or from_html(r'const SLEEPER_LEAGUE_ID = "(\d+)"', html)
    season = args.season or int(from_html(r"const CURRENT_SEASON = \{\s*year: (\d+)", html))
    name_map = dict(re.findall(r"'([^']+)':\s*'([^']+)'", from_html(r"const SLEEPER_USERNAME_TO_MANAGER = \{(.*?)\};", html)))
    raw_path, games_path = Path(args.data_dir) / "raw.json", Path(args.data_dir) / "games.json"
    raw_text = raw_path.read_text()
    raw, games = json.loads(raw_text), json.loads(games_path.read_text())
    if json.dumps(raw) != raw_text:
        sys.exit("raw.json isn't in the expected compact format -- refusing to rewrite it")

    existing = [r for r in raw if r["season"] == season and r["category"] in END_CATEGORIES]
    if existing and not args.check:
        sys.exit(f"{season} already has {len(existing)} end-of-season rows in raw.json -- nothing to do")

    league = sleeper(f"league/{league_id}")
    n_playoff = league["settings"].get("playoff_teams") or 8
    playoff_start = league["settings"].get("playoff_week_start")
    users = {u["user_id"]: name_map.get(u["display_name"], u["display_name"]) for u in sleeper(f"league/{league_id}/users")}
    manager_of = {r["roster_id"]: users[r["owner_id"]] for r in sleeper(f"league/{league_id}/rosters")}
    winners = sleeper(f"league/{league_id}/winners_bracket")
    losers = sleeper(f"league/{league_id}/losers_bracket")

    # 1. Bracket complete, and every game recorded in games.json with the same winner.
    problems = []
    playoff_games = [g for g in games if g["season"] == season and g["type"] == "playoff"]
    for name, bracket in (("winners", winners), ("losers", losers)):
        for m in bracket:
            if not m.get("w"):
                problems.append(f"{name} bracket game {m['m']} (round {m['r']}) has no winner yet")
                continue
            week = playoff_start + m["r"] - 1
            pair = {manager_of[m["t1"]], manager_of[m["t2"]]}
            g = next((g for g in playoff_games if g["week"] == week and {g["mA"], g["mB"]} == pair), None)
            if not g:
                problems.append(f"{name} bracket game {m['m']} ({' vs '.join(sorted(pair))}, week {week}) isn't in games.json")
            elif (g["mA"] if g["sA"] > g["sB"] else g["mB"]) != manager_of[m["w"]]:
                problems.append(f"{name} bracket game {m['m']}: games.json winner differs from Sleeper's")
    if problems:
        sys.exit("Can't finish the season yet:\n  " + "\n  ".join(problems))

    # 2. Regular Season Standings: win % (tie = half a win), then points for.
    rec = {}
    for g in games:
        if g["season"] != season or g["type"] != "regular":
            continue
        for m, pf, pa in ((g["mA"], g["sA"], g["sB"]), (g["mB"], g["sB"], g["sA"])):
            t = rec.setdefault(m, {"w": 0, "l": 0, "t": 0, "pf": 0.0})
            t["w"] += pf > pa
            t["l"] += pf < pa
            t["t"] += pf == pa
            t["pf"] += pf
    pct = lambda t: (t["w"] + t["t"] / 2) / (t["w"] + t["l"] + t["t"])
    order = sorted(rec, key=lambda m: (-pct(rec[m]), -round(rec[m]["pf"], 2)))
    level = [(a, b) for a, b in zip(order, order[1:]) if pct(rec[a]) == pct(rec[b]) and round(rec[a]["pf"], 2) == round(rec[b]["pf"], 2)]
    if level:
        sys.exit(f"Still tied after win % and points for: {level} -- the league needs to decide; nothing written")
    reg_rank = {m: i + 1 for i, m in enumerate(order)}

    def seeds_ok(bracket, offset, pattern):
        r1 = sorted(sorted(reg_rank[manager_of[t]] - offset for t in (m["t1"], m["t2"])) for m in bracket if m["r"] == 1)
        return r1 == sorted(pattern)
    standard8 = [[1, 8], [4, 5], [3, 6], [2, 7]]
    if not (seeds_ok(winners, 0, standard8[: n_playoff // 2]) and seeds_ok(losers, n_playoff, [[1, 4], [2, 3]][: len([m for m in losers if m["r"] == 1])])):
        sys.exit("Computed regular-season order doesn't match Sleeper's round-1 seeding -- check the tiebreak; nothing written.\n"
                 + "  computed: " + ", ".join(f"{i}. {m}" for m, i in reg_rank.items()))

    # 3. Playoff Standings from placement games.
    place = {}
    for bracket, offset in ((winners, 0), (losers, n_playoff)):
        for m in bracket:
            if m.get("p"):
                place[manager_of[m["w"]]] = offset + m["p"]
                place[manager_of[m["l"]]] = offset + m["p"] + 1
    if sorted(place.values()) != list(range(1, len(rec) + 1)):
        sys.exit(f"Placement games don't produce places 1-{len(rec)}: {sorted(place.items(), key=lambda x: x[1])}")

    # 4. Playoff Wins: championship-path wins only.
    title_path = set()
    for m in sorted(winners, key=lambda m: m["r"]):
        froms = [m.get("t1_from"), m.get("t2_from")]
        if m["r"] == 1 or (all(f and "w" in f and f["w"] in title_path for f in froms) and m.get("p") in (None, 1)):
            title_path.add(m["m"])
    playoff_wins = {m: 0 for m in rec}
    for m in winners:
        if m["m"] in title_path:
            playoff_wins[manager_of[m["w"]]] += 1

    team_of = {r["manager"]: r["team"] for r in raw if r["season"] == season}
    new_rows = []
    for m in sorted(rec, key=lambda m: place[m]):
        for cat, val in (("Regular Season Standings", reg_rank[m]), ("Playoff Standings", place[m]), ("Playoff Wins", playoff_wins[m])):
            new_rows.append({"season": season, "team": team_of[m], "manager": m, "category": cat, "value": float(val)})
        r = rec[m]
        print(f"  #{place[m]:2} {m:16} reg-season #{reg_rank[m]:2} ({r['w']}-{r['l']}{'-' + str(r['t']) if r['t'] else ''}, {r['pf']:.2f} PF)  playoff wins {playoff_wins[m]}")

    if args.check:
        have = {(r["manager"], r["category"]): r["value"] for r in existing}
        diffs = [f"{r['manager']} {r['category']}: computed {r['value']} vs raw.json {have.get((r['manager'], r['category']))}"
                 for r in new_rows if have.get((r["manager"], r["category"])) != r["value"]]
        print(f"\n--check: {len(new_rows) - len(diffs)} of {len(new_rows)} rows match raw.json" + ("" if not diffs else ":\n  " + "\n  ".join(diffs)))
        return

    raw += new_rows
    raw_path.write_text(json.dumps(raw))
    print(f"\nAdded {len(new_rows)} end-of-season rows for {season}. {season} now counts as a finished season.")
    print("Next: python3 validate.py; node tools/build_all_time_team.js <cache-dir>; update BUILD_DATE;"
          " then see the season-rollover checklist in the project handoff.")


if __name__ == "__main__":
    main()
