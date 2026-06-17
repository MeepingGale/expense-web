# Ledger — Vite + React + TS Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the existing artifact-exported "Ledger" expense tracker onto Vite + React 18 + TypeScript with identical behavior, persisted settings, and re-homed settings controls.

**Architecture:** Client-only SPA. A bundler (Vite) replaces in-browser Babel; ES modules replace `window` globals; TypeScript types the data model. State lives in `App`, seeds from `buildSeed()` on first run, hydrates from a versioned `localStorage` blob otherwise (v1→v2 migration adds `settings`). The artifact "tweaks panel" is dropped; its load-bearing `useTweaks` hook becomes a persisted `useSettings`, and its orphaned controls (accent/density/budget-line) move into the Settings tab.

**Tech Stack:** Vite 5, React 18.3, TypeScript 5 (strict), Vitest + React Testing Library + jsdom.

**Reference spec:** `docs/superpowers/specs/2026-06-17-ledger-vite-react-ts-modernization-design.md`

---

## Conventions

**Baseline reference.** Task 1 moves the original files into `legacy/`. Throughout the port, `legacy/<file>.jsx` is the source of truth for component bodies and `legacy/Ledger - Expense Tracker.html` for CSS. `legacy/` is deleted in the final task. The original is also preserved in git (commit `248efec`).

**Component Port Recipe (referenced by every "Port …" task):**
1. Create the new `src/components/<Name>.tsx`.
2. Copy the named function bodies **verbatim** from `legacy/<source>.jsx`.
3. Add an import header with only the React hooks the file uses, e.g. `import React, { useState, useEffect, useRef } from "react";` (or `import { useState } from "react"` — `react-jsx` runtime means the bare `React` import is only needed when code references `React.` explicitly; the legacy code does use `React.useEffect` in places, so keep `import React, { … } from "react"`).
4. Add `import` lines for cross-file dependencies: types from `../types`, constants from `../data/constants`, helpers from `../data/format`, and sibling components from `./<Other>`.
5. Replace every `window.X` reference with the imported `X`.
6. Add the `Props` interface shown in the task and annotate the function (`function Name({ … }: NameProps)`).
7. `export` each symbol another file imports.
8. Verify `npm run typecheck` is clean, then commit.

**TS port gotchas to expect:** annotate `useState` generics where inference is `never` (e.g. `useState<Transaction[]>([])`, `useState<string | null>(null)`); type event handlers (`React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent`); `reader.result` is `string | ArrayBuffer | null` → cast `as string` when building an `Attachment.url`; object-keyed maps use `Record<...>`.

**Commit cadence:** one commit per task (or per green test inside a task). Conventional-commit prefixes (`chore:`, `feat:`, `refactor:`, `test:`).

---

## File Structure

```
ledger/                              (repo root = /Users/nicholas/Downloads/Expenses)
  index.html                         # NEW Vite entry (fonts + #root + module script)
  package.json  vite.config.ts  tsconfig.json  .gitignore
  legacy/                            # original files, reference only; deleted in Task 17
  docs/superpowers/{specs,plans}/    # this plan + the spec
  src/
    main.tsx                         # createRoot → <App/>
    App.tsx                          # shell + state + persistence (from legacy/app.jsx App)
    styles.css                       # extracted from legacy HTML <style>
    vite-env.d.ts
    types.ts                         # all shared types
    test/setup.ts                    # jest-dom import
    data/
      seed.ts                        # buildSeed(): ExpenseData  + recompute()
      storage.ts                     # load()/save(), STORAGE_KEY, v1→v2 migration, DEFAULT_SETTINGS
      constants.ts                   # THEMES, ACCENTS, CURRENCIES, WEEKDAYS
      format.ts                      # pad2, toDateInput, parseDateInput, ordinal, money fmt
    hooks/
      useSettings.ts                 # persisted appearance/chart settings (replaces useTweaks)
    components/
      common.tsx                     # Delta, Paperclip, KpiCard, ThemeMenu, TxDetail, AddExpense
      Charts.tsx                     # Tooltip, TrendChart, CategoryDonut, Heatmap
      Transactions.tsx               # Transactions, TxIcon
      CategoriesView.tsx
      RecurringView.tsx              # RecurringRow, RecurringView, AddRecurring
      BulkAdd.tsx
      Insights.tsx                   # Insights, InsightIcon
      Export.tsx                     # ExportMenu, PrintReport
      SettingsView.tsx               # + re-homed accent/density/budget-line controls
```

---

