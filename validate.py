#!/usr/bin/env python3
"""
validate.py — pre-push sanity check for the Tobermory dashboard.

Run this from the repo root (the folder containing index.html and the
data/ subfolder), right before you push to GitHub. It won't catch
everything, but it catches every failure mode that has actually bitten
this project so far:

  - a data JSON file that isn't valid JSON (e.g. corrupted by a GitHub
    web-editor paste, like the raw.json incident)
  - a data JSON file that's suspiciously small (silent truncation)
  - unbalanced HTML tags (div/table/script/button/select)
  - unbalanced braces/parens in the main inline <script> block
  - a live-fetch helper (fetchFcValues / fetchSleeperJson) that lost
    its `async` keyword
  - a getElementById() call referencing an id that doesn't exist
    anywhere in the HTML
  - a duplicate raw.json row for the same (manager, season, category) --
    valueFor() uses .find(), so a duplicate is silently ignored, not an error
  - a duplicate games.json matchup (same season, week, and pair)
  - any season whose RAW totals (Wins/Losses/Pts For/Pts Against/Pts
    Differential) don't match what its regular-season GAMES rows add up to --
    the weekly live-update cross-check, and a guard on history (a 2025 tie was
    once stored in RAW as a win for one side)

Usage:
    python3 validate.py
    python3 validate.py /path/to/repo

No dependencies beyond the Python 3 standard library.
"""

import json
import re
import sys
from pathlib import Path

# Known-good floors. These are lower bounds, not exact-match targets --
# exact counts will grow over the season (more games, more picks) and
# a hard equality check would start crying wolf the moment that happens.
# Bump these up occasionally (e.g. once a season wraps) so the floor
# stays meaningful, but there's no need to keep it in lockstep.
MIN_RAW_ROWS = 1300
MIN_GAMES_ROWS = 1300
MIN_DRAFT_SEASONS = 15
MIN_DRAFT_PICKS = 2700

HTML_TAGS_TO_BALANCE = ["div", "table", "script", "button", "select"]


class Result:
    def __init__(self):
        self.failures = []
        self.warnings = []
        self.passes = []

    def ok(self, msg):
        self.passes.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def fail(self, msg):
        self.failures.append(msg)


def check_json_file(path: Path, min_rows: int, result: Result):
    label = path.name
    if not path.exists():
        result.fail(f"{label}: file not found at {path}")
        return None
    raw_text = path.read_text(encoding="utf-8", errors="replace")
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        result.fail(
            f"{label}: NOT VALID JSON ({e.msg} at line {e.lineno}, col {e.colno}). "
            f"This is exactly how the raw.json corruption showed up before -- "
            f"re-upload the file as a raw file (drag-and-drop), don't paste its "
            f"contents into GitHub's web text editor."
        )
        return None
    if not isinstance(data, list):
        result.warn(f"{label}: parsed OK but root is not a list (got {type(data).__name__})")
        return data
    count = len(data)
    if count < min_rows:
        result.fail(
            f"{label}: only {count} rows, expected at least {min_rows}. "
            f"Looks like truncation, not just normal season growth."
        )
    else:
        result.ok(f"{label}: valid JSON, {count} rows")
    return data


def check_draft_data(path: Path, result: Result):
    if not path.exists():
        result.fail(f"drafts.json: file not found at {path}")
        return
    try:
        drafts = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        result.fail(f"drafts.json: NOT VALID JSON ({e.msg} at line {e.lineno})")
        return
    n_seasons = len(drafts)
    n_picks = sum(len(v.get("picks", [])) for v in drafts.values())
    if n_seasons < MIN_DRAFT_SEASONS:
        result.fail(f"DRAFTS: only {n_seasons} seasons, expected at least {MIN_DRAFT_SEASONS}")
    else:
        result.ok(f"DRAFTS: {n_seasons} seasons")
    if n_picks < MIN_DRAFT_PICKS:
        result.fail(f"DRAFTS: only {n_picks} total picks, expected at least {MIN_DRAFT_PICKS}")
    else:
        result.ok(f"DRAFTS: {n_picks} total picks")


def check_tag_balance(html: str, result: Result):
    for tag in HTML_TAGS_TO_BALANCE:
        opens = len(re.findall(rf"<{tag}[\s>]", html))
        closes = len(re.findall(rf"</{tag}>", html))
        if opens != closes:
            result.fail(f"<{tag}>: {opens} opening vs {closes} closing tags (mismatch)")
        else:
            result.ok(f"<{tag}>: balanced ({opens} pairs)")


