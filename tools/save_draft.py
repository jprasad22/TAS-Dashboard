#!/usr/bin/env python3
"""
save_draft.py -- saves the current season's completed Sleeper draft into data/drafts.json, so it
becomes permanent history like every earlier season (Draft Results, Keeper History, Draft Value,
Ask). Once a season is in drafts.json, the page stops fetching that draft live from Sleeper.

    python3 tools/save_draft.py            # run from the repo root
    python3 tools/save_draft.py --check    # rebuild and compare with what's saved; write nothing

When to run: after the draft is complete AND after Week 1 is in raw.json (tools/weekly_update.py 1)
-- picks are stored by team name, and each manager's team name for the season comes from raw.json.

Keeper flags come from the league's KEEPER_SELECTIONS_<year> list in index.html, not Sleeper's own
is_keeper flag (which missed one of 2026's 12 keepers). Every listed keeper must appear on the draft
board, picked by the right manager in the listed round, or nothing is written. The draft order must
also match CURRENT_SEASON.draftOrder.
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path


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
    ap.add_argument("--check", action="store_true", help="rebuild and compare with data/drafts.json; write nothing")
    args = ap.parse_args()

    html = Path("index.html").read_text(encoding="utf-8")
    league_id = from_html(r'const SLEEPER_LEAGUE_ID = "(\d+)"', html)
    season = int(from_html(r"const CURRENT_SEASON = \{\s*year: (\d+)", html))
    name_map = dict(re.findall(r"'([^']+)':\s*'([^']+)'", from_html(r"const SLEEPER_USERNAME_TO_MANAGER = \{(.*?)\};", html)))
    draft_order_cs = re.findall(r'"([^"]+)"', from_html(r"draftOrder: \[(.*?)\]", html))
    keeper_block = re.search(rf"const KEEPER_SELECTIONS_{season} = \[(.*?)\];", html, re.S)
    if not keeper_block:
        sys.exit(f"index.html has no KEEPER_SELECTIONS_{season} list -- add the league's keeper list first")
    keepers = {(m, p): int(r) for m, p, r in re.findall(r'manager: "([^"]+)",\s*player: "([^"]+)",\s*round: (\d+)', keeper_block.group(1))}

    drafts_path, raw_path = Path("data/drafts.json"), Path("data/raw.json")
    drafts = json.loads(drafts_path.read_text())
    team_of = {r["manager"]: r["team"] for r in json.loads(raw_path.read_text()) if r["season"] == season}
    if str(season) in drafts and not args.check:
        sys.exit(f"{season} is already in drafts.json -- nothing to do")
    if len(team_of) < 12:
        sys.exit(f"raw.json has no {season} team names yet -- run tools/weekly_update.py 1 first")

    sleeper_drafts = sleeper(f"league/{league_id}/drafts")
    draft = next((d for d in sleeper_drafts if str(d.get("season")) == str(season)), None)
    if not draft or draft.get("status") != "complete":
        sys.exit(f"No completed {season} draft in Sleeper yet (status: {draft and draft.get('status')})")
    users = {u["user_id"]: name_map.get(u["display_name"], u["display_name"]) for u in sleeper(f"league/{league_id}/users")}
    teams = draft["settings"]["teams"]

    order = [users[uid] for uid, slot in sorted(draft["draft_order"].items(), key=lambda kv: kv[1])]
    if order != draft_order_cs:
        sys.exit(f"Sleeper's draft order doesn't match CURRENT_SEASON.draftOrder:\n  sleeper: {order}\n  index.html: {draft_order_cs}")

    picks, found = [], set()
    for p in sorted(sleeper(f"draft/{draft['draft_id']}/picks"), key=lambda p: p["pick_no"]):
        mgr, md = users[p["picked_by"]], p["metadata"]
        row = {"round": p["round"], "pick": p["pick_no"] - (p["round"] - 1) * teams, "overall": p["pick_no"],
               "team": team_of[mgr], "player": f"{md['first_name']} {md['last_name']}".strip(), "position": md["position"]}
        if (mgr, row["player"]) in keepers:
            if keepers[(mgr, row["player"])] != row["round"]:
                sys.exit(f"Keeper {row['player']} ({mgr}) is listed for round {keepers[(mgr, row['player'])]} but was picked in round {row['round']}")
            row["keeper"] = True
            found.add((mgr, row["player"]))
        picks.append(row)
    missing = set(keepers) - found
    if missing:
        sys.exit(f"Listed keeper(s) not found on the draft board under that manager: {sorted(missing)}")

    entry = {"draft_order": [team_of[m] for m in order], "picks": picks}
    print(f"{season} draft: {len(picks)} picks, {len(found)} keepers, order {', '.join(order)}")
    if args.check:
        print("--check: matches data/drafts.json" if drafts.get(str(season)) == entry else "--check: DIFFERS from data/drafts.json")
        return
    drafts[str(season)] = entry
    drafts_path.write_text(json.dumps(drafts))
    print(f"Saved to data/drafts.json. Next: python3 validate.py (raise MIN_DRAFT_SEASONS/PICKS if you like).")


if __name__ == "__main__":
    main()
