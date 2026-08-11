#!/usr/bin/env python3
"""
extract_ask_harness.py — pulls everything askAnswer() needs out of the dashboard HTML
and writes a standalone Node.js file that can run real Ask queries against real data.

This exists because the same extraction (managers, PALETTE, TICKER_STATS, CURRENT_SEASON,
LEAGUE_SETTINGS, DRAFTS, KEEPER_COUNTS, ALL_PLAYERS, and a dozen helper functions) got
hand-assembled from scratch in a fresh throwaway script something like fifteen times over
one session. This is the reusable version — run it once whenever the dashboard changes,
get a harness file, then run any queries against it.

Usage:
    python3 extract_ask_harness.py <path-to-dashboard.html> <path-to-raw.json> <path-to-games.json> <output.js>

The generated file exposes a single global: askAnswer(text) -> string | {html} | null,
plus every function it depends on, so it can also be used to test those directly
(findManagersInText, computePowerRankings, etc.) if needed.
"""

import sys
import json


def extract_between(html, start_marker, end_marker):
    s = html.index(start_marker)
    e = html.index(end_marker, s) + len(end_marker)
    return html[s:e]


def extract_function(html, name):
    marker = f'function {name}('
    s = html.index(marker)
    e = html.index('\n}\n', s) + 3
    return html[s:e]


def extract_iife_const(html, name):
    marker = f'let {name} = (() => {{'
    s = html.index(marker)
    e = html.index('})();', s) + len('})();')
    return html[s:e]


# Every function askAnswer() transitively depends on. If a future edit adds a new helper
# function that askAnswer() calls, add its name here -- the extractor will fail loudly
# (KeyError-style, via the html.index() call raising ValueError) rather than silently
# producing a harness that's missing something, which is exactly the failure mode this
# script exists to prevent.
REQUIRED_FUNCTIONS = [
    'fmt', 'valueFor', 'draftNorm', 'managerForTeam', 'computeKeeperHistory',
    'computePowerRankings', 'computeCareerPowerRankings', 'computeValueKeepers',
    'levenshtein', 'findManagersInText', 'findYearInText', 'findPlayerInText',
    'h2hRecord', 'winnerOf', 'marginOf', 'formatDateTime', 'computeKeeperLockDate',
    'askAnswer',
]

REQUIRED_CONST_RANGES = [
    ('const managers = ', ';\n'),
    ('const PALETTE = ', ';\n'),
    ('const KEEPER_COUNTS = {', '};\n'),
    ('const DRAFTS = {', '\n};\n'),
    ('const LEAGUE_SETTINGS = {', '};\n'),
    ('const CURRENT_SEASON = {', '\n};\n'),
    ('const TICKER_STATS = {', '\n};\n'),
]


def build_harness(dashboard_path, raw_path, games_path, output_path):
    with open(dashboard_path, encoding='utf-8') as f:
        html = f.read()

    pieces = []
    pieces.append(f"const RAW = require({json.dumps(raw_path)});")
    pieces.append(f"const GAMES = require({json.dumps(games_path)});")

    for start, end in REQUIRED_CONST_RANGES:
        pieces.append(extract_between(html, start, end))

    pieces.append(extract_iife_const(html, 'ALL_PLAYERS'))

    for fn in REQUIRED_FUNCTIONS:
        pieces.append(extract_function(html, fn))

    # The real dashboard computes this once right after defining the function
    # (`const KEEPER_HISTORY = computeKeeperHistory();`) -- askAnswer's keeper-history branch
    # reads the constant, not the function, so it has to actually be invoked here too.
    pieces.append("const KEEPER_HISTORY = computeKeeperHistory();")

    # rosters2025Data is normally built at runtime from ROSTERS_2025_VERIFIED (static) plus a
    # live Sleeper sync for players who changed hands mid-season (~99 of 185, per the handoff
    # doc). This harness has no live Sleeper access, so it uses ROSTERS_2025_VERIFIED directly --
    # not perfectly accurate for those ~99 traded players, but real enough to actually test the
    # roster-lookup branch's logic (does it find the right manager, format correctly) rather than
    # only confirming it doesn't crash on an empty array.
    pieces.append(extract_between(html, 'const ROSTERS_2025_VERIFIED = [', '];\n'))
    pieces.append("let rosters2025Data = ROSTERS_2025_VERIFIED;")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(pieces) + '\n')

    print(f"Harness written to {output_path} ({len(pieces)} pieces extracted)")


if __name__ == '__main__':
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(1)
    build_harness(*sys.argv[1:5])
