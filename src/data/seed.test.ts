import { describe, it, expect } from "vitest";
import { buildSeed, recompute } from "./seed";
import type { Category, MonthData, Transaction } from "../types";

describe("buildSeed", () => {
  it("is deterministic", () => {
    expect(buildSeed()).toEqual(buildSeed());
  });
  it("produces 12 months ending June 2026", () => {
    const { months } = buildSeed();
    expect(months).toHaveLength(12);
    expect(months[11].key).toBe("2026-06");
  });
  it("starts every month empty — no sample transactions", () => {
    for (const m of buildSeed().months) {
      expect(m.transactions).toHaveLength(0);
      expect(m.total).toBe(0);
      // byCat is zero-filled for every category, never undefined
      expect(Object.values(m.byCat).every((v) => v === 0)).toBe(true);
    }
  });
  it("seeds no recurring items", () => {
    expect(buildSeed().recurring).toEqual([]);
  });
  it("still provides the default starter categories", () => {
    const ids = buildSeed().categories.map((c) => c.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain("groceries");
  });
});

describe("recompute", () => {
  const cats: Category[] = [
    { id: "a", name: "A", hue: 1, essential: true },
    { id: "b", name: "B", hue: 2, essential: false },
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
