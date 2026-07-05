import { describe, it, expect } from "vitest";
import { parseCSV, csvToImportRows } from "./importCsv";
import { buildCSV } from "../components/Export";
import type { Category, CategoryId, MonthData } from "../types";

describe("parseCSV", () => {
  it("handles quoted cells with commas and escaped quotes", () => {
    expect(parseCSV('"a,b",c\n"say ""hi""",d')).toEqual([["a,b", "c"], ['say "hi"', "d"]]);
  });
  it("strips the BOM and skips blank lines", () => {
    expect(parseCSV("﻿a,b\n\n\nc,d\n")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("csvToImportRows", () => {
  it("round-trips this app's own export (header mapping, guard stripped, sub kept)", () => {
    const cats: Category[] = [
      { id: "dining", name: "Dining", hue: 22, subs: [{ id: "coffee", name: "Coffee", hue: 48, essential: false }] },
    ];
    const catById = Object.fromEntries(cats.map((c) => [c.id, c])) as Record<CategoryId, Category>;
    const month = {
      key: "2026-07", year: 2026, month: 6,
      transactions: [
        { id: "a", day: 2, cat: "dining", subcat: "coffee", amount: 4.5, merchant: "Café, Réunion", need: false, recurId: null },
        { id: "b", day: 3, cat: "dining", subcat: null, amount: 10, merchant: "=SUM(1)", need: true, recurId: null },
      ],
    } as unknown as MonthData;

    const rows = csvToImportRows(buildCSV([month], catById));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-07-02", amount: "4.50", catName: "Dining", subName: "Coffee",
      merchant: "Café, Réunion", need: false,
    });
    expect(rows[1].merchant).toBe("=SUM(1)"); // formula guard removed on the way back in
    expect(rows[1].need).toBe(true);
  });

  it("parses positional bank-style rows (date, amount, category, merchant…, type)", () => {
    const rows = csvToImportRows("2026-03-14, 52.40, Groceries, Whole, Foods, need\n2026-02-09,24,Fun,Cinema,want");
    expect(rows[0]).toMatchObject({ date: "2026-03-14", amount: "52.40", catName: "Groceries", merchant: "Whole, Foods", need: true });
    expect(rows[1]).toMatchObject({ merchant: "Cinema", need: false });
  });
});
