import type { Settings, StoredStateV1, StoredStateV2, StoredStateV3 } from "../types";

// Historical key name; the stored `v` field is the real version marker.
export const STORAGE_KEY = "ledger-state-v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "#4f8ff7",
  trendMode: "bars",
  density: "comfortable",
  budgetLine: true,
};

export function load(): StoredStateV3 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number } & Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v === 3) return parsed as unknown as StoredStateV3;
    // v1/v2 predate the empty-ledger change and still carry the old seeded
    // sample data. Migrate once: keep the user's settings, categories, budget
    // and currency, but drop the demo transactions + recurring so the ledger
    // starts clean. The next save() rewrites the blob as v3, so this clear runs
    // at most once and never touches transactions the user adds afterwards.
    if (parsed.v === 2) {
      const v2 = parsed as unknown as StoredStateV2;
      return { ...v2, v: 3, txByMonth: {}, recurring: [] };
    }
    if (parsed.v === 1) {
      const v1 = parsed as unknown as StoredStateV1;
      return { ...v1, v: 3, settings: { ...DEFAULT_SETTINGS }, txByMonth: {}, recurring: [] };
    }
    return null; // unknown version -> caller reseeds
  } catch {
    return null; // corrupt or disabled storage
  }
}

export function save(state: StoredStateV3): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or disabled storage — stay in-memory */
  }
}
