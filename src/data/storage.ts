import type { Settings, StoredStateV4, Category } from "../types";

// Historical key name; the stored `v` field is the real version marker.
export const STORAGE_KEY = "ledger-state-v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "#4f8ff7",
  trendMode: "bars",
  density: "comfortable",
  budgetLine: true,
};

export function load(): StoredStateV4 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number } & Record<string, any>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v === 4) return parsed as unknown as StoredStateV4;
    // Migrate up to v4. v1/v2 also drop their legacy seeded sample data (kept
    // settings/categories/budget/currency); v3 user data is preserved as-is.
    let base: Record<string, any> | null = null;
    if (parsed.v === 3) base = parsed;
    else if (parsed.v === 2) base = { ...parsed, txByMonth: {}, recurring: [] };
    else if (parsed.v === 1) base = { ...parsed, settings: { ...DEFAULT_SETTINGS }, txByMonth: {}, recurring: [] };
    else return null; // unknown version -> caller reseeds
    // Categories gain `subs: []`; the legacy `essential` field is dropped (it
    // moved to sub-categories). Transactions keep subcat undefined (= null).
    const categories: Category[] = (base.categories ?? []).map((c: any) => ({
      id: c.id, name: c.name, hue: c.hue, subs: c.subs ?? [],
    }));
    return { ...base, v: 4, categories } as StoredStateV4;
  } catch {
    return null; // corrupt or disabled storage
  }
}

export function save(state: StoredStateV4): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or disabled storage — stay in-memory */
  }
}
