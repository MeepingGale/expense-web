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
    // Migrate up to v4. v1/v2 also drop their legacy seeded sample data (kept
    // settings/categories/budget/currency); v3 user data is preserved as-is.
    let base: Record<string, any> | null = null;
    if (parsed.v === 4 || parsed.v === 3) base = parsed;
    else if (parsed.v === 2) base = { ...parsed, txByMonth: {}, recurring: [] };
    else if (parsed.v === 1) base = { ...parsed, settings: { ...DEFAULT_SETTINGS }, txByMonth: {}, recurring: [] };
    else return null; // unknown version -> caller reseeds
    if (parsed.v !== 4) {
      // One-time safety net: keep the pre-migration blob so a bad migration or
      // a rollback to an older build can't silently destroy data.
      try { localStorage.setItem(`${STORAGE_KEY}-backup-v${parsed.v}`, raw); } catch { /* best effort */ }
    }
    // Light shape guards — a hand-edited or truncated blob degrades to empty
    // collections instead of crashing at render time. Categories gain
    // `subs: []`; the legacy `essential` field is dropped (moved to subs).
    const categories: Category[] = (Array.isArray(base.categories) ? base.categories : []).map((c: any) => ({
      id: c.id, name: c.name, hue: c.hue, subs: Array.isArray(c.subs) ? c.subs : [],
    }));
    return {
      ...base,
      v: 4,
      categories,
      txByMonth: base.txByMonth && typeof base.txByMonth === "object" && !Array.isArray(base.txByMonth) ? base.txByMonth : {},
      recurring: Array.isArray(base.recurring) ? base.recurring : [],
      catBudgets: base.catBudgets && typeof base.catBudgets === "object" && !Array.isArray(base.catBudgets) ? base.catBudgets : {},
    } as StoredStateV4;
  } catch {
    return null; // corrupt or disabled storage
  }
}

// Returns false on quota / disabled storage so the caller can warn the user —
// a finance tracker must never lose data silently.
export function save(state: StoredStateV4): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