def find_main_script(html: str):
    first_open = html.find("<script")
    if first_open == -1:
        return None
    second_open = html.find("<script>", first_open + 1)
    if second_open == -1:
        return None
    close = html.find("</script>", second_open)
    if close == -1:
        return None
    return html[second_open:close]


def check_brace_balance(html: str, result: Result):
    script = find_main_script(html)
    if script is None:
        result.warn("Could not isolate the main inline <script> block for brace/paren check")
        return
    ob, cb = script.count("{"), script.count("}")
    op, cp = script.count("("), script.count(")")
    if ob != cb:
        result.fail(f"Main script braces unbalanced: {ob} open vs {cb} close")
    else:
        result.ok(f"Main script braces balanced ({ob} pairs)")
    if op != cp:
        result.fail(f"Main script parens unbalanced: {op} open vs {cp} close")
    else:
        result.ok(f"Main script parens balanced ({op} pairs)")


def check_async_helpers(html: str, result: Result):
    for fn in ["fetchFcValues", "fetchSleeperJson"]:
        if re.search(rf"async function {fn}\s*\(", html):
            result.ok(f"{fn}: has 'async' keyword")
        elif re.search(rf"function {fn}\s*\(", html):
            result.fail(f"{fn}: exists but is MISSING 'async' -- this is the exact bug from before")
        else:
            result.warn(f"{fn}: not found in file at all (may have been renamed/removed)")


def check_appinit_wrapper(html: str, result: Result):
    opens = len(re.findall(r"async function __appInit\(\)", html))
    calls = len(re.findall(r"(?<!function )__appInit\(\)(?:\.catch\(\w+\))?;", html))
    if opens == 1 and calls == 1:
        result.ok("__appInit(): defined once and called once")
    else:
        result.fail(f"__appInit(): found {opens} definition(s) and {calls} call(s), expected 1 and 1")


def check_dangling_ids(html: str, result: Result):
    referenced = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", html))
    defined = set(re.findall(r'id=["\']([^"\']+)["\']', html))
    missing = sorted(referenced - defined)
    if missing:
        result.fail(
            f"{len(missing)} getElementById() call(s) reference id(s) not found in the HTML: "
            + ", ".join(missing[:10])
            + (" ..." if len(missing) > 10 else "")
        )
    else:
        result.ok(f"All {len(referenced)} getElementById() references resolve to a real id")


def check_rosters_2025(path: Path, result: Result):
    if not path.exists():
        result.fail(f"rosters_2025.json: file not found at {path}")
        return
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        result.fail(f"rosters_2025.json: NOT VALID JSON ({e.msg})")
        return
    if len(rows) != 185 or any(not r.get("manager") or not r.get("player") or r.get("acquired") == "NeedsSleeperSync" for r in rows):
        result.fail(f"rosters_2025.json: expected 185 fully resolved rows, got {len(rows)}")
    else:
        result.ok("rosters_2025.json: 185 fully resolved roster rows")


def check_assets(repo_root: Path, html: str, result: Result):
    """Every local file index.html points at (src/href, not http) must exist in the repo."""
    refs = sorted(set(re.findall(r'(?:src|href)="((?:assets|data)/[^"]+)"', html)
                      + re.findall(r'content="https://jprasad22\.github\.io/TAS-Dashboard/((?:assets|data)/[^"]+)"', html)))
    missing = [r for r in refs if not (repo_root / r).exists()]
    if missing:
        result.fail(f"index.html references missing file(s): {missing}")
    else:
        result.ok(f"All {len(refs)} local file references in index.html exist")


def check_lines(path: Path, result: Result):
    """data/lines.json (optional): saved pre-kickoff matchup lines, written by tools/snapshot_lines.js."""
    if not path.exists():
        result.ok("lines.json: not present yet (optional)")
        return
    try:
        saved = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        result.fail(f"lines.json: NOT VALID JSON ({e.msg}) -- the scoreboard will fall back to live lines")
        return
    need = {"mA", "mB", "favourite", "spread", "winA", "winB", "oddsA", "oddsB", "total"}
    bad = [f"{s}/{w}" for s, weeks in saved.items() for w, snap in weeks.items()
           if not (snap.get("takenAt") and snap.get("games") and all(need <= set(g) for g in snap["games"]))]
    if bad:
        result.fail(f"lines.json: malformed snapshot(s): {bad}")
    else:
        result.ok(f"lines.json: {sum(len(w) for w in saved.values())} saved weekly snapshot(s)")