## Task 1: Scaffold Vite + React + TS + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (temporary), `src/styles.css`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/smoke.test.ts`
- Move: all root `*.jsx`, `data.js`, and `Ledger - Expense Tracker.html` → `legacy/`

- [ ] **Step 1: Move originals into `legacy/`**

```bash
cd /Users/nicholas/Downloads/Expenses
mkdir -p legacy
git mv app.jsx bulkadd.jsx categories.jsx charts.jsx data.js export.jsx insights.jsx recurring.jsx settings.jsx transactions.jsx tweaks-panel.jsx legacy/
git mv "Ledger - Expense Tracker.html" legacy/
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "ledger",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

(`noUnusedLocals/Parameters` are off so the faithful port isn't blocked by cosmetic unused-variable errors; tighten later if desired.)

- [ ] **Step 4: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 5: Write `index.html`** (at repo root)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ledger — Expense Tracker</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Extract CSS → `src/styles.css`**

Copy the contents **between** `<style>` (line 10) and `</style>` (line 742) of `legacy/Ledger - Expense Tracker.html` verbatim into `src/styles.css`. Do not include the `<style>`/`</style>` tags themselves.

- [ ] **Step 7: Write `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 8: Write `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 9: Write temporary `src/App.tsx`**

```tsx
export default function App() {
  return <div className="app">Ledger — scaffolding OK</div>;
}
```

- [ ] **Step 10: Write `src/main.tsx`**

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");
createRoot(el).render(<App />);
```

(No `StrictMode` — the original didn't use it, and it would double-invoke effects in dev. Add it after the port is verified if desired.)

- [ ] **Step 11: Write `src/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 12: Install and verify**

```bash
npm install
npm run typecheck   # Expected: no errors
npm test            # Expected: 1 passed (smoke.test.ts)
npm run build       # Expected: builds dist/ with no TS errors
npm run dev         # Expected: serves; browser shows "Ledger — scaffolding OK". Ctrl-C to stop.
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest; move originals to legacy/"
```

---

## Task 2: Shared types + static constants

**Files:** Create `src/types.ts`, `src/data/constants.ts`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  name: string;
  hue: number;
  essential: boolean;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string; // data URL from FileReader.readAsDataURL
}

export interface Transaction {
  id: string;
  day: number;
  cat: CategoryId;
  amount: number;
  merchant: string;
  need: boolean;
  recurId: string | null;
  attachments?: Attachment[];
  monthKey?: string; // attached in delete flow
  _new?: boolean;    // transient UI flag
}

export interface MonthData {
  key: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  daysInMonth: number;
  lastDay: number;
  isCurrent: boolean;
  firstWeekday: number;
  transactions: Transaction[];
  byCat: Record<CategoryId, number>;
  byDay: Record<number, number>;
  total: number;
  isPartial: boolean;
}

export interface RecurringItem {
  id: string;
  merchant: string;
  cat: CategoryId;
  amount: number;
  day: number;
  need: boolean;
  active?: boolean;
}

export interface Settings {
  theme: "dark" | "carbon" | "light" | "sand";
  accent: string; // hex; see ACCENTS palette
  trendMode: "bars" | "line" | "area";
  density: "comfortable" | "compact";
  budgetLine: boolean;
}

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
}

export interface ThemeOption {
  id: Settings["theme"];
  name: string;
  bg: string;
  card: string;
  text: string;
}

export interface AccentOption {
  id: string;
  val: string;
}

export interface ExpenseData {
  categories: Category[];
  catById: Record<CategoryId, Category>;
  months: MonthData[];
  today: Date;
  monthlyBudget: number;
  currentIndex: number;
  recurring: RecurringItem[];
}

export interface StoredStateV1 {
  v: 1;
  txByMonth: Record<string, Transaction[]>;
  categories: Category[];
  recurring: RecurringItem[];
  budget: number;
  currency: string;
}

export interface StoredStateV2 extends Omit<StoredStateV1, "v"> {
  v: 2;
  settings: Settings;
}
```

- [ ] **Step 2: Write `src/data/constants.ts`**

Copy the `THEMES` and `ACCENTS` arrays verbatim from `legacy/app.jsx` (lines 4–20), the `CURRENCIES` array from `legacy/charts.jsx` (line 4), and `WEEKDAYS` from `legacy/transactions.jsx` (line 4). Add type annotations and `export`:

```ts
import type { ThemeOption, AccentOption, Currency } from "../types";

export const THEMES: ThemeOption[] = [
  /* paste the 4 entries from legacy/app.jsx: dark/carbon/light/sand */
];

export const ACCENTS: AccentOption[] = [
  /* paste the 5 entries from legacy/app.jsx: blue/cyan/violet/green/amber */
];

export const CURRENCIES: Currency[] = [
  /* paste from legacy/charts.jsx line 4 (e.g. { code:"USD", symbol:"$" }, …) */
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
```

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck   # Expected: no errors
git add -A && git commit -m "feat: add shared types and static constants"
```

---

## Task 3: Seed data + recompute (TDD)

**Files:** Create `src/data/seed.ts`, `src/data/seed.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/data/seed.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildSeed, recompute } from "./seed";
import type { Category, MonthData } from "../types";

