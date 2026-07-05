/* CSV import for Bulk add. Understands two shapes:
   1. this app's own export  — header: Date,Merchant,Category,Sub-category,Amount,Type,Recurring
   2. positional bank-style  — date, amount, category, merchant…, [type]
   Quote-aware; strips the UTF-8 BOM and the leading-apostrophe formula guard
   that our exporter adds, so export → import round-trips cleanly. */

export interface ImportedRow {
  date: string;
  amount: string;
  catName: string;
  subName: string;
  merchant: string;
  need: boolean | null; // null = caller decides the default
}

const NEED_WORDS = ["need", "needs", "necessity", "essential"];
const WANT_WORDS = ["want", "wants", "discretionary", "optional"];

export function parseCSV(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 1; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

// undo the CSV-injection guard our exporter applies
const unguard = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

export function csvToImportRows(text: string): ImportedRow[] {
  const cells = parseCSV(text).map((r) => r.map((c) => unguard(c.trim())));
  if (!cells.length) return [];
  const head = cells[0].map((c) => c.toLowerCase());
  const hasHeader = head.includes("date") && (head.includes("amount") || head.includes("merchant"));
  const body = hasHeader ? cells.slice(1) : cells;
  const col = (name: string) => head.indexOf(name);
  const out: ImportedRow[] = [];
  body.forEach((r) => {
    let date = "", amount = "", catName = "", subName = "", merchant = "", typeStr = "";
    if (hasHeader) {
      date = r[col("date")] ?? "";
      merchant = col("merchant") >= 0 ? r[col("merchant")] ?? "" : "";
      catName = col("category") >= 0 ? r[col("category")] ?? "" : "";
      subName = col("sub-category") >= 0 ? r[col("sub-category")] ?? "" : "";
      amount = col("amount") >= 0 ? r[col("amount")] ?? "" : "";
      typeStr = col("type") >= 0 ? r[col("type")] ?? "" : "";
    } else {
      const parts = [...r];
      date = (parts.shift() ?? "").trim();
      amount = (parts.shift() ?? "").trim();
      catName = (parts.shift() ?? "").trim();
      const last = (parts[parts.length - 1] ?? "").trim().toLowerCase();
      if (NEED_WORDS.includes(last) || WANT_WORDS.includes(last)) typeStr = parts.pop()!.trim();
      merchant = parts.join(", ").trim();
    }
    const type = typeStr.toLowerCase();
    out.push({
      date, amount, catName, subName, merchant,
      need: NEED_WORDS.includes(type) ? true : WANT_WORDS.includes(type) ? false : null,
    });
  });
  return out;
}