def check_recaps(path: Path, result: Result):
    """data/recaps.json: { "<season>": { "<week>": "<html>" } }, loaded by the Weekly Recap tab."""
    if not path.exists():
        result.fail(f"recaps.json: file not found at {path}")
        return
    try:
        recaps = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        result.fail(f"recaps.json: NOT VALID JSON ({e.msg} at line {e.lineno}) -- the Weekly Recap tab won't load")
        return
    bad = [f"{s}/{w}" for s, weeks in recaps.items() for w, html in weeks.items()
           if not (s.isdigit() and w.isdigit() and isinstance(html, str) and html.strip().startswith("<h3"))]
    if bad:
        result.fail(f"recaps.json: malformed entries (expect season/week digit keys and HTML starting with <h3): {bad[:5]}")
    else:
        n = sum(len(w) for w in recaps.values())
        result.ok(f"recaps.json: valid, {n} recap(s) across {len(recaps)} season(s)")


def check_playoff_wins(raw, result: Result):
    """In the league's 8-team, three-round playoff, playoff wins follow from the final place: champion 3,
    runner-up 2, semi-final losers 1, everyone else 0 (consolation/placement wins don't count). Holds for
    every season 2012-2025 (after fixing 2023's runner-up). If the playoff format ever changes, update this."""
    expected = {1: 3, 2: 2, 3: 1, 4: 1}
    vals = {}
    for r in raw:
        if r.get("category") in ("Playoff Standings", "Playoff Wins"):
            vals.setdefault((r["season"], r["manager"]), {})[r["category"]] = r["value"]
    bad = [f"{s} {m}: place {int(v['Playoff Standings'])}, {v.get('Playoff Wins')} playoff wins (expected {expected.get(int(v['Playoff Standings']), 0)})"
           for (s, m), v in sorted(vals.items()) if "Playoff Standings" in v
           and v.get("Playoff Wins") != expected.get(int(v["Playoff Standings"]), 0)]
    seasons = len({s for (s, m), v in vals.items() if "Playoff Standings" in v})
    if bad:
        result.fail("Playoff Wins don't match final places: " + "; ".join(bad[:5]))
    else:
        result.ok(f"Playoff Wins match final places for all {seasons} finished seasons")


def check_raw_duplicates(raw, result: Result):
    seen, dupes = set(), []
    for r in raw:
        key = (r.get("manager"), r.get("season"), r.get("category"))
        if key in seen:
            dupes.append(key)
        seen.add(key)
    if dupes:
        result.fail(f"raw.json: {len(dupes)} duplicate (manager, season, category) row(s), e.g. {dupes[0]} "
                    f"-- in-progress categories must be updated in place, not appended")
    else:
        result.ok("raw.json: no duplicate (manager, season, category) rows")


def check_games_duplicates(games, result: Result):
    seen, dupes = set(), []
    for g in games:
        key = (g.get("season"), g.get("week"), g.get("type"), frozenset([g.get("mA"), g.get("mB")]))
        if key in seen:
            dupes.append((g.get("season"), g.get("week"), g.get("mA"), g.get("mB")))
        seen.add(key)
    if dupes:
        result.fail(f"games.json: {len(dupes)} duplicate matchup(s), e.g. {dupes[0]}")
    else:
        result.ok("games.json: no duplicate matchups")