describe("buildSeed", () => {
  it("is deterministic", () => {
    expect(buildSeed()).toEqual(buildSeed());
  });
  it("produces 12 months ending June 2026", () => {
    const { months } = buildSeed();
    expect(months).toHaveLength(12);
    expect(months[11].key).toBe("2026-06");
  });
  it("each month's byCat sums to its total", () => {
    for (const m of buildSeed().months) {
      const sum = Object.values(m.byCat).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(m.total, 2);
    }
  });
});

describe("recompute", () => {
  it("derives byCat, byDay and a cent-rounded total", () => {
    const cats: Category[] = [
      { id: "a", name: "A", hue: 1, essential: true },
      { id: "b", name: "B", hue: 2, essential: false },
    ];
    const base = {
      key: "2026-06", year: 2026, month: 5, label: "June 2026", shortLabel: "Jun",
      daysInMonth: 30, lastDay: 8, isCurrent: true, firstWeekday: 1, isPartial: true,
      transactions: [
        { id: "1", day: 1, cat: "a", amount: 10, merchant: "x", need: true, recurId: null },
        { id: "2", day: 1, cat: "b", amount: 5, merchant: "y", need: false, recurId: null },
        { id: "3", day: 2, cat: "a", amount: 2.005, merchant: "z", need: true, recurId: null },
      ],
    } as Omit<MonthData, "byCat" | "byDay" | "total">;
    const r = recompute(base, cats);
    expect(r.byCat).toEqual({ a: 12.005, b: 5 });
    expect(r.byDay).toEqual({ 1: 15, 2: 2.005 });
    expect(r.total).toBe(17.01);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/data/seed.test.ts`
Expected: FAIL — `buildSeed`/`recompute` not exported / module not found.

- [ ] **Step 3: Implement `src/data/seed.ts`**

Port `legacy/data.js` (lines 3–146, the IIFE body) into a typed module. Transformation:
- Keep `mulberry32`, `money`, `pick`, `CATEGORIES`, `MERCHANTS`, `MONTH_NAMES`, the month-building loop, and the `data.map(...)` block **verbatim**.
- Remove the `(function () { … })()` IIFE wrapper and the `window.EXPENSE = {…}` assignment.
- Wrap the construction in `export function buildSeed(): ExpenseData { … return { categories, catById, months, today, monthlyBudget, currentIndex, recurring }; }` using the same object literal that was assigned to `window.EXPENSE` (lines 128–145).
- Type the locals: `const CATEGORIES: Category[] = […]`, `tx: Transaction[]`, etc.
- Add `recompute` as a standalone export (it was in `legacy/app.jsx` lines 78–90) but parameterize the category list instead of reading a global:

```ts
import type {
  Category, CategoryId, ExpenseData, MonthData, Transaction,
} from "../types";

export function recompute(
  month: Omit<MonthData, "byCat" | "byDay" | "total">,
  categories: Category[],
): MonthData {
  const byCat: Record<CategoryId, number> = {};
  categories.forEach((c) => (byCat[c.id] = 0));
  const byDay: Record<number, number> = {};
  let total = 0;
  month.transactions.forEach((t) => {
    byCat[t.cat] = (byCat[t.cat] ?? 0) + t.amount;
    byDay[t.day] = (byDay[t.day] ?? 0) + t.amount;
    total += t.amount;
  });
  return { ...month, byCat, byDay, total: Math.round(total * 100) / 100 };
}

export function buildSeed(): ExpenseData {
  // … ported body from legacy/data.js …
}
```

(Note: `recompute` now seeds `byCat` from the passed `categories` and uses `?? 0`, so user-added categories no longer produce `NaN` — a faithful-plus-safer version of the original.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/data/seed.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: port seeded dataset and recompute() to typed module"
```

---

## Task 4: Storage module (TDD)

**Files:** Create `src/data/storage.ts`, `src/data/storage.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/data/storage.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { load, save, STORAGE_KEY, DEFAULT_SETTINGS } from "./storage";
import type { StoredStateV1, StoredStateV2 } from "../types";

const v2: StoredStateV2 = {
  v: 2, txByMonth: { "2026-06": [] }, categories: [], recurring: [],
  budget: 3800, currency: "USD", settings: DEFAULT_SETTINGS,
};

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing stored", () => {
    expect(load()).toBeNull();
  });

  it("round-trips a v2 state", () => {
    save(v2);
    expect(load()).toEqual(v2);
  });

  it("migrates a v1 blob to v2 with default settings", () => {
    const v1: StoredStateV1 = {
      v: 1, txByMonth: { "2026-06": [] }, categories: [], recurring: [],
      budget: 3800, currency: "USD",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    const out = load();
    expect(out?.v).toBe(2);
    expect(out?.settings).toEqual(DEFAULT_SETTINGS);
    expect(out?.budget).toBe(3800);
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(load()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/data/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/data/storage.ts`**

```ts
import type { Settings, StoredStateV1, StoredStateV2 } from "../types";

// Historical key name; the stored `v` field is the real version marker.
export const STORAGE_KEY = "ledger-state-v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "#4f8ff7",
  trendMode: "bars",
  density: "comfortable",
  budgetLine: true,
};

export function load(): StoredStateV2 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number } & Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v === 2) return parsed as unknown as StoredStateV2;
    if (parsed.v === 1) {
      const v1 = parsed as unknown as StoredStateV1;
      return { ...v1, v: 2, settings: { ...DEFAULT_SETTINGS } };
    }
    return null; // unknown version → caller reseeds
  } catch {
    return null; // corrupt or disabled storage
  }
}

export function save(state: StoredStateV2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or disabled storage — stay in-memory */
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/data/storage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: typed localStorage with v1->v2 settings migration"
```

---

## Task 5: useSettings hook (TDD)

**Files:** Create `src/hooks/useSettings.ts`, `src/hooks/useSettings.test.ts`

- [ ] **Step 1: Write the failing test** — `src/hooks/useSettings.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSettings } from "./useSettings";
import { DEFAULT_SETTINGS } from "../data/storage";

describe("useSettings", () => {
  it("updates a single key immutably", () => {
    const { result } = renderHook(() => useSettings(DEFAULT_SETTINGS));
    act(() => result.current[1]("theme", "light"));
    expect(result.current[0].theme).toBe("light");
    expect(result.current[0].accent).toBe(DEFAULT_SETTINGS.accent);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/hooks/useSettings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/hooks/useSettings.ts`**

```ts
import { useState, useCallback } from "react";
import type { Settings } from "../types";

export type SetSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

// Holds appearance/chart settings. Replaces the artifact's useTweaks:
// no postMessage; persistence is handled by App's storage effect (settings
// are part of the StoredStateV2 blob).
export function useSettings(initial: Settings): [Settings, SetSetting] {
  const [settings, setSettings] = useState<Settings>(initial);
  const set = useCallback<SetSetting>((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);
  return [settings, set];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/hooks/useSettings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: persisted useSettings hook (replaces useTweaks)"
```

---

## Task 6: Port `common.tsx`

Apply the **Component Port Recipe**. Source: `legacy/app.jsx` (components `Delta`, `Paperclip`, `KpiCard`, `ThemeMenu`, `TxDetail`, `AddExpense`; helper `ordinal`). Also move date/format helpers (`pad2`, `toDateInput`, `parseDateInput` from `legacy/app.jsx` lines 56–58) into `src/data/format.ts` and import them.

**Files:** Create `src/components/common.tsx`, `src/data/format.ts`

- [ ] **Step 1: Create `src/data/format.ts`**

```ts
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDateInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
};
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
```

- [ ] **Step 2: Create `src/components/common.tsx`** with these prop interfaces, then paste the component bodies from `legacy/app.jsx`:

```ts
import type { Category, CategoryId, Transaction, Settings } from "../types";

interface DeltaProps { value: number | null | undefined; }
interface KpiCardProps {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  delta?: number; children?: React.ReactNode;
}
interface PaperclipProps { size?: number; }
interface ThemeMenuProps { theme: Settings["theme"]; onChange: (theme: Settings["theme"]) => void; }
interface TxDetailProps {
  tx: Transaction | null;
  catById: Record<CategoryId, Category>;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}
interface AddExpenseProps {
  open: boolean;
  onClose: () => void;
  onAdd: (tx: Transaction) => void;
  editTx: Transaction | null;
  defaultDate: string; minDate: string; maxDate: string;
  categories: Category[];
  catById: Record<CategoryId, Category>;
}
```

Notes while porting:
- `TxDetail` reads `a.type`, `a.url`, `a.name` on attachments — already typed by `Attachment`.
- In `AddExpense`, the file reader builds `{ name, type, size, url: reader.result as string }`; cast `reader.result as string`. Type the files state `useState<Attachment[]>([])`.
- `export` `Delta`, `Paperclip`, `KpiCard`, `ThemeMenu`, `TxDetail`, `AddExpense`.

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck   # Expected: no errors
git add -A && git commit -m "refactor: port shared UI components to common.tsx"
```

---

## Task 7: Port `Charts.tsx`

Apply the recipe. Source: `legacy/charts.jsx` (`Tooltip`, `TrendChart`, `CategoryDonut`, `Heatmap`). The `CURRENCIES` constant moves to `constants.ts` (Task 2) — delete it here and import where needed.

**Files:** Create `src/components/Charts.tsx`

- [ ] **Step 1: Create the file with prop interfaces, paste bodies:**

```ts
import type { MonthData, CategoryId, Settings } from "../types";

interface TooltipProps { x: number; y: number; w?: number; children: React.ReactNode; }
interface TrendChartProps {
  months: MonthData[]; selectedIndex: number; onSelect: (i: number) => void;
  accent: string; mode: Settings["trendMode"]; budget: number;
}
interface DonutSlice { id: CategoryId; name: string; hue: number; value: number; }
interface CategoryDonutProps {
  items: DonutSlice[]; total: number;
  hovered: CategoryId | null; onHover: (id: CategoryId | null) => void;
}
interface HeatmapProps {
  month: MonthData; selectedDay: number | null; onSelectDay: (day: number | null) => void;
}
```

Confirm `DonutSlice` against the object App builds for `items` (from `byCat`); adjust field names if the legacy donut reads different keys. Type SVG measurement refs as `useRef<SVGSVGElement | null>(null)` / `useRef<HTMLDivElement | null>(null)` and `requestAnimationFrame` ids as `number`. `export` all four.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port chart components to Charts.tsx"
```

---

## Task 8: Port `Transactions.tsx`

Source: `legacy/transactions.jsx`. `WEEKDAYS` now imports from `constants.ts`.

**Files:** Create `src/components/Transactions.tsx`

- [ ] **Step 1: Create with prop interface + paste body:**

```ts
import type { Category, CategoryId, MonthData, Transaction } from "../types";

interface TransactionsProps {
  months: MonthData[];
  categories: Category[];
  catById: Record<CategoryId, Category>;
  onAddClick: () => void;
  onBulkClick: () => void;
  onOpenTx: (tx: Transaction) => void;
}
```

`TxIcon` takes no props. `export` `Transactions` and `TxIcon`.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port Transactions.tsx"
```

---

## Task 9: Port `CategoriesView.tsx`

Source: `legacy/categories.jsx`.

**Files:** Create `src/components/CategoriesView.tsx`

- [ ] **Step 1: Create with prop interface + paste body:**

```ts
import type { Category, MonthData } from "../types";

interface CategoriesViewProps {
  categories: Category[];
  months: MonthData[];
  onAdd: (cat: Category) => void;
  onRemove: (id: string) => void;
  accent: string;
}
```

Confirm the `onAdd`/`onRemove` argument shapes against the legacy call sites; adjust if it passes a partial. `export` `CategoriesView`.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port CategoriesView.tsx"
```

---

## Task 10: Port `RecurringView.tsx`

Source: `legacy/recurring.jsx` (`RecurringRow`, `RecurringView`, `AddRecurring`).

**Files:** Create `src/components/RecurringView.tsx`

- [ ] **Step 1: Create with prop interfaces + paste bodies:**

```ts
import type { Category, CategoryId, RecurringItem } from "../types";

interface RecurringRowProps {
  item: RecurringItem;
  catById: Record<CategoryId, Category>;
  onEditAmount: (id: string, amount: number) => void;
  onToggle: (id: string) => void;
}
interface RecurringViewProps {
  recurring: RecurringItem[];
  catById: Record<CategoryId, Category>;
  onEditAmount: (id: string, amount: number) => void;
  onToggle: (id: string) => void;
  onAddClick: () => void;
}
interface AddRecurringProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: RecurringItem) => void;
  categories: Category[];
  catById: Record<CategoryId, Category>;
}
```

`export` all three.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port RecurringView.tsx"
```

---

## Task 11: Port `BulkAdd.tsx`

Source: `legacy/bulkadd.jsx`.

**Files:** Create `src/components/BulkAdd.tsx`

- [ ] **Step 1: Create with prop interface + paste body:**

```ts
import type { Category, CategoryId, Transaction } from "../types";

interface BulkAddProps {
  open: boolean;
  onClose: () => void;
  onInsert: (txs: Transaction[]) => void;
  categories: Category[];
  catById: Record<CategoryId, Category>;
  minDate: string;
  maxDate: string;
}
```

Confirm `onInsert`'s argument (array of new transactions) against the legacy call site at `legacy/app.jsx` `bulkInsert`. `export` `BulkAdd`.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port BulkAdd.tsx"
```

---

## Task 12: Port `Insights.tsx`

Source: `legacy/insights.jsx` (`Insights`, `InsightIcon`).

**Files:** Create `src/components/Insights.tsx`

- [ ] **Step 1: Create with prop interfaces + paste bodies:**

```ts
import type { Category, CategoryId, MonthData } from "../types";

interface InsightIconProps { kind: string; }
interface InsightsProps {
  month: MonthData;
  months: MonthData[];
  idx: number;
  catById: Record<CategoryId, Category>;
  budget: number;
}
```

Narrow `InsightIconProps.kind` to a string-literal union if the legacy switch enumerates fixed kinds. `export` both.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port Insights.tsx"
```

---

## Task 13: Port `Export.tsx`

Source: `legacy/export.jsx` (`ExportMenu`, `PrintReport`).

**Files:** Create `src/components/Export.tsx`

- [ ] **Step 1: Create with prop interfaces + paste bodies:**

```ts
import type { Category, CategoryId, MonthData } from "../types";

interface ExportMenuProps {
  months: MonthData[];
  catById: Record<CategoryId, Category>;
  onPrint: () => void;
}
interface PrintReportProps {
  month: MonthData;
  categories: Category[];
  catById: Record<CategoryId, Category>;
  budget: number;
}
```

CSV export builds a Blob/anchor — type the anchor `document.createElement("a")` (already typed) and `URL.createObjectURL`. `export` both.

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "refactor: port Export.tsx"
```

---

## Task 14: Port + extend `SettingsView.tsx` (re-home controls)

Source: `legacy/settings.jsx`. Keep budget / currency / reset. **Add** the three orphaned controls (accent, density, budget-line) that previously lived only in the artifact tweaks panel.

**Files:** Create `src/components/SettingsView.tsx`

- [ ] **Step 1: Create with extended prop interface + paste the existing body:**

```ts
import type { Currency, Settings } from "../types";

interface SettingsViewProps {
  budget: number;
  onBudget: (v: number) => void;
  currency: string;
  onCurrency: (code: string) => void;
  currencies: Currency[];
  onReset: () => void;
  // re-homed from the artifact tweaks panel:
  settings: Settings;
  onSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}
```

- [ ] **Step 2: Add an "Appearance" section** to the returned JSX (after the existing budget/currency blocks, before reset). Use the existing `setv-*` classes for visual consistency:

```tsx
import { ACCENTS } from "../data/constants";

// … inside the component return, add:
<div className="setv-section">
  <div className="setv-label">
    <h2>Appearance</h2>
    <p>Accent color, density, and chart options.</p>
  </div>
  <div className="setv-control">
    <label className="setv-row">
      <span>Accent</span>
      <div className="accent-swatches">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            className={"accent-dot" + (settings.accent === a.val ? " sel" : "")}
            style={{ background: a.val }}
            aria-label={a.id}
            onClick={() => onSetting("accent", a.val)}
          />
        ))}
      </div>
    </label>
    <label className="setv-row">
      <span>Density</span>
      <select
        value={settings.density}
        onChange={(e) => onSetting("density", e.target.value as Settings["density"])}
      >
        <option value="comfortable">Comfortable</option>
        <option value="compact">Compact</option>
      </select>
    </label>
    <label className="setv-row">
      <span>Budget line on chart</span>
      <input
        type="checkbox"
        checked={settings.budgetLine}
        onChange={(e) => onSetting("budgetLine", e.target.checked)}
      />
    </label>
  </div>
</div>
```

(`theme` and `trendMode` already have UI — `ThemeMenu` and the trend-style buttons — so they are intentionally not duplicated here.)

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck
git add -A && git commit -m "feat: port SettingsView and re-home accent/density/budget-line controls"
```

---

## Task 15: Port `App.tsx` (wire everything; drop the tweaks panel)

Source: `legacy/app.jsx` `App` (lines 370–898) plus the module-level helpers `STORAGE_KEY`/`loadPersisted`/`buildMonths` (now provided by `storage.ts`/`seed.ts`). This is the integration task.

**Files:** Replace `src/App.tsx` (the temporary scaffold)

- [ ] **Step 1: Build the import header**

```tsx
import React, { useState, useEffect, useMemo } from "react";
import type { Category, MonthData, RecurringItem, Settings, Transaction } from "./types";
import { buildSeed, recompute } from "./data/seed";
import { load, save, DEFAULT_SETTINGS } from "./data/storage";
import { useSettings } from "./hooks/useSettings";
import { THEMES, ACCENTS, CURRENCIES } from "./data/constants";
import { ordinal, toDateInput, parseDateInput } from "./data/format";
import { Delta, Paperclip, KpiCard, ThemeMenu, TxDetail, AddExpense } from "./components/common";
import { Tooltip, TrendChart, CategoryDonut, Heatmap } from "./components/Charts";
import { Transactions } from "./components/Transactions";
import { CategoriesView } from "./components/CategoriesView";
import { RecurringView, AddRecurring } from "./components/RecurringView";
import { BulkAdd } from "./components/BulkAdd";
import { Insights } from "./components/Insights";
import { ExportMenu, PrintReport } from "./components/Export";
import { SettingsView } from "./components/SettingsView";
```

(Trim to what `App` actually references. `buildSeed()` replaces the `EXPENSE` global — call it once: `const EXPENSE = useMemo(() => buildSeed(), []);`.)

- [ ] **Step 2: Paste the `App` body**, then apply these edits:
  - Replace `EXPENSE.*` references with the memoized `EXPENSE`.
  - Initialize state from storage + seed (replaces `loadPersisted()`/`buildMonths()`):

    ```tsx
    const stored = useMemo(() => load(), []);
    const [months, setMonths] = useState<MonthData[]>(() =>
      EXPENSE.months.map((m) =>
        recompute(
          { ...m, transactions: stored?.txByMonth?.[m.key] ?? m.transactions },
          stored?.categories ?? EXPENSE.categories,
        ),
      ),
    );
    const [categories, setCategories] = useState<Category[]>(stored?.categories ?? EXPENSE.categories);
    const [recurring, setRecurring] = useState<RecurringItem[]>(stored?.recurring ?? EXPENSE.recurring.map((r) => ({ ...r, active: true })));
    const [budget, setBudget] = useState<number>(stored?.budget ?? EXPENSE.monthlyBudget);
    const [currency, setCurrency] = useState<string>(stored?.currency ?? "USD");
    const [t, setTweak] = useSettings(stored?.settings ?? DEFAULT_SETTINGS);
    ```

  - Type the remaining UI state explicitly (`useState<string | null>(null)` for `filterCat`, `useState<Transaction | null>(null)` for `viewerTx`/`editingTx`, `useState<number | null>(null)` for `selectedDay`, etc.).
  - Update the **persist effect** to write `StoredStateV2` (now including `settings: t`) via `save(...)`, and add `t` to its dependency array:

    ```tsx
    useEffect(() => {
      const txByMonth: Record<string, Transaction[]> = {};
      months.forEach((m) => { txByMonth[m.key] = m.transactions; });
      save({ v: 2, txByMonth, categories, recurring, budget, currency, settings: t });
    }, [months, categories, recurring, budget, currency, t]);
    ```

  - In `resetData`, also reset settings: `setTweak` cannot replace wholesale, so reset each key, or expose a `reset` — simplest: keep `resetData` as-is for data and additionally call `("theme"…)`? Instead, leave appearance untouched on data reset (matches original intent: reset is "reset to sample **data**"). Remove the `localStorage.removeItem` line's reliance on a bare key — call it via the storage module is unnecessary; keep `try { localStorage.removeItem("ledger-state-v1"); } catch {}` or simply let the next persist overwrite. Keep behavior: clear stored, reseed state.
  - Pass settings into `SettingsView`: `settings={t} onSetting={setTweak}` (plus existing `budget/currency/currencies={CURRENCIES}/onReset`).
  - **Delete** the entire `<TweaksPanel> … </TweaksPanel>` block (lines 880–890) and its `TweakSection/TweakSelect/TweakColor/TweakRadio/TweakToggle/TweakButton` children. Those controls now live in `SettingsView` (accent/density/budget-line) or already exist (theme via `ThemeMenu`, trend style via the chart buttons). The `resetData` button moves to / stays in `SettingsView` (already wired via `onReset`).
  - Remove the `data-density` attribute source if it referenced the panel — it reads `t.density`, which still works.
  - Keep `export default function App()`.

- [ ] **Step 3: Verify the toolchain is green**

```bash
npm run typecheck   # Expected: no errors
npm run build       # Expected: clean build
npm run dev         # Manual smoke: app loads with real data; see Task 16 checklist
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: wire App.tsx with modules, useSettings, and v2 persistence; drop tweaks panel"
```

---

## Task 16: App smoke + behavior-parity tests

**Files:** Create `src/App.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("renders the brand and overview by default", () => {
    render(<App />);
    expect(screen.getByText("Ledger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Overview/i })).toBeInTheDocument();
  });

  it("switches to the Settings tab and shows the re-homed Appearance section", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText(/Budget line on chart/i)).toBeInTheDocument();
  });

  it("persists a settings change across a remount", () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));
    fireEvent.click(screen.getByLabelText("amber")); // accent swatch
    unmount();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));
    const amber = screen.getByLabelText("amber");
    expect(amber.className).toMatch(/sel/);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS. (If a query doesn't match, adjust the selector to the real rendered text/aria — do not change app behavior to fit the test.)

- [ ] **Step 3: Manual parity checklist** (against `legacy/Ledger - Expense Tracker.html` served locally — `npx serve legacy` or open via any static server, since `file://` won't run the legacy Babel loader):
  - [ ] Overview KPIs, trend chart, donut, heatmap render with seeded data
  - [ ] Month nav (‹ ›, arrow keys) works
  - [ ] Add / edit / delete an expense updates totals; attachment upload + preview works
  - [ ] Bulk add inserts rows
  - [ ] Recurring view: toggle + edit amount
  - [ ] Categories view renders; add/remove
  - [ ] Theme switch (ThemeMenu) + accent/density/budget-line (Settings) apply; **survive reload**
  - [ ] Currency change + budget edit + reset-to-sample-data
  - [ ] Export CSV + print report

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: App smoke and settings-persistence parity tests"
```

---

## Task 17: Cleanup + final verification

**Files:** Delete `legacy/`; create `README.md`

- [ ] **Step 1: Confirm nothing in `src/` imports from `legacy/`**

Run: `grep -rn "legacy/" src/ || echo "clean"`
Expected: `clean`.

- [ ] **Step 2: Remove the baseline reference tree**

```bash
git rm -r legacy/
```

- [ ] **Step 3: Write `README.md`**

```markdown
# Ledger — Expense Tracker

Client-only React + TypeScript expense tracker. Data persists in `localStorage`.

## Develop
\`\`\`bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # static bundle in dist/
\`\`\`

The original artifact export is preserved in git history (commit 248efec).
```

- [ ] **Step 4: Full green check**

```bash
npm run typecheck   # Expected: no errors
npm test            # Expected: all suites pass
npm run build       # Expected: dist/ built
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: remove legacy reference tree; add README; final green"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Build tooling → T1; ES-module conversion → T6–T15; TypeScript model → T2; `seed`/`recompute` → T3; storage + v1→v2 migration → T4; persisted `useSettings` → T5; re-homed controls → T14; App integration + drop scaffolding → T15; error handling (try/catch + version/shape validation + seed fallback) → T4 + T15 persist/reset; tests (determinism, storage, recompute, App smoke) → T3/T4/T5/T16; dropped scaffolding + deferred App split → T15/T17; success criteria (dev/build/tsc/test/git) → T1 + T16 + T17. No uncovered spec sections.
- **Placeholder scan:** No "TBD/TODO". The component-port tasks carry full prop interfaces + a concrete recipe; bodies are copied verbatim from named `legacy/` files (not reproduced, by design — they are unchanged existing code). A few "confirm shape against legacy call site" notes are verification instructions for internal object shapes (`DonutSlice`, `onAdd`/`onInsert` args), not deferred work.
- **Type consistency:** `recompute(month, categories)` signature is consistent T3→T15. `Settings`/`SetSetting` consistent T5→T14→T15. `StoredStateV2` (with `settings`) consistent T2→T4→T15. `setTweak("key", value)` call shape matches `SetSetting` and the legacy call sites. `STORAGE_KEY = "ledger-state-v1"` consistent T4/T15.
