import { describe, it, expect, beforeEach } from "vitest";
import { load, save, STORAGE_KEY, DEFAULT_SETTINGS } from "./storage";
import type { StoredStateV4 } from "../types";

const v4: StoredStateV4 = {
  v: 4, txByMonth: { "2026-06": [] }, categories: [], recurring: [],
  budget: 3800, currency: "USD", settings: DEFAULT_SETTINGS,
};

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing stored", () => {
    expect(load()).toBeNull();
  });

  it("round-trips a v4 state", () => {
    save(v4);
    expect(load()).toEqual(v4);
  });

  it("migrates a v3 blob to v4, preserving user data and adding subs to categories", () => {
    const v3 = {
      v: 3,
      txByMonth: { "2026-06": [{ id: "x", day: 1, cat: "dining", amount: 12, merchant: "Cafe", need: false, recurId: null }] },
      categories: [{ id: "dining", name: "Dining", hue: 22, essential: false }],
      recurring: [], budget: 3800, currency: "EUR",
      settings: { ...DEFAULT_SETTINGS, theme: "sand" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v3));
    const out = load();
    expect(out?.v).toBe(4);
    expect(out?.txByMonth).toEqual(v3.txByMonth);                                    // v3 user data preserved
    expect(out?.categories).toEqual([{ id: "dining", name: "Dining", hue: 22, subs: [] }]); // essential dropped, subs added
    expect(out?.currency).toBe("EUR");
  });

  it("migrates a legacy v2 blob to v4, clearing seeded data but keeping settings", () => {
    const v2 = {
      v: 2,
      txByMonth: { "2026-06": [{ id: "x", day: 1, cat: "dining", amount: 12, merchant: "Cafe", need: false, recurId: null }] },
      categories: [{ id: "dining", name: "Dining", hue: 22, essential: false }],
      recurring: [{ id: "rent", merchant: "Rent", cat: "housing", amount: 1, day: 1, need: true }],
      budget: 3800, currency: "EUR",
      settings: { ...DEFAULT_SETTINGS, theme: "sand" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2));
    const out = load();
    expect(out?.v).toBe(4);
    expect(out?.txByMonth).toEqual({});       // legacy seeded transactions cleared
    expect(out?.recurring).toEqual([]);
    expect(out?.settings.theme).toBe("sand");
    expect(out?.categories).toEqual([{ id: "dining", name: "Dining", hue: 22, subs: [] }]);
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(load()).toBeNull();
  });
});
