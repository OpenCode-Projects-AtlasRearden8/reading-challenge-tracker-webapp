/**
 * Tests for Reading Challenge Tracker progress math.
 *
 * Runs in Node without a browser: extracts the inline <script> from
 * index.html (the same code the app runs), evaluates it in a sandbox
 * with stub window/localStorage, and verifies the pure functions and
 * the persistence layer (loadState/saveState) behave correctly.
 *
 * Run: node tests.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

// --- Extract the app's inline script -------------------------------------
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.equal(scripts.length, 1, 'index.html should contain exactly one inline script');
const appScript = scripts[0];

// --- Sandbox with minimal browser stubs ----------------------------------
const backing = new Map();
const localStorageStub = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
  clear: () => backing.clear(),
};

const sandbox = {
  window: {},
  localStorage: localStorageStub,
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(appScript, sandbox, { filename: 'index.html:inline' });

const RCT = sandbox.window.RCT;
assert.ok(RCT, 'app script should expose window.RCT');
const {
  computeBookPages, computeTotals, completionPct, expectedByDayOfYear, paceDelta,
  daysInYear, computeStreak, computeBadges, buildWrapup, dayOfYear, todayISO,
  makeBook, loadState, saveState, defaultState, STORAGE_KEY,
} = RCT;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

const book = (over = {}) => ({
  id: 't',
  title: 'Test Book',
  author: 'A. Author',
  genre: 'Fantasy',
  format: 'physical',
  pages: 100,
  finished: '2026-06-01',
  novella: false,
  buddy: false,
  ...over,
});

// --- computeBookPages -----------------------------------------------------
test('computeBookPages counts normal page values', () => {
  assert.equal(computeBookPages(book({ pages: 320 })), 320);
});
test('computeBookPages rounds fractional pages', () => {
  assert.equal(computeBookPages(book({ pages: 199.6 })), 200);
});
test('computeBookPages returns 0 for missing or invalid pages', () => {
  for (const bad of [null, 'x', -5, NaN, Infinity, undefined]) {
    assert.equal(computeBookPages(book({ pages: bad })), 0, `pages=${bad}`);
  }
});

// --- computeTotals --------------------------------------------------------
test('computeTotals counts books, pages, novellas and buddy reads', () => {
  const books = [
    book({ pages: 100 }),
    book({ pages: 200, format: 'audiobook', novella: true }),
    book({ pages: 250, buddy: true, genre: 'Mystery', author: 'B' }),
  ];
  const t = computeTotals(books);
  assert.equal(t.count, 3);
  assert.equal(t.pages, 550);
  assert.equal(t.novellas, 1);
  assert.equal(t.buddyReads, 1);
  assert.equal(t.formats.audiobook, 1);
  assert.equal(t.authors['A. Author'], 2);
  assert.equal(t.authors.B, 1);
  assert.equal(t.genres.Fantasy, 2);
  assert.equal(t.genres.Mystery, 1);
});
test('computeTotals handles empty and missing input', () => {
  const empty = computeTotals([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.pages, 0);
  assert.equal(computeTotals(undefined).count, 0);
});

// --- completionPct --------------------------------------------------------
test('completionPct at common milestones', () => {
  assert.equal(completionPct(25, 100), 25);
  assert.equal(completionPct(50, 100), 50);
  assert.equal(completionPct(75, 100), 75);
  assert.equal(completionPct(100, 100), 100);
});
test('completionPct rounds and caps at 100', () => {
  assert.equal(completionPct(2, 3), 67);   // 66.66 -> rounds to 67
  assert.equal(completionPct(150, 100), 100);
});
test('completionPct is 0 with no goal set', () => {
  assert.equal(completionPct(10, 0), 0);
  assert.equal(completionPct(10, -5), 0);
});

// --- expectedByDayOfYear / paceDelta --------------------------------------
test('expectedByDayOfYear is 0 on day 1 and goal at end of year', () => {
  assert.equal(expectedByDayOfYear(52, 1, 2025), 52 / 365);
  assert.equal(expectedByDayOfYear(52, 365, 2025), 52);
});
test('expectedByDayOfYear clamps day-of-year to the year length', () => {
  assert.equal(expectedByDayOfYear(12, 400, 2025), 12);
  assert.equal(expectedByDayOfYear(12, -3, 2025), 0);
});
test('expectedByDayOfYear accounts for leap years', () => {
  // day 183 of a 366-day year: goal * 183/366 = goal/2
  assert.equal(expectedByDayOfYear(40, 183, 2024), 40 * 183 / 366);
  assert.equal(daysInYear(2024), 366);
  assert.equal(daysInYear(2023), 365);
  assert.equal(daysInYear(2000), 366);
  assert.equal(daysInYear(1900), 365);
});
test('paceDelta positive ahead, zero on pace, negative behind', () => {
  // 2025 has 365 days; day 182 is exactly mid-year
  assert.ok(paceDelta(10, 20, 182, 2025) > 0);   // ahead: 10 read vs expected ≈ 9.97
  assert.ok(paceDelta(6, 20, 182, 2025) < 0);    // behind: 6 read vs expected ≈ 9.97
  // exactly on pace: done = goal * day/daysInYear
  const expected = 36.5 * 182 / 365;
  assert.ok(Math.abs(paceDelta(expected, 36.5, 182, 2025)) < 1e-9);
});
test('paceDelta with no goal is 0', () => {
  assert.equal(paceDelta(10, 0, 200, 2025), 0);
});

// --- computeStreak --------------------------------------------------------
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
test('computeStreak counts consecutive days including today', () => {
  const today = iso(2026, 3, 10);
  const log = {};
  for (const d of [10, 9, 8, 7]) log[iso(2026, 3, d)] = 20;
  assert.equal(computeStreak(log, today), 4);
});
test('computeStreak counts run ending yesterday if today not yet logged', () => {
  const log = {};
  for (const d of [9, 8, 7, 6]) log[iso(2026, 3, d)] = 20;
  assert.equal(computeStreak(log, iso(2026, 3, 10)), 4);
});
test('computeStreak breaks on a gap', () => {
  const log = { [iso(2026, 3, 10)]: 5, [iso(2026, 3, 9)]: 5, [iso(2026, 3, 7)]: 5 };
  assert.equal(computeStreak(log, iso(2026, 3, 10)), 2);
});
test('computeStreak ignores zero-page and non-numeric entries', () => {
  const log = { [iso(2026, 3, 10)]: 0, [iso(2026, 3, 9)]: 15, [iso(2026, 3, 8)]: 15 };
  assert.equal(computeStreak(log, iso(2026, 3, 10)), 2);
});
test('computeStreak is 0 with an empty log', () => {
  assert.equal(computeStreak({}, iso(2026, 3, 10)), 0);
});
test('computeStreak crosses month and year boundaries', () => {
  const log = { [iso(2026, 1, 2)]: 10, [iso(2026, 1, 1)]: 10, [iso(2025, 12, 31)]: 10 };
  assert.equal(computeStreak(log, iso(2026, 1, 2)), 3);
});

// --- dayOfYear / todayISO -------------------------------------------------
test('dayOfYear is 1 on Jan 1 and correct on a known date', () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
  assert.equal(dayOfYear(new Date(2025, 11, 31)), 365);
  // 2024 is a leap year; July 4 = 31+29+31+30+31+30+4 = 186
  assert.equal(dayOfYear(new Date(2024, 6, 4)), 186);
});
test('todayISO formats as YYYY-MM-DD', () => {
  assert.match(todayISO(new Date(2026, 2, 5)), /^2026-03-05$/);
});

// --- computeBadges --------------------------------------------------------
function badgeMap(books, streak, log) {
  const out = {};
  for (const b of computeBadges(books, streak, log || {})) out[b.id] = b;
  return out;
}

test('badge shelf covers genre/format/streak/milestone badge sets', () => {
  const ids = computeBadges([], 0, {}).map(b => b.id);
  for (const expected of [
    'first-book', 'quarter', 'half', 'threequarter', 'champion',
    'genre-explorer', 'genre-deep', 'audio-ally', 'novella-rush',
    'buddy-reader', 'week-streak', 'month-streak', 'pages-10k',
  ]) {
    assert.ok(ids.includes(expected), `missing badge: ${expected}`);
  }
});
test('milestone badges progress with goal-relative percentages', () => {
  RCT.goalRef.goal = 100;
  const m = badgeMap([book(), book()], 0);
  assert.equal(m['first-book'].earned, true);
  assert.equal(m.quarter.progress, 2);
  assert.equal(m.quarter.earned, false);
  assert.equal(m.champion.earned, false);
  RCT.goalRef.goal = 12;
});
test('champion badge earned at full goal', () => {
  RCT.goalRef.goal = 2;
  const m = badgeMap([book(), book()], 0);
  assert.equal(m.champion.earned, true);
  RCT.goalRef.goal = 12;
});
test('genre-explorer and genre-deep award on collection breadth/depth', () => {
  const books = [
    book({ genre: 'Fantasy' }), book({ genre: 'Mystery' }),
    book({ genre: 'Sci-Fi' }), book({ genre: 'Horror' }),
    book({ genre: 'Fantasy' }), book({ genre: 'Fantasy' }),
  ];
  const m = badgeMap(books, 0);
  assert.equal(m['genre-explorer'].earned, true);
  assert.equal(m['genre-deep'].earned, true); // 3x Fantasy
  assert.equal(m['genre-deep'].progress, 3);
});
test('audio-ally awards three audiobooks', () => {
  const books = [book({ format: 'audiobook' }), book({ format: 'audiobook' })];
  const m = badgeMap(books, 0);
  assert.equal(m['audio-ally'].earned, false);
  const m2 = badgeMap([...books, book({ format: 'audiobook' })], 0);
  assert.equal(m2['audio-ally'].earned, true);
});
test('novella-rush awards three novellas', () => {
  const m2 = badgeMap([book({ novella: true }), book({ novella: true })], 0);
  assert.equal(m2['novella-rush'].earned, false);
  const m3 = badgeMap([book({ novella: true }), book({ novella: true }), book({ novella: true })], 0);
  assert.equal(m3['novella-rush'].earned, true);
});
test('buddy-reader awards two buddy reads', () => {
  const m2 = badgeMap([book({ buddy: true })], 0);
  assert.equal(m2['buddy-reader'].earned, false);
  const m3 = badgeMap([book({ buddy: true }), book({ buddy: true })], 0);
  assert.equal(m3['buddy-reader'].earned, true);
});
test('streak badges track page streaks', () => {
  const m7 = badgeMap([book()], 7);
  assert.equal(m7['week-streak'].earned, true);
  assert.equal(m7['month-streak'].earned, false);
  const m30 = badgeMap([book()], 30);
  assert.equal(m30['month-streak'].earned, true);
});
test('ten-thousand-pages badge uses cumulative pages', () => {
  const books = Array.from({ length: 12 }, () => book({ pages: 900 }));
  const m = badgeMap(books, 0); // 10,800 pages
  assert.equal(m['pages-10k'].earned, true);
  assert.equal(m['pages-10k'].progress, 10000);
});
test('badges never over-report progress beyond their target', () => {
  const badges = computeBadges([book({ pages: 50000 })], 99), out = [];
  for (const b of badges) out.push(b.progress <= b.target);
  assert.ok(out.every(Boolean));
});

// --- buildWrapup ----------------------------------------------------------
test('wrap-up output contains key stats and book list', () => {
  RCT.goalRef.goal = 3;
  const state = {
    goal: 3,
    books: [
      book({ title: 'Alpha', genre: 'Fantasy', format: 'audiobook' }),
      book({ title: 'Beta', genre: 'Fantasy', format: 'physical', buddy: true, novella: true }),
      book({ title: 'Gamma', genre: 'Mystery', format: 'ebook' }),
    ],
    pageLog: {},
    bestStreak: 12,
  };
  const md = buildWrapup(state, 2026);
  assert.ok(md.includes('# 2026 Reading Year in Review'));
  assert.ok(md.includes('Books finished:** 3 of 3'));
  assert.ok(md.includes('100%'));
  assert.ok(md.includes('streak:** 12'));
  assert.ok(md.includes('Alpha'));
  assert.ok(md.includes('2. **Beta**'));
  assert.ok(md.includes('Asdale Dynamics, LLC'));
  // genre summary lists Fantasy twice
  assert.ok(md.includes('Fantasy: 2'));
  RCT.goalRef.goal = 12;
});
test('wrap-up works with an empty year', () => {
  const md = buildWrapup(defaultState(), 2026);
  assert.ok(md.includes('Books finished:** 0 of 12'));
  assert.ok(md.includes('0% of goal'));
});

// --- makeBook / persistence -----------------------------------------------
test('makeBook builds a book with sane defaults', () => {
  const b = makeBook({ title: '  Clean Title ', pages: 123.4, novella: true });
  assert.equal(b.title, 'Clean Title');
  assert.equal(b.genre, '');
  assert.equal(b.format, 'physical');
  assert.equal(b.pages, 123);
  assert.equal(b.novella, true);
  assert.equal(b.buddy, false);
  assert.ok(b.id.length >= 3);
  assert.match(b.finished, /^\d{4}-\d{2}-\d{2}$/);
});
test('saveState/loadState round-trips through localStorage stub', () => {
  const s = defaultState();
  s.books = [book()];
  s.pageLog = { [iso(2026, 3, 10)]: 25 };
  s.bestStreak = 9;
  s.goal = 42;
  saveState(s);
  const loaded = loadState();
  assert.equal(loaded.goal, 42);
  assert.equal(loaded.books.length, 1);
  assert.equal(loaded.books[0].title, 'Test Book');
  assert.equal(loaded.pageLog[iso(2026, 3, 10)], 25);
  assert.equal(loaded.bestStreak, 9);
});
test('loadState falls back to defaults on corrupt data', () => {
  backing.set(STORAGE_KEY, '{not json');
  const s = loadState();
  assert.equal(s.goal, 12);
  assert.ok(Array.isArray(s.books));
  assert.equal(JSON.stringify(s.books), '[]');
  backing.delete(STORAGE_KEY);
});
test('loadState ignores invalid goal/book data from storage', () => {
  backing.set(STORAGE_KEY, JSON.stringify({ goal: -3, books: 'not-an-array', year: 'x' }));
  const s = loadState();
  assert.equal(s.goal, 12);
  assert.equal(JSON.stringify(s.books), '[]');
  assert.equal(typeof s.year, 'number');
  backing.delete(STORAGE_KEY);
});

console.log(`\n${passed} test${passed === 1 ? '' : 's'} passed${process.exitCode ? ' (with failures above)' : ''}`);
