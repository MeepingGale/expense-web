/* Bulk add transactions: paste-to-parse + editable grid, any date up to today. */
import React, { useState, useEffect, useRef } from "react";
import { fmtUSD, toDateInput, currencySymbol, groupDigits } from "../data/format";
import { useModalKeys, AmountInput } from "./common";
import { csvToImportRows } from "../data/importCsv";
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
  merchantIndex?: Record<string, { cat: CategoryId; subcat: string | null; need: boolean }>;
}

const _normalizeDate = (s: string): string | null => {
  s = String(s).trim();
  let d: Date | undefined;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) { const [y, m, da] = s.split("-").map(Number); d = new Date(y, m - 1, da); }
  else { const t = new Date(s); if (!isNaN(t.getTime())) d = t; }
  if (!d || isNaN(d.getTime())) return null;
  return toDateInput(d);
};

export function BulkAdd({ open, onClose, onInsert, categories, catById, minDate, maxDate, merchantIndex }: BulkAddProps) {
  const minStr = minDate, maxStr = maxDate;
  const firstCat = categories[0] ? categories[0].id : "";
  const blank = (): BulkEditRow => ({ date: maxStr, merchant: "", cat: firstCat, subcat: "", amount: "", need: true });
  const [rows, setRows] = useState<BulkEditRow[]>([]);
  const [paste, setPaste] = useState<string>("");
  const [showPaste, setShowPaste] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalKeys(open, onClose, modalRef);

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

  // CSV import: understands our own export (header-mapped, incl. sub-category)
  // and positional bank rows — feeds the same editable grid as paste
  const onCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    f.text().then((text) => {
      const out: BulkEditRow[] = [];
      csvToImportRows(text).forEach((r) => {
        const date = _normalizeDate(r.date);
        const amount = parseFloat(String(r.amount).replace(/[^0-9.]/g, ""));
        if (!date || !(amount > 0)) return;
        const cat = matchCat(r.catName);
        const sub = r.subName
          ? (catById[cat]?.subs ?? []).find((s) => s.name.toLowerCase() === r.subName.toLowerCase())?.id ?? ""
          : "";
        out.push({ date, merchant: r.merchant || catById[cat].name, cat, subcat: sub,
          amount: String(amount), need: r.need ?? true });
      });
      if (out.length) setRows((prev) => [...prev.filter((x) => x.amount || x.merchant), ...out]);
    });
  };

  // merchant memory: typing/picking a known merchant prefills the row's
  // category, sub-category, and type from its last use
  const setRowMerchant = (i: number, v: string) => setRows((prev) => prev.map((r, j) => {
    if (j !== i) return r;
    const hit = merchantIndex?.[v.trim().toLowerCase()];
    return hit && catById[hit.cat]
      ? { ...r, merchant: v, cat: hit.cat, subcat: hit.subcat ?? "", need: hit.need }
      : { ...r, merchant: v };
  }));

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
      <div className="modal modal-wide" ref={modalRef} onMouseDown={(e) => e.stopPropagation()}>
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
          <label className="link-btn csv-import">
            Import CSV
            <input type="file" hidden accept=".csv,text/csv" onChange={onCsvFile} />
          </label>
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
                  <input value={r.merchant} placeholder="Optional" list="merchants" onChange={(e) => setRowMerchant(i, e.target.value)} />
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
                  <AmountInput wrapClass="bulk-amt" value={r.amount} onValue={(v) => update(i, "amount", v)} placeholder="0.00" />
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
