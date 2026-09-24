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
  - an in-progress season (no Playoff Standings rows yet) whose RAW totals
    (Wins/Losses/Pts For/Pts Against/Pts Differential) don't match what its
    GAMES rows actually add up to -- the weekly live-update cross-check

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
MIN_DRAFT_SEASONS = 14
MIN_DRAFT_PICKS = 2500

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


def check_draft_data(html: str, result: Result):
    match = re.search(r"const DRAFTS = (\{.*?\n\});\s*\n", html, re.S)
    if not match:
        result.warn("Could not locate 'const DRAFTS = {...};' block to check pick counts")
        return
    try:
        drafts = json.loads(match.group(1))
    except json.JSONDecodeError as e:
        result.fail(f"DRAFTS block in HTML is not valid JSON ({e.msg})")
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
    calls = len(re.findall(r"__appInit\(\);", html))
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


def check_in_progress_totals(raw, games, result: Result):
    finished = {r["season"] for r in raw if r.get("category") == "Playoff Standings"}
    in_progress = sorted({r["season"] for r in raw} - finished)
    if not in_progress:
        result.ok("No in-progress season in raw.json (nothing to cross-check against games.json)")
        return
    for season in in_progress:
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
        weeks = sorted({g["week"] for g in games if g.get("season") == season})
        mismatches = []
        for r in raw:
            if r["season"] != season:
                continue
            t = totals.get(r["manager"])
            if t is None:
                mismatches.append(f"{r['manager']} has RAW rows but no {season} games")
                continue
            expected = (t["Pts For"] - t["Pts Against"]) if r["category"] == "Pts Differential" else t.get(r["category"])
            if expected is None:
                mismatches.append(f"{r['manager']}: unexpected in-progress category {r['category']!r}")
            elif abs(expected - r["value"]) > 0.011:
                mismatches.append(f"{r['manager']} {r['category']}: RAW {r['value']} vs GAMES {round(expected, 2)}")
        if mismatches:
            result.fail(f"{season} (in progress): RAW totals don't match GAMES through week(s) {weeks}: "
                        + "; ".join(mismatches[:5]) + (" ..." if len(mismatches) > 5 else ""))
        else:
            result.ok(f"{season} (in progress): RAW totals match GAMES for all {len(totals)} managers "
                      f"through week {weeks[-1] if weeks else '?'}")


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
    if isinstance(games, list):
        check_games_duplicates(games, result)
    if isinstance(raw, list) and isinstance(games, list):
        check_in_progress_totals(raw, games, result)
    check_draft_data(html, result)
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
