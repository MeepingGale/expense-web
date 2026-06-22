import { describe, it, expect, beforeEach } from "vitest";
import { load, save, STORAGE_KEY, DEFAULT_SETTINGS } from "./storage";
import type { StoredStateV1, StoredStateV2, StoredStateV3 } from "../types";

const v3: StoredStateV3 = {
  v: 3, txByMonth: { "2026-06": [] }, categories: [], recurring: [],
  budget: 3800, currency: "USD", settings: DEFAULT_SETTINGS,
};

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing stored", () => {
    expect(load()).toBeNull();
  });

  it("round-trips a v3 state", () => {
    save(v3);
    expect(load()).toEqual(v3);
  });

  it("migrates a v2 blob to v3, clearing seeded data but keeping settings", () => {
    const v2: StoredStateV2 = {
      v: 2,
      txByMonth: {
        "2026-06": [
          { id: "x", day: 1, cat: "dining", amount: 12, merchant: "Cafe", need: false, recurId: null },
        ],
      },
      categories: [{ id: "dining", name: "Dining", hue: 22, essential: false }],
      recurring: [{ id: "rent", merchant: "Rent", cat: "housing", amount: 1, day: 1, need: true }],
      budget: 3800, currency: "EUR",
      settings: { ...DEFAULT_SETTINGS, theme: "sand" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2));
    const out = load();
    expect(out?.v).toBe(3);
    expect(out?.txByMonth).toEqual({});             // seeded transactions cleared
    expect(out?.recurring).toEqual([]);              // seeded recurring cleared
    expect(out?.settings.theme).toBe("sand");        // settings preserved
    expect(out?.currency).toBe("EUR");               // currency preserved
    expect(out?.categories).toEqual(v2.categories);  // categories preserved
  });

  it("migrates a v1 blob to v3 with default settings and no data", () => {
    const v1: StoredStateV1 = {
      v: 1, txByMonth: { "2026-06": [] }, categories: [], recurring: [],
      budget: 3800, currency: "USD",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    const out = load();
    expect(out?.v).toBe(3);
    expect(out?.settings).toEqual(DEFAULT_SETTINGS);
    expect(out?.txByMonth).toEqual({});
    expect(out?.recurring).toEqual([]);
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(load()).toBeNull();
  });
});
