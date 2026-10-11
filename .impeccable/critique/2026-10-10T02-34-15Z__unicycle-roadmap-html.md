---
target: UniCycle Roadmap
total_score: 14
max_score: 28
na_heuristics: 7,9,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\MYCOMP~1\\AppData\\Local\\Temp\\claude\\C--Users-My-Computer-Desktop-UniCycle\\a1ea0a79-8b9c-49db-86c1-bdf31a8ea5b7\\scratchpad\\unicycle-roadmap.html"
target_fingerprint: "sha256:4610573f57d5e515fe02ec43b7ddc30749fcebd2e9d1ece0f26bc65e18c2389d"
target_path: "C:\\Users\\MYCOMP~1\\AppData\\Local\\Temp\\claude\\C--Users-My-Computer-Desktop-UniCycle\\a1ea0a79-8b9c-49db-86c1-bdf31a8ea5b7\\scratchpad\\unicycle-roadmap.html"
timestamp: 2026-10-10T02-34-15Z
slug: unicycle-roadmap-html
---
# Critique: UniCycle Roadmap (artifact, built as unicycle-roadmap.html)
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent). Part of a 4-surface run. Read mode; heuristics 7, 9 and 10 n/a.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | System status | 2 | 23 screens desktop, 42 phone; the rail shows no current section |
| 2 | Real world | 2 | pg_cron, Edge Function, webhook, SMTP, row-level rules for judges |
| 3 | User control | 2 | No back-to-top; only the budget collapses |
| 4 | Consistency | 2 | Blue means two-account test in §01, next in §05 |
| 5 | Error (misreading) prevention | 2 | Peso-exact estimates; contradictions |
| 6 | Recognition | 3 | Legends beside charts; semantic tables |
| 7 | Flexibility | n/a | Document to read |
| 8 | Minimal design | 1 | "How it earns" is 41% of the page; 21 Added-idea badges; 18 font sizes |
| 9 | Error recovery | n/a | No input |
| 10 | Help | n/a | Sources footer |
| | Total | 14/28 | Acceptable (50%) |

Design specificity: specific content in a generic AI-report shell (stat tiles, mono caps eyebrows, endless card grids, donut); no UniCycle logo. Detector: 34 .tag at 10-10.5px, 4 all-caps runs of 40-46 characters, a ~100-character line in the escrow card; CLI cramped-padding x29 is a false positive (clamp padding), the striped gradient is the intentional dashed connector. Review: 133 text nodes at 11.5px or less, body 13.5-14.5px; "Small test" 3.91:1, "In review" 3.45:1.

Strengths: honesty mechanics (three status levels, not-to-scale note, Mentor/Added labels, dated sources); safety plan per trade step; escrow explained with existing parts.

## Priority issues
1. [P1] Half pitch, half worksheet: 21 Added-idea badges and team notes left in ("pick the two or three", "Replace each line with a real quote"). Fix: a judge version plus one collapsed ideas appendix. Command: distill
2. [P1] The order buries the case: pilot ask and go/no-go gate mid-page; the survey sits at 77% depth under Safety. Fix: problem/survey → not done yet → pilot and gate → ask → safety → short business model → appendix. Command: layout
3. [P1] Contradictions: ₱17,000 escrow in the pilot vs "Not yet" in the stream table; "never handles money" beside the escrow flow; "UC students" has no number; 2016-17 market data; peso-exact estimates. Fix: move escrow legal work to Phase 2, add a sourced UC figure, round. Command: clarify
4. [P2] 18 font sizes and shifting status colours. Fix: 5-step scale, body 16px+, one status palette, tags 11px+. Command: typeset
5. [P2] Filler metrics: the feature-count chart duplicates the list; the "9 areas" tile. Fix: a "Not done yet" list and "73 students surveyed". Command: distill

Persona red flags: a judge with 5 minutes can't find the ask or gate (costs about 14 screens down); Casey: 42 screens, 3 sideways tables, rail links cut off at x=373; Alex: no current section, no back-to-top, no print styles; Sam: decent, the rail lacks aria-current.

Minor: Phase 1 is a sliver in the budget chart because Phase 3 sets the scale; "Think Canvas" assumes judges know Canvas.
