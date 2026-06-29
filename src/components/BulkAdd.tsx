/* Bulk add transactions: paste-to-parse + editable grid, any date up to today. */
import React, { useState, useEffect } from "react";
import { fmtUSD, toDateInput, currencySymbol, groupDigits } from "../data/format";
import type { Category, CategoryId } from "../types";

// Internal editable-row shape (amount is the raw string from the input).
interface BulkEditRow {
  date: string;
  merchant: string;
  cat: CategoryId;
  subcat: string;
  amount: string;
  need: boolean;
}

// Payload App's bulkInsert (routeInsert) expects: it assigns
// `id` / `attachments` / `recurId` / `_new` itself.
interface BulkInsertItem {
  year: number;
  month: number;
  day: number;
  cat: CategoryId;
  subcat: string | null;
  amount: number;
  merchant: string;
  need: boolean;
}

interface BulkAddProps {
  open: boolean;
  onClose: () => void;
  onInsert: (txs: BulkInsertItem[]) => void;
  categories: Category[];
  catById: Record<CategoryId, Category>;
  minDate: string;
  maxDate: string;
}

const _normalizeDate = (s: string): string | null => {
  s = String(s).trim();
  let d: Date | undefined;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) { const [y, m, da] = s.split("-").map(Number); d = new Date(y, m - 1, da); }
  else { const t = new Date(s); if (!isNaN(t.getTime())) d = t; }
  if (!d || isNaN(d.getTime())) return null;
  return toDateInput(d);
};

