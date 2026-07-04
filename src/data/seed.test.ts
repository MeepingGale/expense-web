import { describe, it, expect } from "vitest";
import { buildSeed, recompute, monthScaffold } from "./seed";
import type { Category, MonthData, Transaction } from "../types";

const TODAY = new Date(2026, 5, 23); // fixed reference so assertions stay deterministic

describe("buildSeed", () => {
  it("is deterministic for a given today", () => {
    expect(buildSeed(TODAY)).toEqual(buildSeed(TODAY));
  });
  it("produces 12 months ending the month of `today`", () => {
    const { months } = buildSeed(TODAY);
    expect(months).toHaveLength(12);
    expect(months[11].key).toBe("2026-06");
  });
  it("never scaffolds past today — the current month stops at today's date", () => {
    const { months, today } = buildSeed(TODAY);
    expect(today).toEqual(TODAY);
    const current = months[11];
    expect(current.isCurrent).toBe(true);
    expect(current.lastDay).toBe(23); // June has 30 days, but no future days are generated
    expect(current.isPartial).toBe(true);
  });
  it("starts every month empty — no sample transactions", () => {
    for (const m of buildSeed(TODAY).months) {
      expect(m.transactions).toHaveLength(0);
      expect(m.total).toBe(0);
      // byCat is zero-filled for every category, never undefined
      expect(Object.values(m.byCat).every((v) => v === 0)).toBe(true);
    }
  });
  it("seeds no recurring items", () => {
    expect(buildSeed(TODAY).recurring).toEqual([]);
  });
  it("still provides the default starter categories", () => {
    const ids = buildSeed(TODAY).categories.map((c) => c.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain("groceries");
  });
});

describe("monthScaffold", () => {
  it("spans a year boundary contiguously", () => {
    const months = monthScaffold({ year: 2025, month: 10 }, { year: 2026, month: 1 }, TODAY, []);
    expect(months.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(months.every((m) => m.transactions.length === 0 && m.total === 0)).toBe(true);
  });

  it("marks only today's month current/partial", () => {
    const months = monthScaffold({ year: 2026, month: 4 }, { year: 2026, month: 5 }, TODAY, []);
    expect(months.map((m) => m.isCurrent)).toEqual([false, true]);
    expect(months[1].lastDay).toBe(TODAY.getDate());
    expect(months[1].isPartial).toBe(true);
    expect(months[0].lastDay).toBe(months[0].daysInMonth);
  });
});

describe("recompute", () => {
  const cats: Category[] = [
    { id: "a", name: "A", hue: 1, subs: [] },
    { id: "b", name: "B", hue: 2, subs: [] },
  ];
  const base = (transactions: Transaction[]) =>
    ({
      key: "2026-06", year: 2026, month: 5, label: "June 2026", shortLabel: "Jun",
      daysInMonth: 30, lastDay: 8, isCurrent: true, firstWeekday: 1, isPartial: true,
      transactions,
    }) as Omit<MonthData, "byCat" | "byDay" | "total">;

  it("derives byCat and byDay from exact-decimal amounts", () => {
    const r = recompute(
      base([
        { id: "1", day: 1, cat: "a", amount: 10.5, merchant: "x", need: true, recurId: null },
        { id: "2", day: 1, cat: "b", amount: 5.25, merchant: "y", need: false, recurId: null },
        { id: "3", day: 2, cat: "a", amount: 2.25, merchant: "z", need: true, recurId: null },
      ]),
      cats,
    );
    expect(r.byCat).toEqual({ a: 12.75, b: 5.25 });
    expect(r.byDay).toEqual({ 1: 15.75, 2: 2.25 });
    expect(r.total).toBe(18);
  });

  it("rounds the total to cents and zero-fills unused categories", () => {
    const r = recompute(
      base([
        { id: "1", day: 1, cat: "a", amount: 1.114, merchant: "x", need: true, recurId: null },
        { id: "2", day: 1, cat: "a", amount: 2.223, merchant: "y", need: true, recurId: null },
      ]),
      cats,
    );
    expect(r.total).toBeCloseTo(3.34, 2); // raw 3.337 -> 3.34
    expect(r.byCat.b).toBe(0);
  });
});
