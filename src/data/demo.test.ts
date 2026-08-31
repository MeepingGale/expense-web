import { describe, it, expect, beforeEach } from "vitest";
import { buildDemoState } from "./demo";
import { load, STORAGE_KEY } from "./storage";
import { buildSeed, postDueRecurring, recompute } from "./seed";

const TODAY = new Date(2026, 7, 20); // Aug 20, 2026 — partial month

beforeEach(() => localStorage.clear());

describe("buildDemoState", () => {
  it("is deterministic for a fixed date", () => {
    expect(JSON.stringify(buildDemoState(TODAY))).toBe(JSON.stringify(buildDemoState(TODAY)));
  });

  it("fills every scaffold month with valid transactions", () => {
    const state = buildDemoState(TODAY);
    const months = buildSeed(TODAY).months;
    expect(Object.keys(state.txByMonth).sort()).toEqual(months.map((m) => m.key).sort());
    const catIds = new Set(state.categories.map((c) => c.id));
    months.forEach((m) => {
      const lastDay = m.isCurrent ? TODAY.getDate() : m.daysInMonth;
      const tx = state.txByMonth[m.key];
      expect(tx.length).toBeGreaterThan(10);
      tx.forEach((t) => {
        expect(t.amount).toBeGreaterThan(0);
        expect(t.day).toBeGreaterThanOrEqual(1);
        expect(t.day).toBeLessThanOrEqual(lastDay);
        expect(catIds.has(t.cat)).toBe(true);
        expect(t.merchant.length).toBeGreaterThan(0);
      });
    });
  });

  it("survives the storage load path unchanged", () => {
    const state = buildDemoState(TODAY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded!.currency).toBe("MYR");
    expect(Object.keys(loaded!.txByMonth)).toEqual(Object.keys(state.txByMonth));
  });

  it("does not double-post recurring charges on boot", () => {
    const state = buildDemoState(TODAY);
    const seed = buildSeed(TODAY);
    const months = seed.months.map((m) =>
      recompute({ ...m, transactions: state.txByMonth[m.key] ?? [] }, state.categories));
    const after = postDueRecurring(months, state.recurring, state.categories);
    after.forEach((m) => {
      state.recurring.forEach((r) => {
        const posted = m.transactions.filter((t) => t.recurId === r.id);
        expect(posted.length).toBeLessThanOrEqual(1);
      });
    });
  });

  it("spends in the neighborhood of the demo budget", () => {
    const state = buildDemoState(TODAY);
    const full = Object.entries(state.txByMonth)
      .filter(([k]) => k !== "2026-08") // skip the partial month
      .map(([, tx]) => tx.reduce((s, t) => s + t.amount, 0));
    full.forEach((total) => {
      expect(total).toBeGreaterThan(2500);
      expect(total).toBeLessThan(5200);
    });
  });
});