export function BulkAdd({ open, onClose, onInsert, categories, catById, minDate, maxDate }: BulkAddProps) {
  const minStr = minDate, maxStr = maxDate;
  const firstCat = categories[0] ? categories[0].id : "";
  const blank = (): BulkEditRow => ({ date: maxStr, merchant: "", cat: firstCat, subcat: "", amount: "", need: true });
  const [rows, setRows] = useState<BulkEditRow[]>([]);
  const [paste, setPaste] = useState<string>("");
  const [showPaste, setShowPaste] = useState<boolean>(false);

  useEffect(() => {
    if (open) { setRows([blank(), blank(), blank()]); setPaste(""); setShowPaste(false); }
  }, [open]);

  if (!open) return null;

  const matchCat = (str: string): CategoryId => {
    if (!str) return firstCat;
    const l = str.toLowerCase().trim();
    const hit = categories.find((c) => c.id === l || c.name.toLowerCase() === l) ||
                categories.find((c) => c.name.toLowerCase().includes(l) || l.includes(c.name.toLowerCase()));
    return hit ? hit.id : firstCat;
  };

  const update = (i: number, key: keyof BulkEditRow, val: string | boolean) => setRows((prev) => prev.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [key]: val };
    if (key === "cat") { next.subcat = ""; next.need = true; }
    if (key === "subcat") {
      const s = (catById[next.cat]?.subs ?? []).find((x) => x.id === val);
      if (s) next.need = s.essential;
    }
    return next;
  }));
  const addRow = () => setRows((prev) => [...prev, blank()]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const parsePaste = () => {
    const NEED_WORDS = ["need", "needs", "necessity", "essential"];
    const WANT_WORDS = ["want", "wants", "discretionary", "non-essential", "nonessential"];
    const lines = paste.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: BulkEditRow[] = [];
    lines.forEach((line) => {
      const parts = line.split(/\t|,/).map((s) => s.trim());
      if (parts.length < 2) return;
      const [dStr, amtStr, catStr, ...rest] = parts;
      const amount = parseFloat(String(amtStr).replace(/[^0-9.]/g, ""));
      const date = _normalizeDate(dStr);
      if (!(amount > 0) || !date) return;
      const cat = matchCat(catStr);
      // optional trailing type column (need / want) — anything else stays part of the merchant
      let need: boolean | null = null;
      if (rest.length) {
        const last = rest[rest.length - 1].toLowerCase();
        if (NEED_WORDS.includes(last)) { need = true; rest.pop(); }
        else if (WANT_WORDS.includes(last)) { need = false; rest.pop(); }
      }
      out.push({ date, merchant: rest.join(", ").trim() || catById[cat].name, cat, subcat: "",
        amount: String(amount), need: need != null ? need : true });
    });
    if (out.length) { setRows((prev) => [...prev.filter((r) => r.amount || r.merchant), ...out]); setPaste(""); setShowPaste(false); }
  };

  const rowValid = (r: BulkEditRow) => parseFloat(r.amount) > 0 && r.date >= minStr && r.date <= maxStr && !!catById[r.cat];
  const valid = rows.filter(rowValid);
  const validTotal = valid.reduce((s, r) => s + parseFloat(r.amount), 0);

  const doInsert = () => {
    const items: BulkInsertItem[] = valid.map((r) => {
      const [y, m, d] = r.date.split("-").map(Number);
      return { year: y, month: m - 1, day: d, cat: r.cat, subcat: r.subcat || null, amount: Math.round(parseFloat(r.amount) * 100) / 100,
        merchant: r.merchant.trim() || catById[r.cat].name, need: r.need };
    });
    if (items.length) onInsert(items);
    onClose();
  };

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Bulk add transactions</h3>
            <p className="td-sub">Back-date as many as you like — any date up to today.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="bulk-toolbar">
          <button type="button" className="link-btn" onClick={() => setShowPaste((s) => !s)}>
            {showPaste ? "Hide paste" : "Paste from spreadsheet"}
          </button>
          <span className="bulk-count">{valid.length} of {rows.length} ready · {fmtUSD(validTotal)}</span>
        </div>

        {showPaste && (
          <div className="bulk-paste">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
              placeholder={"One per line:  date, amount, category, merchant, type\n2026-03-14, 52.40, Groceries, Whole Foods, need\n2026-02-02, 1650, Housing, Rent, need\n2026-02-09, 24.00, Entertainment, Cinema, want"} />
            <button type="button" className="btn ghost" onClick={parsePaste} disabled={!paste.trim()}>Parse rows</button>
          </div>
        )}

        <div className="bulk-grid">
          <div className="bulk-row bulk-head">
            <span>Date</span><span>Merchant</span><span>Category</span><span>Sub-category</span><span>Amount</span><span>Type</span><span></span>
          </div>
          <div className="bulk-rows">
            {rows.map((r, i) => {
              const bad = (r.amount || r.merchant) && !rowValid(r);
              return (
                <div key={i} className={"bulk-row" + (bad ? " bad" : "")}>
                  <input type="date" value={r.date} min={minStr} max={maxStr} onChange={(e) => update(i, "date", e.target.value)} />
                  <input value={r.merchant} placeholder="Optional" onChange={(e) => update(i, "merchant", e.target.value)} />
                  <div className="txv-select-wrap">
                    <select value={r.cat} onChange={(e) => update(i, "cat", e.target.value)}>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="txv-select-wrap">
                    <select value={r.subcat} onChange={(e) => update(i, "subcat", e.target.value)}
                      disabled={!(catById[r.cat]?.subs?.length)}>
                      <option value="">{catById[r.cat]?.subs?.length ? "— None —" : "—"}</option>
                      {(catById[r.cat]?.subs ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="bulk-amt">
                    <span>{currencySymbol()}</span>
                    <input inputMode="decimal" value={groupDigits(r.amount)} placeholder="0.00"
                      onChange={(e) => update(i, "amount", e.target.value.replace(/[^0-9.]/g, ""))} />
                  </div>
                  <div className="txv-select-wrap">
                    <select value={r.need ? "need" : "want"} onChange={(e) => update(i, "need", e.target.value === "need")}>
                      <option value="need">Need</option>
                      <option value="want">Want</option>
                    </select>
                  </div>
                  <button type="button" className="bulk-del" onClick={() => removeRow(i)} aria-label="Remove row">✕</button>
                </div>
              );
            })}
          </div>
          <button type="button" className="bulk-addrow" onClick={addRow}>
            <svg width="13" height="13" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add row
          </button>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" onClick={doInsert} disabled={valid.length === 0}>
            Insert {valid.length} transaction{valid.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
