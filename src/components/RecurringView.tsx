/* Recurring expenses: add new, edit amount, stop / resume, set an end date. */
import React, { useState, useEffect, useRef } from "react";
import { catColor, fmtUSD, currencySymbol, groupDigits, pad2, ordinal } from "../data/format";
import { MONTHS } from "../data/constants";
import { useModalKeys, AmountInput } from "./common";
import type { Category, CategoryId, RecurringItem } from "../types";

function fmtEndKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

// Payload App's addRecurring expects: it assigns `id` + `active` itself.
type NewRecurring = Omit<RecurringItem, "id" | "active">;

interface RecurringRowProps {
  item: RecurringItem;
  catById: Record<CategoryId, Category>;
  onEditAmount: (id: string, amount: number) => void;
  onToggle: (id: string) => void;
}

interface RecurringViewProps {
  recurring: RecurringItem[];
  catById: Record<CategoryId, Category>;
  today: Date;
  onEditAmount: (id: string, amount: number) => void;
  onToggle: (id: string) => void;
  onAddClick: () => void;
}

interface AddRecurringProps {
  open: boolean;
  today: Date;
  onClose: () => void;
  onAdd: (item: NewRecurring) => void;
  categories: Category[];
  catById: Record<CategoryId, Category>;
}

export function RecurringRow({ item, catById, onEditAmount, onToggle }: RecurringRowProps) {
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(String(item.amount));
  const c = catById[item.cat] || { name: "Uncategorized", hue: 256 };
  const sub = item.subcat ? catById[item.cat]?.subs.find((s) => s.id === item.subcat) : undefined;

  const startEdit = () => { setDraft(String(item.amount)); setEditing(true); };
  const save = () => {
    const v = Math.round(parseFloat(draft) * 100) / 100;
    if (v > 0) onEditAmount(item.id, v);
    setEditing(false);
  };
  const end = fmtEndKey(item.endKey);

  return (
    <div className={"rec-row" + (item.active ? "" : " stopped")}>
      <span className="rec-dot" style={{ background: catColor(c.hue) }} />
      <div className="rec-main">
        <span className="rec-merchant">{item.merchant}
          <span className={"need-tag " + (item.need ? "is-need" : "is-want")}>{item.need ? "Need" : "Want"}</span>
        </span>
        <span className="rec-meta">{c.name}{sub ? ` · ${sub.name}` : ""} · Monthly on the {ordinal(item.day)} · {end ? `until ${end}` : "ongoing"}</span>
      </div>

      {item.active
        ? <span className="rec-status active">Active</span>
        : <span className="rec-status">Stopped</span>}

      <div className="rec-amount">
        {editing ? (
          <div className="rec-edit">
            <AmountInput className="rec-edit-input" autoFocus value={draft} onValue={setDraft}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
            <button className="rec-icon save" onClick={save} aria-label="Save">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        ) : (
          <button className="rec-amt-btn" onClick={startEdit} disabled={!item.active} title="Edit amount">
            <span className="rec-amt-val">{fmtUSD(item.amount, true)}</span>
            <span className="rec-amt-per">/mo</span>
          </button>
        )}
      </div>

      <button className={"rec-toggle" + (item.active ? "" : " is-resume")} onClick={() => onToggle(item.id)}>
        {item.active ? "Stop" : "Resume"}
      </button>
    </div>
  );
}

