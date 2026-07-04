import React, { useState, useEffect, useRef } from "react";
import type { Category, CategoryId, Transaction, Settings, Attachment, AddExpensePayload } from "../types";
import { THEMES } from "../data/constants";
import { catColor, fmtUSD, toDateInput, parseDateInput, ordinal, pad2, currencySymbol, groupDigits } from "../data/format";

// ---- Prop interfaces ----

interface DeltaProps { value: number | null | undefined; }
interface KpiCardProps { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: number; children?: React.ReactNode; }
interface PaperclipProps { size?: number; }
interface ThemeMenuProps { theme: Settings["theme"]; onChange: (theme: Settings["theme"]) => void; }
interface TxDetailProps {
  tx: Transaction | null;
  catById: Record<CategoryId, Category>;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}
interface AddExpenseProps {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: AddExpensePayload) => void;
  editTx: Transaction | null;
  defaultDate: string; minDate: string; maxDate: string;
  categories: Category[];
  catById: Record<CategoryId, Category>;
}

// ---- Components ----

export function Delta({ value }: DeltaProps) {
  if (value == null || !isFinite(value)) return null;
  const up = value > 0;
  const flat = Math.abs(value) < 0.5;
  return (
    <span className={"delta " + (flat ? "flat" : up ? "up" : "down")}>
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        {flat ? <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          : up ? <path d="M6 2.5 10 8H2z" fill="currentColor" />
               : <path d="M6 9.5 2 4h8z" fill="currentColor" />}
      </svg>
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

export function KpiCard({ label, value, sub, delta, children }: KpiCardProps) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {delta !== undefined && <Delta value={delta} />}
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

export function Paperclip({ size = 13 }: PaperclipProps) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.5 5.5l-5 5a1.8 1.8 0 01-2.5-2.5l5.2-5.2a2.6 2.6 0 013.7 3.7L7.4 11.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function ThemeMenu({ theme, onChange }: ThemeMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="theme-menu">
      <button className="icon-btn theme-btn" onClick={() => setOpen((o) => !o)} aria-label="Change theme" title="Theme">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <path d="M10 2.5a7.5 7.5 0 100 15c.9 0 1.4-.7 1.4-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.7.6-1.3 1.3-1.3H13.5A4 4 0 0017.5 7.8C17.5 4.8 14.1 2.5 10 2.5z" stroke="currentColor" strokeWidth="1.4"/>
          <circle cx="6.8" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="6" r="1" fill="currentColor"/><circle cx="13.2" cy="8" r="1" fill="currentColor"/>
        </svg>
      </button>
      {open && (
        <>
          <div className="theme-pop-scrim" onClick={() => setOpen(false)} />
          <div className="theme-pop">
            <div className="theme-pop-title">Theme</div>
            {THEMES.map((th) => (
              <button key={th.id} className={"theme-opt" + (th.id === theme ? " sel" : "")}
                onClick={() => { onChange(th.id as Settings["theme"]); setOpen(false); }}>
                <span className="theme-sw" style={{ background: th.bg }}>
                  <span className="theme-sw-card" style={{ background: th.card }} />
                  <span className="theme-sw-bar" style={{ background: th.text }} />
                </span>
                <span className="theme-opt-name">{th.name}</span>
                {th.id === theme && (
                  <svg className="theme-check" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TxDetail({ tx, catById, onClose, onEdit, onDelete }: TxDetailProps) {
  const [confirmDel, setConfirmDel] = useState<boolean>(false);
  React.useEffect(() => { setConfirmDel(false); }, [tx]);
  if (!tx) return null;
  const c = catById[tx.cat] || { name: "Uncategorized", hue: 256 };
  const sub = tx.subcat ? catById[tx.cat]?.subs.find((s) => s.id === tx.subcat) : undefined;
  const atts: Attachment[] = tx.attachments || [];
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal td-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="td-title">
            <span className="td-cat-dot" style={{ background: catColor(c.hue) }} />
            <div>
              <h3>{tx.merchant}</h3>
              <p className="td-sub">{c.name}</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="td-amount-block">
          <span className="td-amount">{fmtUSD(tx.amount, true)}</span>
          <span className={"need-pill " + (tx.need ? "is-need" : "is-want")}>{tx.need ? "Necessity" : "Discretionary"}</span>
        </div>

        <div className="td-meta">
          <div className="td-meta-row"><span>Date</span><b>{tx.dateText}{tx.weekday ? ` · ${tx.weekday}` : ""}</b></div>
          <div className="td-meta-row"><span>Category</span><b className="td-meta-cat"><i style={{ background: catColor(c.hue) }} />{c.name}</b></div>
          {sub && <div className="td-meta-row"><span>Sub-category</span><b className="td-meta-cat"><i style={{ background: catColor(sub.hue) }} />{sub.name}</b></div>}
          <div className="td-meta-row"><span>Type</span><b>{tx.need ? "Necessity" : "Discretionary"}</b></div>
          {tx.recurId && <div className="td-meta-row"><span>Recurring</span><b className="td-recur">↻ Monthly</b></div>}
        </div>

        <div className="td-att">
          <span className="td-att-label">Attachments {atts.length > 0 && <em>({atts.length})</em>}</span>
          {atts.length > 0 ? (
            <div className="att-grid">
              {atts.map((a, i) => {
                const isImage = a.type && a.type.startsWith("image/");
                const isPdf = a.type === "application/pdf" || (!!a.name && a.name.toLowerCase().endsWith(".pdf"));
                if (isImage) return (
                  <a key={i} className="att-item" href={a.url} target="_blank" rel="noopener">
                    <img src={a.url} alt={a.name} />
                    <span className="att-name">{a.name}</span>
                  </a>
                );
                if (isPdf) return (
                  <div key={i} className="att-item att-pdf">
                    <embed src={a.url} type="application/pdf" title={a.name} />
                    <span className="att-name">{a.name}</span>
                  </div>
                );
                return (
                  <a key={i} className="att-item att-file" href={a.url} download={a.name}>
                    <div className="att-fileicon"><Paperclip size={22} /></div>
                    <span className="att-name">{a.name}</span>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="td-att-empty"><Paperclip size={18} /><span>No attachments on this expense</span></div>
          )}
        </div>

        {confirmDel ? (
          <div className="td-actions td-confirm">
            <span className="td-confirm-q">Delete this expense?</span>
            <div className="td-actions-btns">
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
              <button type="button" className="btn danger" onClick={() => onDelete(tx)}>Delete</button>
            </div>
          </div>
        ) : (
          <div className="td-actions">
            <button type="button" className="btn ghost td-del" onClick={() => setConfirmDel(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Delete
            </button>
            <button type="button" className="btn primary" onClick={() => onEdit(tx)}>Edit</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Attachments live inside the single localStorage blob (~5MB quota, base64
// inflates by a third) — cap each file so a few receipts can't blow the quota
// and silently stop all saves.
const MAX_ATTACHMENT_BYTES = 600 * 1024;

export function AddExpense({ open, onClose, onAdd, editTx, defaultDate, minDate, maxDate, categories, catById }: AddExpenseProps) {
  const seedDate = editTx ? `${editTx.year ?? 0}-${pad2((editTx.month ?? 0) + 1)}-${pad2(editTx.day)}` : defaultDate;
  const [amount, setAmount] = useState<string>("");
  const [cat, setCat] = useState<string>(categories[0] ? categories[0].id : "");
  const [subcat, setSubcat] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [date, setDate] = useState<string>(seedDate);
  const [need, setNeed] = useState<boolean>(true);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileErr, setFileErr] = useState<string>("");
  const [recurring, setRecurring] = useState<boolean>(false);
  const [ongoing, setOngoing] = useState<boolean>(true);
  const [until, setUntil] = useState<string>("");
  const amtRef = useRef<HTMLInputElement>(null);
  const minStr = minDate, maxStr = maxDate;
  const untilMin = date.slice(0, 7);
  const maxYear = parseInt(maxDate.slice(0, 4), 10);
  const untilMax = `${maxYear + 10}-12`;

  useEffect(() => {
    if (open) {
      if (editTx) {
        setAmount(String(Math.round(editTx.amount * 100) / 100)); setCat(editTx.cat); setSubcat(editTx.subcat ?? ""); setMerchant(editTx.merchant);
        setDate(`${editTx.year ?? 0}-${pad2((editTx.month ?? 0) + 1)}-${pad2(editTx.day)}`);
        setNeed(editTx.need); setFiles(editTx.attachments || []);
      } else {
        const first = categories[0] ? categories[0].id : "";
        setAmount(""); setCat(first); setSubcat(""); setMerchant(""); setDate(defaultDate);
        setNeed(true); setFiles([]);
      }
      setRecurring(false); setOngoing(true); setUntil(""); setFileErr("");
      setTimeout(() => amtRef.current && amtRef.current.focus(), 60);
    }
  }, [open]);

  if (!open) return null;
  const dateOk = date >= minStr && date <= maxStr;
  const valid = parseFloat(amount) > 0 && dateOk && (!recurring || ongoing || until);

  const subs = catById[cat]?.subs ?? [];
  const selectCat = (id: string) => { setCat(id); setSubcat(""); setNeed(true); };
  const selectSub = (id: string) => {
    setSubcat(id);
    const s = (catById[cat]?.subs ?? []).find((x) => x.id === id);
    if (s) setNeed(s.essential);
  };

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files || [])];
    const tooBig = list.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    setFileErr(tooBig.length
      ? `${tooBig.map((f) => `“${f.name}”`).join(", ")} skipped — attachments are kept in browser storage, so each file must stay under 600 KB.`
      : "");
    list.filter((f) => f.size <= MAX_ATTACHMENT_BYTES).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, url: reader.result as string }]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, j) => j !== i));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const { year, month, day } = parseDateInput(date);
    onAdd({
      year, month, day, cat, subcat: subcat || null,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      merchant: merchant.trim() || catById[cat].name,
      need, attachments: files,
      recurring: recurring ? { endKey: ongoing ? null : until } : null,
      _editId: editTx ? editTx.id : null,
      _editKey: editTx ? editTx.monthKey ?? null : null,
      recurId: editTx ? editTx.recurId : null,
    });
    onClose();
  };
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <form className="modal modal-tall" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>{editTx ? "Edit expense" : "Add expense"}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <label className="field amount-field">
          <span>Amount</span>
          <div className="amount-input">
            <span className="dollar">{currencySymbol()}</span>
            <input ref={amtRef} inputMode="decimal" value={groupDigits(amount)} placeholder="0.00"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        </label>
        <label className="field">
          <span>Category</span>
          <div className="cat-grid">
            {categories.map((c) => (
              <button type="button" key={c.id} className={"cat-chip" + (cat === c.id ? " sel" : "")}
                onClick={() => selectCat(c.id)}>
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
        <div className="field-row">
          <label className="field">
            <span>Merchant</span>
            <input value={merchant} placeholder="Optional" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMerchant(e.target.value)} />
          </label>
          <label className="field date-field">
            <span>Date</span>
            <input type="date" value={date} min={minStr} max={maxStr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>Type</span>
          <div className="need-toggle">
            <button type="button" className={need ? "on" : ""} onClick={() => setNeed(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Necessity
            </button>
            <button type="button" className={!need ? "on" : ""} onClick={() => setNeed(false)}>
              Discretionary
            </button>
          </div>
        </div>
        {!editTx && (
        <div className="field">
          <span>Repeat</span>
          <div className="need-toggle">
            <button type="button" className={!recurring ? "on" : ""} onClick={() => setRecurring(false)}>One-time</button>
            <button type="button" className={recurring ? "on" : ""} onClick={() => setRecurring(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 018.5-3.5L13 6M13 8a5 5 0 01-8.5 3.5L3 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 3v3h-3M3 13v-3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Monthly
            </button>
          </div>
          {recurring && (
            <div className="ends-control">
              <span className="ends-label">Ends</span>
              <div className="need-toggle">
                <button type="button" className={ongoing ? "on" : ""} onClick={() => setOngoing(true)}>Ongoing</button>
                <button type="button" className={!ongoing ? "on" : ""} onClick={() => setOngoing(false)}>Until a date</button>
              </div>
              {!ongoing && (
                <input className="ends-month" type="month" value={until} min={untilMin} max={untilMax}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUntil(e.target.value)} />
              )}
            </div>
          )}
        </div>
        )}
        <div className="field">
          <span>Attachments</span>
          <label className="att-drop">
            <Paperclip size={15} />
            <span>Add receipts or files</span>
            <input type="file" multiple accept="image/*,.pdf" onChange={onFiles} hidden />
          </label>
          {fileErr && <p className="field-hint att-err">{fileErr}</p>}
          {files.length > 0 && (
            <div className="att-thumbs">
              {files.map((f, i) => (
                <div key={i} className="att-thumb">
                  {f.type && f.type.startsWith("image/")
                    ? <img src={f.url} alt={f.name} />
                    : <div className="att-thumb-file"><Paperclip size={16} /></div>}
                  <button type="button" className="att-thumb-x" onClick={() => removeFile(i)} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!valid}>{editTx ? "Save changes" : "Add expense"}</button>
        </div>
      </form>
    </div>
  );
}
