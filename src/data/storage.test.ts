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