export function RecurringView({ recurring, catById, today, onEditAmount, onToggle, onAddClick }: RecurringViewProps) {
  const active = recurring.filter((r) => r.active);
  const monthlyTotal = active.reduce((s, r) => s + r.amount, 0);
  const needTotal = active.filter((r) => r.need).reduce((s, r) => s + r.amount, 0);

  // forecast: next 3 months of committed recurring (respecting end dates)
  const forecast: { label: string; total: number; count: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const due = active.filter((r) => !r.endKey || r.endKey >= key);
    forecast.push({ label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`, total: due.reduce((s, r) => s + r.amount, 0), count: due.length });
  }
  const fcMax = Math.max(1, ...forecast.map((f) => f.total));

  return (
    <div className="recv">
      <div className="recv-head">
        <div>
          <h1>Recurring</h1>
          <p className="txv-sub">
            <b>{active.length}</b> active · <b>{fmtUSD(monthlyTotal)}</b>/mo committed
            {monthlyTotal > 0 && <> · {Math.round((needTotal / monthlyTotal) * 100)}% essential</>}
          </p>
        </div>
        <div className="recv-head-right">
          <div className="recv-total card">
            <span className="recv-total-label">Committed monthly</span>
            <span className="recv-total-val">{fmtUSD(monthlyTotal)}</span>
            <span className="recv-total-sub">{fmtUSD(monthlyTotal * 12)} / year</span>
          </div>
          <button className="btn primary add-btn" onClick={onAddClick}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add recurring
          </button>
        </div>
      </div>

      <section className="card recv-forecast">
        <div className="fc-head">
          <h2>Forecast</h2>
          <span className="fc-sub">Committed recurring charges for the next 3 months</span>
        </div>
        <div className="fc-grid">
          {forecast.map((f) => (
            <div key={f.label} className="fc-card">
              <span className="fc-month">{f.label}</span>
              <span className="fc-amt">{fmtUSD(f.total)}</span>
              <div className="fc-bar"><span style={{ width: (f.total / fcMax) * 100 + "%" }} /></div>
              <span className="fc-count">{f.count} charge{f.count !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="card recv-list">
        <div className="recv-note">Changing an amount applies to this month onward — past months keep what you actually paid. Stopping cancels future charges.</div>
        {recurring.map((item) => (
          <RecurringRow key={item.id} item={item} catById={catById} onEditAmount={onEditAmount} onToggle={onToggle} />
        ))}
        {recurring.length === 0 && <div className="tx-empty">No recurring expenses yet. Add one to track subscriptions, rent, and bills.</div>}
      </div>
    </div>
  );
}

export function AddRecurring({ open, today, onClose, onAdd, categories, catById }: AddRecurringProps) {
  const first = categories[0] ? categories[0].id : "";
  const minMonth = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  const maxMonth = `${today.getFullYear() + 10}-12`;
  const [merchant, setMerchant] = useState<string>("");
  const [cat, setCat] = useState<CategoryId>(first);
  const [subcat, setSubcat] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [day, setDay] = useState<number | string>(1);
  const [need, setNeed] = useState<boolean>(true);
  const [ongoing, setOngoing] = useState<boolean>(true);
  const [until, setUntil] = useState<string>("");
  const merchRef = React.useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLFormElement>(null);
  useModalKeys(open, onClose, modalRef);

  useEffect(() => {
    if (open) {
      setMerchant(""); setCat(first); setSubcat(""); setAmount(""); setDay(1);
      setNeed(true);
      setOngoing(true); setUntil("");
      setTimeout(() => merchRef.current && merchRef.current.focus(), 60);
    }
  }, [open]);

  if (!open) return null;
  const subs = catById[cat]?.subs ?? [];
  const selectCat = (id: CategoryId) => { setCat(id); setSubcat(""); setNeed(true); };
  const selectSub = (id: string) => {
    setSubcat(id);
    const s = subs.find((x) => x.id === id);
    if (s) setNeed(s.essential);
  };
  const valid = parseFloat(amount) > 0 && merchant.trim() && (ongoing || until);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      merchant: merchant.trim(),
      cat,
      subcat: subcat || null,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      day: Math.min(31, Math.max(1, parseInt(String(day), 10) || 1)),
      need,
      endKey: ongoing ? null : until,
    });
    onClose();
  };

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <form className="modal modal-tall" ref={modalRef} onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h3>Add recurring expense</h3>
            <p className="td-sub">Charged automatically every month.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Merchant</span>
            <input ref={merchRef} value={merchant} placeholder="e.g. Gym, Insurance" onChange={(e) => setMerchant(e.target.value)} />
          </label>
          <label className="field amount-field">
            <span>Amount</span>
            <AmountInput value={amount} onValue={setAmount} placeholder="0.00" />
          </label>
        </div>

        <label className="field">
          <span>Category</span>
          <div className="cat-grid">
            {categories.map((c) => (
              <button type="button" key={c.id} className={"cat-chip" + (cat === c.id ? " sel" : "")} onClick={() => selectCat(c.id)}>
                <i style={{ background: catColor(c.hue) }} />{c.name}
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Sub-category</span>
          <div className="txv-select-wrap">
            <select value={subcat} onChange={(e) => selectSub(e.target.value)} disabled={subs.length === 0}>
              {subs.length === 0
                ? <option value="">No sub-categories yet — add them in Categories</option>
                : <option value="">— None —</option>}
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </label>

        <div className="field-row fr-day">
          <label className="field day-field">
            <span>Charges on day</span>
            <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <div className="field">
            <span>Type</span>
            <div className="need-toggle">
              <button type="button" className={need ? "on" : ""} onClick={() => setNeed(true)}>Necessity</button>
              <button type="button" className={!need ? "on" : ""} onClick={() => setNeed(false)}>Discretionary</button>
            </div>
          </div>
        </div>

        <div className="field">
          <span>Ends</span>
          <div className="ends-control">
            <div className="need-toggle">
              <button type="button" className={ongoing ? "on" : ""} onClick={() => setOngoing(true)}>Ongoing</button>
              <button type="button" className={!ongoing ? "on" : ""} onClick={() => setOngoing(false)}>Until a date</button>
            </div>
            {!ongoing && (
              <input className="ends-month" type="month" value={until} min={minMonth} max={maxMonth}
                onChange={(e) => setUntil(e.target.value)} />
            )}
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!valid}>Add recurring</button>
        </div>
      </form>
    </div>
  );
}
