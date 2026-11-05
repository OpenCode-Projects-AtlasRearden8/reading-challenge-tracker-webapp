# STATUS — Reading Challenge Tracker

Last updated: 2026-11-05

## What was built

An offline, single-file web app (`index.html`) for year-long reading challenges:

- **Progress board** — completion percentage against your goal, a "where pace says
  you should be" line (computed from day-of-year and leap-year-aware), ahead/behind
  delta, current day streak, total pages, and a per-week target to hit the goal by
  Dec 31.
- **Book log** — title, author, genre (with datalist of genres you've used), format
  (physical/ebook/audiobook), page count, finish date, plus novella and buddy-read
  flags.
- **Badges** — 13 auto-awarded badges: goal milestones (25/50/75/100%), genre
  explorer (4 genres) and genre deep dive (3 in one genre), Audio Ally (3
  audiobooks), Novella Rush (3 novellas), Buddy Reader (2 buddy reads), week/month
  streaks, Ten Thousand Pages, and first-book.
- **Page streaks** — daily page log; streak requires consecutive nonzero days
  (today counts once logged; otherwise the run through yesterday counts). Handles
  month and year boundaries and leap years.
- **End-of-year wrap-up** — preview + Markdown download of the whole reading year
  (stats, genre/format highlights, full book list).
- **Data tools** — JSON backup download/import, sample data, erase-all. All state
  in `localStorage` under `reading-challenge-tracker:v1`.

No network calls, no accounts, no secrets, no build step. Pure HTML/CSS/JS in one
file that runs directly from `file://`.

## How to run

Open `index.html` in any modern browser (double-click it). Optionally run the
tests: `node tests.mjs`.

## Verification results

- `node tests.mjs` — **37/37 pass.** Covers book totals/rounding, completion
  percentage (rounding, capping, no-goal), expected-pace math including leap years,
  pace delta, streak edge cases (gaps, zero pages, cross-month/year), badge award
  thresholds and progress capping, wrap-up output, makeBook defaults, and
  localStorage round-trip plus corrupt/invalid-data recovery. The tests extract
  and evaluate the same inline `<script>` the page runs, so the tested code is the
  shipped code.
- jsdom smoke test (tabs, form submit → localStorage, page log, goal save, board
  25% render, badge earn, wrap-up render, delete) — **passes.** Note: jsdom
  requires a non-opaque origin for localStorage; real browsers provide it on
  `file://` normally.
- Manual review of the inline script for id mismatches between HTML and JS.

## Known gaps / future ideas

- Single-device: `localStorage` only (JSON backup/import is the sync method).
- Streak badges use the *current* streak for the badge count; the longest-streak
  record is tracked but streak badges would look at best-streak instead if a long
  streak ends before you visit.
- No per-book rating/notes fields; no CSV export (Markdown wrap-up + JSON only).
- No print stylesheet.
- The pace helper assumes a single calendar year of goal tracking (matches the
  "year-long challenge" scope).

## Files

```
index.html   app (HTML + CSS + JS, single file, run offline from file://)
tests.mjs    progress + persistence tests (37)
README.md    usage + credits (Asdale Dynamics, LLC)
LICENSE      MIT, Copyright (c) 2026 Asdale Dynamics, LLC
STATUS.md    this file
```
