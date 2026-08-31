# Ledger — Vite + React + TypeScript Modernization

- **Date:** 2026-06-17
- **Status:** Approved (design); pending implementation plan
- **Owner:** nicholas

## 1. Context

"Ledger" is a personal expense tracker that began as a single-file **prototype** exported to disk. It currently runs as a set of loose files with **no build step**:

- `Ledger - Expense Tracker.html` loads React 18 (UMD) and `@babel/standalone` from the unpkg CDN, then pulls in each `.jsx` file as `<script type="text/babel" src="...">`. **JSX is transpiled in the browser on every page load.**
- Files share code through **globals**, not ES modules: `data.js` assigns `window.EXPENSE`, and each component file attaches to `window`. The `<script>` load order in the HTML is therefore load-bearing.
- It is a **real, working app**, not just a demo: `app.jsx` persists a versioned blob to `localStorage`; `data.js` only seeds the first run.

### Current architecture (as found)

| File | Provides |
|------|----------|
| `data.js` | `window.EXPENSE` — seeded, deterministic 12-month dataset (mulberry32 PRNG; "today" hardcoded to 2026-06-08) |
| `app.jsx` (~900 lines) | `App` (shell, state, persistence, mount), `ThemeMenu`, `KpiCard`, `TxDetail`, `AddExpense`, `Delta`, `Paperclip` |
| `charts.jsx` | `TrendChart`, `CategoryDonut`, `Heatmap`, `Tooltip` (SVG, CSS-var themed) |
| `transactions.jsx` | `Transactions`, `TxIcon` |
| `categories.jsx` | `CategoriesView` |
| `recurring.jsx` | `RecurringView`, `RecurringRow`, `AddRecurring` |
| `bulkadd.jsx` | `BulkAdd` |
| `insights.jsx` | `Insights`, `InsightIcon` |
| `export.jsx` | `ExportMenu`, `PrintReport` |
| `settings.jsx` | `SettingsView` (budget, currency, reset) |
| `tweaks-panel.jsx` | **Artifact scaffolding** — see §4 |

## 2. Goal & scope

Move the app onto a real toolchain (**Vite + React 18 + TypeScript**) with **behavior identical** to today, plus the two changes that leaving the artifact environment forces (see §4). Add tests and version control.

**In scope:** build tooling, ES-module conversion, TypeScript types, persisted settings, re-homed settings UI, tests, git.

**Non-goals (deferred):** splitting the ~900-line `App`, upgrading React 18→19, self-hosting fonts, any new product features, any backend/cloud sync. The app stays **client-only**.

## 3. Target architecture

```
ledger/
  index.html              # Vite entry: #root + Google Fonts <link>, NO cdn/babel scripts
  package.json
  tsconfig.json
  vite.config.ts
  .gitignore
  src/
    main.tsx              # ReactDOM.createRoot(...).render(<App/>)
    App.tsx               # from app.jsx
    styles.css            # extracted from the inline <style> (HTML lines 10–742)
    types.ts              # all shared types (§5)
    data/
      seed.ts             # from data.js — typed `buildSeed(): ExpenseData`
      storage.ts          # typed localStorage load/save, schema versioning + migration (§6)
    hooks/
      useSettings.ts      # replaces useTweaks — persisted, no postMessage (§4)
    components/
      Charts.tsx          # TrendChart, CategoryDonut, Heatmap, Tooltip
      Transactions.tsx    # Transactions, TxIcon
      CategoriesView.tsx
      RecurringView.tsx   # RecurringView, RecurringRow, AddRecurring
      BulkAdd.tsx
      Insights.tsx
      Export.tsx          # ExportMenu, PrintReport
      SettingsView.tsx
      common.tsx          # ThemeMenu, KpiCard, TxDetail, AddExpense, Delta, icons
```

### Module conversion (the mechanical core)

- Every `window.X = …` becomes an `export`; each consumer `import`s what it needs. The bundler resolves dependency order, so the brittle HTML script-order disappears.
- `data.js`'s IIFE → `export function buildSeed(): ExpenseData`.
- unpkg `<script>`s → `import React from "react"` / `import { createRoot } from "react-dom/client"`.
- `@babel/standalone` is removed entirely — Vite/esbuild compiles `.tsx`.
- **Load-time effect:** from "download ~3 MB of CDN libs + transpile ~10 files in the browser, every visit" → one small hashed, minified, cached bundle.

## 4. The tweaks-panel decision (resolved)

**Finding.** `tweaks-panel.jsx` exports two very different things:

1. `TweaksPanel` + `Tweak*` controls — the prototype's in-iframe editor UI. It `return null`s outside its original host, so it is **invisible/disposable** in a standalone app.
2. `useTweaks(defaults)` — the hook holding `{theme, accent, trendMode, density, budgetLine}`, read by the **real** UI throughout (header accent, `data-theme`, trend-chart mode, budget line, density). This hook is **load-bearing**.

Two consequences of leaving the artifact host:

- `useTweaks` is plain `useState` that relayed changes via `window.parent.postMessage`. Outside the artifact those messages go nowhere, so **appearance settings silently reset on every reload** (latent inherited bug).
- `accent`, `density`, and the `budgetLine` toggle are adjustable **only** inside the hidden editor panel. `theme` (via `ThemeMenu`) and `trendMode` (via chart buttons) have real UI; the other three become **unreachable** in a standalone app. The Settings tab today only handles budget / currency / reset.

**Decision (approved).**

1. Replace `useTweaks` with `useSettings`: same shape, but **persisted to localStorage** and **decoupled from `postMessage`/CustomEvent**. This also fixes the reset-on-reload bug.
2. **Re-home** `accent`, `density`, and `budgetLine` into the existing **Settings tab**, so no user-facing capability is lost.
3. **Drop** `TweaksPanel`, the `Tweak*` components, the `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` markers, and the `postMessage`/`tweakchange` plumbing.

