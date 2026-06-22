# Theme-flash fix, persistence-test repair, and empty-ledger — design

**Date:** 2026-06-22
**Status:** implemented & verified

## Background

Request: "persist the theme and the settings after the server closes down,"
then "clear all the dummy data," then "fix build."

Investigation finding: theme + settings **already** persist. `App.tsx` writes the
full state blob (including `settings`, which holds `theme`) to `localStorage` on every
change and reads it back on boot; `storage.test.ts` round-trips it. Because
`localStorage` is browser-side and origin-scoped, it already survives the Vite
dev/preview server stopping. So "persist after the server closes" was a non-issue
at the data layer. Two real rough edges explained the *perception* that it reset:

1. **Flash of the wrong theme on reload.** Theme tokens (`--bg`, `--text`, …) are
   defined only under `[data-theme="…"]` selectors, never on `:root`. Until React
   mounts and sets `data-theme`, `<body>` paints with undefined vars (white bg,
   black text) on every full load — including every dev-server restart + reload.
2. **Dead persistence test.** `@testing-library/react@16` needs peer dep
   `@testing-library/dom@^10`, which was not installed, so `App.test.tsx`
   (containing the "persists a settings change across a full remount" regression)
   and `useSettings.test.ts` silently loaded 0 tests.

## Decisions

### 1. Eliminate the theme flash — Approach A (blocking inline script)

- Add `data-theme="dark"` statically to `<html>` (safe default == `DEFAULT_SETTINGS.theme`).
- Add a tiny blocking inline script in `<head>` that reads `localStorage["ledger-state-v1"]`,
  pulls `settings.theme`, validates it against `["dark","light","carbon","sand"]`, and
  overrides the attribute before `<body>` paints. Wrapped in try/catch → empty/corrupt
  storage keeps the static dark default.
- Rejected: applying the theme in `main.tsx` (deferred module → smaller flash still slips
  through) and a static-default-only approach (non-dark themes still flash).
- Trade-off accepted: the inline script duplicates the storage key + theme list (a
  blocking inline script cannot import from `storage.ts`); a comment cross-links them.

### 2. Repair the dead test

- Add `@testing-library/dom@^10` to `devDependencies` (npm; `package-lock.json` is the
  tracked lockfile). Removed the stray untracked `yarn.lock` to end package-manager ambiguity.

### 3. Clear all dummy data → empty ledger (code) + clear existing storage (data)

- **Seed (fresh installs):** `buildSeed()` did double duty (sample transactions **+** month
  scaffolding). Stripped the fake-transaction generator; it now returns an **empty** 12-month
  scaffold (ending June 2026) with zero transactions and **no recurring items**. Kept the 9
  default categories + default budget ($3,800) + USD (a usable starter taxonomy, not "data").
  Repurposed the Settings "Reset to sample data" control → **"Clear all data."**
- **Existing storage (the "doesn't seem cleared" follow-up):** the seed change only affects
  *fresh* storage; browsers that already ran the app have the seeded data saved under
  `ledger-state-v1`, so `load()` kept returning it. Fix: bump the stored version to **v3**.
  `load()` migrates v1/v2 **once** by clearing `txByMonth` + `recurring` while keeping
  `settings` (theme!), `categories`, `budget`, and `currency`. `App` now `save()`s v3, so the
  clear runs at most once and never touches transactions the user adds later.

### 4. Fix build

- `styles.css` had an orphaned rule body after the "needs vs wants" section comment — the
  `.nw-compare` selector had been lost, so esbuild warned `Unexpected "{"` on every build and
  the comparison row (`App.tsx` `.nw-compare`) was unstyled. Restored the selector.

## Files changed

- `index.html` — static `data-theme="dark"` + pre-paint inline script.
- `package.json` / `package-lock.json` — add `@testing-library/dom`.
- `src/data/seed.ts` — remove generator; empty scaffold + default categories (net −144 lines).
- `src/data/seed.test.ts` — assert the empty contract (no transactions/recurring; categories kept).
- `src/data/storage.ts` — v3 + one-time legacy-seed clear migration.
- `src/data/storage.test.ts` — assert v3 round-trip + v1/v2→v3 migration (clears data, keeps settings).
- `src/types.ts` — add `StoredStateV3`.
- `src/App.tsx` — persist as v3.
- `src/components/SettingsView.tsx` — "Clear all data" copy.
- `src/styles.css` — restore `.nw-compare` selector.
- removed `yarn.lock` (untracked).

## Verification

- `vitest run`: 18/18 pass, incl. the now-live reset-on-reload regression, the empty-overview
  render, and the v1/v2→v3 migration.
- `npm run build`: clean — no CSS warning; `dist/index.html` includes the inline script.
- Browser (vite preview): fresh install renders empty ($0, no transactions, no crash); saving a
  `sand` theme + reloading comes up `data-theme="sand"` with no dark flash; seeding a **v2 blob
  with fake transactions** and reloading clears them to $0 while keeping `sand` (migration → v3).

## Operational note

The dev server left running on :5173 from before these changes serves the **old** code, so it
will keep showing the seeded data. Restart it (`npm run dev`) to pick up the new build; the v3
migration then clears the saved demo data on the next load.

## Out of scope / follow-ups

- `seed.ts` still hardcodes `today = 2026-06-08`; a real app would use the actual current date.
- npm reports 5 pre-existing transitive vulnerabilities in the toolchain; `audit fix --force`
  pulls breaking changes, so left untouched.