def check_raw_vs_games(raw, games, result: Result):
    """Every season's RAW Wins/Losses/Pts For/Pts Against/Pts Differential must equal what its
    regular-season GAMES rows add up to. Ties count as neither a win nor a loss (RAW has no Ties
    category; the dashboard derives ties from GAMES)."""
    checked = {"Wins", "Losses", "Pts For", "Pts Against", "Pts Differential"}
    finished = {r["season"] for r in raw if r.get("category") == "Playoff Standings"}
    for season in sorted({r["season"] for r in raw}):
        totals = {}
        for g in games:
            if g.get("season") != season or g.get("type") != "regular":
                continue
            for m, pf, pa in ((g["mA"], g["sA"], g["sB"]), (g["mB"], g["sB"], g["sA"])):
                t = totals.setdefault(m, {"Wins": 0, "Losses": 0, "Pts For": 0.0, "Pts Against": 0.0})
                t["Pts For"] += pf
                t["Pts Against"] += pa
                t["Wins"] += pf > pa
                t["Losses"] += pf < pa
        weeks = sorted({g["week"] for g in games if g.get("season") == season and g.get("type") == "regular"})
        mismatches = []
        for r in raw:
            if r["season"] != season or r["category"] not in checked:
                continue
            t = totals.get(r["manager"])
            if t is None:
                mismatches.append(f"{r['manager']} has RAW rows but no {season} games")
                continue
            expected = (t["Pts For"] - t["Pts Against"]) if r["category"] == "Pts Differential" else t[r["category"]]
            if abs(expected - r["value"]) > 0.011:
                mismatches.append(f"{r['manager']} {r['category']}: RAW {r['value']} vs GAMES {round(expected, 2)}")
        label = f"{season}" + ("" if season in finished else " (in progress)")
        if mismatches:
            result.fail(f"{label}: RAW totals don't match GAMES through week(s) {weeks[0] if weeks else '?'}-{weeks[-1] if weeks else '?'}: "
                        + "; ".join(mismatches[:5]) + (" ..." if len(mismatches) > 5 else ""))
        elif season not in finished:
            result.ok(f"{label}: RAW totals match GAMES for all {len(totals)} managers through week {weeks[-1] if weeks else '?'}")
    finished_failures = [f for f in result.failures if f.split(":")[0].isdigit() and int(f.split(":")[0]) in finished]
    if not finished_failures:
        result.ok(f"RAW season totals match GAMES for every finished season ({len(finished)})")

def check_all_time_team(path: Path, raw, result: Result):
    if not path.exists():
        result.fail(f"all_time_team.json: file not found at {path} -- regenerate it with tools/build_all_time_team.js")
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        result.fail(f"all_time_team.json is not valid JSON ({e.msg}) -- regenerate it with tools/build_all_time_team.js")
        return
    finished = {r["season"] for r in raw if r.get("category") == "Playoff Standings"} if isinstance(raw, list) else set()
    missing = sorted(finished - {int(s) for s in data})
    if missing:
        result.warn(f"ALL_TIME_TEAM_DATA is missing finished season(s) {missing} -- run: node tools/build_all_time_team.js <cache-dir>")
    else:
        result.ok(f"ALL_TIME_TEAM_DATA covers all {len(data)} finished seasons")


def main():
    repo_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    html_path = repo_root / "index.html"
    raw_path = repo_root / "data" / "raw.json"
    games_path = repo_root / "data" / "games.json"

    result = Result()

    if not html_path.exists():
        print(f"ERROR: {html_path} not found. Run this from the repo folder, "
              f"or pass the folder as an argument: python3 validate.py /path/to/repo")
        sys.exit(2)

    html = html_path.read_text(encoding="utf-8", errors="replace")

    raw = check_json_file(raw_path, MIN_RAW_ROWS, result)
    games = check_json_file(games_path, MIN_GAMES_ROWS, result)
    if isinstance(raw, list):
        check_raw_duplicates(raw, result)
        check_playoff_wins(raw, result)
    if isinstance(games, list):
        check_games_duplicates(games, result)
    if isinstance(raw, list) and isinstance(games, list):
        check_raw_vs_games(raw, games, result)
    check_draft_data(repo_root / "data" / "drafts.json", result)
    check_recaps(repo_root / "data" / "recaps.json", result)
    check_lines(repo_root / "data" / "lines.json", result)
    check_all_time_team(repo_root / "data" / "all_time_team.json", raw, result)
    check_rosters_2025(repo_root / "data" / "rosters_2025.json", result)
    check_assets(repo_root, html, result)
    check_tag_balance(html, result)
    check_brace_balance(html, result)
    check_async_helpers(html, result)
    check_appinit_wrapper(html, result)
    check_dangling_ids(html, result)

    print("=" * 60)
    print(f"PASS  ({len(result.passes)})")
    for p in result.passes:
        print(f"   OK  {p}")

    if result.warnings:
        print(f"\nWARN  ({len(result.warnings)})")
        for w in result.warnings:
            print(f"   ??  {w}")

    if result.failures:
        print(f"\nFAIL  ({len(result.failures)})")
        for f in result.failures:
            print(f"   XX  {f}")
        print("=" * 60)
        print(f"\nRESULT: {len(result.failures)} check(s) failed. Do not push yet.")
        sys.exit(1)
    else:
        print("=" * 60)
        print("\nRESULT: all checks passed. Safe to push.")
        sys.exit(0)


if __name__ == "__main__":
    main()