## 5. TypeScript model (`types.ts`)

```ts
type CategoryId = string;

interface Category { id: CategoryId; name: string; hue: number; essential: boolean; }

interface Attachment { name: string; type: string; size: number; url: string; } // url = data URL (FileReader.readAsDataURL)

interface Transaction {
  id: string;
  day: number;
  cat: CategoryId;
  amount: number;
  merchant: string;
  need: boolean;
  recurId: string | null;
  attachments?: Attachment[];
  monthKey?: string;   // attached in some flows (delete)
  _new?: boolean;      // transient UI flag
}

interface MonthData {
  key: string; year: number; month: number;
  label: string; shortLabel: string;
  daysInMonth: number; lastDay: number;
  isCurrent: boolean; firstWeekday: number;
  transactions: Transaction[];
  byCat: Record<CategoryId, number>;
  byDay: Record<number, number>;
  total: number; isPartial: boolean;
}

interface RecurringItem {
  id: string; merchant: string; cat: CategoryId;
  amount: number; day: number; need: boolean; active?: boolean;
}

interface Settings {
  theme: "dark" | "carbon" | "light" | "sand";   // THEMES ids
  accent: string;                                 // hex; palette: #4f8ff7 #22c5d6 #8b7cf6 #34c98a #e8a23d
  trendMode: "bars" | "line" | "area";
  density: "comfortable" | "compact";
  budgetLine: boolean;
}

interface ExpenseData {
  categories: Category[];
  catById: Record<CategoryId, Category>;
  months: MonthData[];
  today: Date;
  monthlyBudget: number;
  currentIndex: number;
  recurring: RecurringItem[];
}

// Persisted localStorage shapes
interface StoredStateV1 {
  v: 1;
  txByMonth: Record<string, Transaction[]>;
  categories: Category[];
  recurring: RecurringItem[];
  budget: number;
  currency: string;
}
interface StoredStateV2 extends Omit<StoredStateV1, "v"> {
  v: 2;
  settings: Settings;
}
```

`tsconfig` uses `strict: true`. Typing the persisted blob makes the load path provably safe.

## 6. Data flow & persistence

Unchanged in spirit. `App` owns state (`months`, `categories`, `recurring`, `budget`, `currency`, `settings`). First run seeds via `buildSeed()`; later runs hydrate via `storage.load()`; a persist effect writes on change. The `recompute()` derivations (`byCat` / `byDay` / `total`) are preserved.

`storage.ts`:

- `load(): StoredStateV2 | null` — parse, validate, **migrate v1→v2** (existing data preserved; `settings` defaulted in), return `null` on absence so the app seeds. The v1→v2 default `settings` equals the current `TWEAK_DEFAULTS`: `{ theme: "dark", accent: "#4f8ff7", trendMode: "bars", density: "comfortable", budgetLine: true }`.
- `save(state: StoredStateV2): void` — wrapped in `try/catch` (quota / disabled storage → stay in-memory).
- On corrupt or unknown-version data: fall back to seed, never throw.

## 7. Error handling

- Keep the defensive `try/catch` around all storage access.
- Add explicit version + shape validation on load, with seed fallback.
- No new silent swallowing: log unexpected parse failures in dev.
- TypeScript (`strict`) converts a class of runtime errors (`undefined is not a function`, shape drift) into build-time errors.

## 8. Testing

Currently **zero tests**. Add **Vitest + React Testing Library + jsdom**. Initial suite (also serves as the **port-verification harness** — snapshot key numbers from the original, assert the port reproduces them):

1. `buildSeed()` determinism — identical seed ⇒ identical category totals / month totals.
2. `storage` round-trip + **v1→v2 migration** + corrupt-data fallback.
3. `recompute()` math — `byCat`, `byDay`, `total`.
4. `<App/>` smoke — renders, tab switching, add/delete a transaction updates totals, settings persist across a remount.

## 9. Dropped / deferred

- **Dropped:** `tweaks-panel.jsx` (`TweaksPanel`, `Tweak*`, EDITMODE markers, postMessage/`tweakchange`), unpkg CDN `<script>`s, `@babel/standalone`.
- **Deferred (YAGNI / faithful-first):** splitting `App.tsx`, React 18→19, self-hosting fonts. Revisit after the port is green and tests pass.

## 10. Migration sequence (high level)

Detailed, ordered steps belong to the implementation plan (writing-plans). High level:

1. Scaffold Vite React-TS project; bring in `react`/`react-dom` at 18.3.x.
2. Move the HTML shell → `index.html` + extract `<style>` → `styles.css`.
3. Port `data.js` → typed `seed.ts`; add `types.ts`; add `storage.ts`.
4. Port leaf components (charts, transactions, etc.) to `.tsx` with imports.
5. Port `App` → `App.tsx`; introduce `useSettings`; re-home controls into `SettingsView`.
6. Wire `main.tsx`; delete artifact scaffolding.
7. Add tests; verify behavior parity against the original baseline.
8. Commit; confirm `dev`, `build`, `tsc`, `test` all green.

## 11. Success criteria

- `npm run dev` serves with HMR; `npm run build` emits a static bundle deployable to any static host.
- Behavior identical: KPIs, charts, add/edit/delete, bulk add, recurring, month nav, theming, currency, reset, print/export, and localStorage surviving reload.
- Appearance prefs now **persist** and all are **reachable** (accent/density/budget-line in Settings).
- `tsc --noEmit` clean; `npm test` green; `git` initialized with a sensible `.gitignore`.
