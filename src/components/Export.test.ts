import { describe, it, expect } from "vitest";
import { buildCSV } from "./Export";
import type { Category, CategoryId, MonthData } from "../types";

const cats: Category[] = [
  { id: "dining", name: "Dining", hue: 22, subs: [{ id: "coffee", name: "Coffee", hue: 48, essential: false }] },
];
const catById = Object.fromEntries(cats.map((c) => [c.id, c])) as Record<CategoryId, Category>;

const month = {
  key: "2026-07", year: 2026, month: 6,
  transactions: [
    { id: "a", day: 2, cat: "dining", subcat: "coffee", amount: 4.5, merchant: "Café Réunion", need: false, recurId: null },
    { id: "b", day: 3, cat: "dining", subcat: null, amount: 10, merchant: "=HYPERLINK(\"http://evil\",\"x\")", need: false, recurId: null },
    { id: "c", day: 4, cat: "dining", subcat: null, amount: 7, merchant: "+SUM(1)", need: true, recurId: "r1" },
  ],
} as unknown as MonthData;

describe("buildCSV", () => {
  const csv = buildCSV([month], catById);
  const lines = csv.split("\n");

  it("starts with a UTF-8 BOM and the header includes Sub-category", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toContain('"Sub-category"');
  });

  it("resolves sub-category names", () => {
    expect(lines[1]).toContain('"Coffee"');
    expect(lines[1]).toContain('"Café Réunion"');
  });

  it("neutralizes spreadsheet formula cells (CSV injection)", () => {
    // formula-leading cells are prefixed with an apostrophe inside the quotes
    expect(lines[2]).toContain('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(lines[3]).toContain("\"'+SUM(1)\"");
    // and no cell in the body starts a formula bare
    for (const line of lines.slice(1)) {
      for (const cell of line.split('","')) {
        expect(/^["]?[=+@]/.test(cell.replace(/^"/, ""))).toBe(false);
      }
    }
  });

  it("keeps dates and amounts unguarded (they never start with formula chars)", () => {
    expect(lines[1]).toContain('"2026-07-02"');
    expect(lines[1]).toContain('"4.50"');
  });
});
