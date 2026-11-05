# Reading Challenge Tracker

An offline, single-file web app for year-long reading challenges. Track the books you
finish against a goal, collect genre and format badges (audiobooks, novellas, buddy
reads), build daily page streaks, and export an end-of-year wrap-up when December
rolls around.

Built in the "explain it like a friend would" spirit of [Asdale Dynamics, LLC](https://dylanasdale.github.io)
— plain, warm, and local-first.

## Quick start

1. Download `index.html` (or the whole folder).
2. Double-click it — it opens directly from `file://` in any modern browser.
3. Set your goal on the **Goal** tab (default: 12 books), then start logging finishes.

No install, no build step, no server, no accounts. Your data never leaves the device:
it lives in your browser's `localStorage` under the key
`reading-challenge-tracker:v1`.

## What it does

- **Board** — completion percentage, where your goal's pace says you should be, how far
  ahead or behind you are, your current day streak, and total pages logged.
- **Books** — log each finish with title, author, genre, format, page count, finish date,
  plus "novella" and "buddy read" tags that feed the badge shelf.
- **Pages** — one quick field per day. Any nonzero day extends your streak, which
  feeds week/month streak badges (streaks survive month and year boundaries).
- **Badges** — thirteen badges awarded automatically: milestone percentages of your
  goal, genre exploration (breadth *and* depth, "ten thousand pages"), format badges
  for audiobooks/novellas/buddy reads, and streak badges.
- **Wrap-up** — a shareable Markdown summary of your reading year (books, pages,
  genres, formats, streaks, full list), downloadable as `.md`.
- **Data** — JSON backup download and import so you can move between browsers or
  devices, a sample-data loader, and an erase-everything reset. Also handy right
  before the year ends: the wrap-up button on its own tab downloads the summary.

## Running tests

The progress math is tested. Node doesn't read inline `<script>` from HTML, so
`tests.mjs` extracts the same script block the page runs, evaluates it in a sandbox
with a `localStorage` stub, and exercises the pure functions plus persistence:

```sh
node tests.mjs
```

37 tests cover completion percentage, pace/leap-year math, streak edge cases,
badge awarding (goal-relative, format, genre, streak, pages), wrap-up output,
and localStorage round-tripping/corruption handling.

## Privacy

Everything is computed and stored locally. No network requests, no cookies, no
accounts, no analytics — the page works fully offline from `file://`.

## Project layout

```
index.html   the whole app (HTML + CSS + JS in one file)
tests.mjs    progress + persistence tests (run with: node tests.mjs)
LICENSE      MIT (Copyright (c) 2026 Asdale Dynamics, LLC)
STATUS.md    build/run/verification notes
```

## License

MIT — see [LICENSE](LICENSE). Reading Challenge Tracker is a project of
**Asdale Dynamics, LLC** (Dylan Asdale — [dylanasdale.github.io](https://dylanasdale.github.io),
*The Massive AI Manual*). It's meant to complement, not replace, full library
catalogs (bookshelf-mcp-server) or ARC deadline trackers (arc-review-tracker).

Not affiliated with any reading platform. Your year, your books, your data.
