#!/usr/bin/env python3
"""
run_ask_tests.py — the permanent Ask regression suite. Run this every time Ask changes,
not just the part that was touched -- both real bugs found tonight (the "who has...beat"
false positive and the "least points" direction bug) were regressions in EXISTING code
paths, not the new code being added at the time. Testing only what changed would have
missed both.

Usage:
    python3 run_ask_tests.py <dashboard.html> <raw.json> <games.json> [query_suite.json]

Exit code 0 if everything passes, 1 if anything fails (so this can gate a delivery).
"""

import sys
import json
import subprocess
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)

    dashboard_path = sys.argv[1]
    raw_path = sys.argv[2]
    games_path = sys.argv[3]
    suite_path = sys.argv[4] if len(sys.argv) > 4 else os.path.join(SCRIPT_DIR, 'query_suite.json')
    harness_path = os.path.join(SCRIPT_DIR, '_harness_generated.js')

    # Step 1: regenerate the harness fresh from the CURRENT dashboard file, every run.
    # Never reuse a stale harness -- that would silently test old code.
    extractor = os.path.join(SCRIPT_DIR, 'extract_ask_harness.py')
    result = subprocess.run(
        [sys.executable, extractor, dashboard_path, raw_path, games_path, harness_path],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("FAILED to extract harness from dashboard -- likely a required function/const")
        print("was renamed or removed. This itself is useful signal: it means something")
        print("changed that this suite depends on.")
        print(result.stderr)
        sys.exit(2)
    print(result.stdout.strip())

    # Step 2: load the query suite.
    with open(suite_path, encoding='utf-8') as f:
        suite = json.load(f)

    # Step 3: build one combined Node script -- the harness plus a runner tail that
    # executes every query and prints structured JSON results to stdout.
    with open(harness_path, encoding='utf-8') as f:
        harness_code = f.read()

    all_cases = []
    for category, cases in suite.items():
        if category.startswith('_'):
            continue
        for case in cases:
            all_cases.append({**case, "category": category})

    runner_tail = f"""
const __cases = {json.dumps(all_cases)};
const __results = __cases.map(c => {{
  let answer;
  let error = null;
  try {{
    const raw = askAnswer(c.q);
    answer = (raw && typeof raw === 'object' && raw.html) ? raw.html : raw;
  }} catch (e) {{
    error = e.message;
    answer = null;
  }}
  return {{ ...c, answer, error }};
}});
console.log(JSON.stringify(__results));
"""

    combined_path = os.path.join(SCRIPT_DIR, '_combined_run.js')
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write(harness_code + '\n' + runner_tail)

    # Step 4: run it.
    node_result = subprocess.run(['node', combined_path], capture_output=True, text=True)
    if node_result.returncode != 0:
        print("FATAL: the combined test script itself failed to run (syntax error or")
        print("uncaught exception outside a single query's try/catch). This means the")
        print("dashboard's Ask code likely has a real syntax/runtime problem right now.")
        print(node_result.stderr)
        sys.exit(2)

    results = json.loads(node_result.stdout.strip())

    # Step 5: evaluate each result against its expectation and report.
    failures = []
    by_category = {}
    for r in results:
        cat = r['category']
        by_category.setdefault(cat, {"pass": 0, "fail": 0})

        got_answer = r['answer'] is not None and r['error'] is None
        expect_answer = r['expect'] == 'answer'

        ok = (got_answer == expect_answer)
        if ok and r.get('contains') and r['answer']:
            ok = r['contains'] in r['answer']
        if ok and r.get('not_contains') and r['answer']:
            ok = r['not_contains'] not in r['answer']
        if r['error']:
            ok = False

        if ok:
            by_category[cat]["pass"] += 1
        else:
            by_category[cat]["fail"] += 1
            failures.append(r)

    total = len(results)
    total_pass = sum(v["pass"] for v in by_category.values())
    total_fail = sum(v["fail"] for v in by_category.values())

    print("=" * 70)
    print(f"{'Category':<45} {'Pass':>6} {'Fail':>6}")
    print("-" * 70)
    for cat in sorted(by_category):
        v = by_category[cat]
        marker = "  " if v["fail"] == 0 else "!!"
        print(f"{marker} {cat:<43} {v['pass']:>6} {v['fail']:>6}")
    print("-" * 70)
    print(f"{'TOTAL':<45} {total_pass:>6} {total_fail:>6}  ({total} queries)")
    print("=" * 70)

    if failures:
        print(f"\n{len(failures)} FAILURE(S) -- details:\n")
        for f in failures:
            print(f"  [{f['category']}] {f['q']!r}")
            print(f"    expected: {f['expect']}"
                  + (f" containing {f['contains']!r}" if f.get('contains') else "")
                  + (f" NOT containing {f['not_contains']!r}" if f.get('not_contains') else ""))
            print(f"    got: {f['answer']!r}" + (f"  ERROR: {f['error']}" if f['error'] else ""))
            print()
        sys.exit(1)
    else:
        print("\nAll queries behaved as expected.")
        sys.exit(0)


if __name__ == '__main__':
    main()
