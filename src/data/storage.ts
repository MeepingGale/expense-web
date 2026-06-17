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
    return null; // unknown version -> caller reseeds
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
