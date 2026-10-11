---
target: Log-in pop-up
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\My Computer\\Desktop\\UniCycle\\index.html#login"
timestamp: 2026-10-10T02-34-14Z
slug: index-html-login
---
# Critique: Log-in pop-up (dialog#login in index.html)
Method: dual-agent (A: design-review sub-agent · B: detector sub-agent). Part of a 4-surface run.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | System status | 3 | "Logging in…", "Sending the link…" |
| 2 | Real world | 3 | "Unicycle" vs the "UniCycle" wordmark |
| 3 | User control | 3 | Close, Esc, Back to log in |
| 4 | Consistency | 2 | Black primary; pill inputs only here |
| 5 | Error prevention | 2 | No show-password, no confirm on the new password |
| 6 | Recognition | 3 | Correct autocomplete per mode |
| 7 | Flexibility | 3 | Enter submits; Other options |
| 8 | Minimal design | 3 | Log-in and reset steps are tight |
| 9 | Error recovery | 2 | Errors far from the field; raw Supabase text in brackets |
| 10 | Help | 3 | Explains why year and course are asked |
| | Total | 27/40 | Acceptable |

Design specificity: interchangeable SaaS log-in; no reason to sign up is shown; "you@example.com" doesn't suggest a school email. Detector: placeholders "you@example.com" and "At least 8 characters" at 3.6:1 (#757575 browser default, no placeholder rule). Review: light input fill 1.13:1 against white, amber focus ring 2.07:1.

Strengths: modes switch everything together; reset doesn't reveal which accounts exist; human error copy.

## Priority issues
1. [P1] Errors far from the field: focus at y=299, message at y=997 in a 774px window; no aria-invalid. Fix: inline error per field with aria-describedby. Command: harden
2. [P1] Bounce without return: the dialog exists only on index.html; after log-in you stay on the shop. Fix: honour a next parameter. Command: harden
3. [P2] Create account is one long scroll: submit at y=929 in a 788px dialog; validation order name, school, year, course vs shown name, school, course, year. Fix: two steps (Your school / Your account). Command: distill
4. [P2] Set a new password is bare: no email shown, no show-password, closing it silently keeps the old password. Command: harden
5. [P2] "Unicycle" in 3 strings; primary button colour drift. Command: polish

Persona red flags: Sam: errors not tied to fields, sign-up fields appear unannounced, modes read as toggles; Casey: submit below the fold, Close 40x40 top-right; Jordan: school email unclear, 35 courses before a school is picked, success looks like the unchanged form; Riley: repeated reset shows raw rate-limit text.

Minor: "Choose Forgot password? above" double punctuation; select chevron 2.15:1 in light mode; .lmark repeats the nav logo.
