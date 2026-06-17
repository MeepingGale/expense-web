/* Main dashboard app. */
const { useState, useMemo, useEffect, useRef } = React;

const ACCENTS = [
  { id: "blue",   val: "#4f8ff7" },
  { id: "cyan",   val: "#22c5d6" },
  { id: "violet", val: "#8b7cf6" },
  { id: "green",  val: "#34c98a" },
  { id: "amber",  val: "#e8a23d" },
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const THEMES = [
  { id: "dark",   name: "Midnight", bg: "#1c2230", card: "#2a3142", text: "#f5f7fa" },
  { id: "carbon", name: "Carbon",   bg: "#181818", card: "#2b2b2b", text: "#f7f7f7" },
  { id: "light",  name: "Daylight", bg: "#f1f1ee", card: "#ffffff", text: "#2b2f38" },
  { id: "sand",   name: "Sand",     bg: "#ece4d6", card: "#fbf8f2", text: "#3a3026" },
];

function ThemeMenu({ theme, onChange }) {
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
                onClick={() => { onChange(th.id); setOpen(false); }}>
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

const pad2 = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDateInput = (s) => { const [y, m, d] = s.split("-").map(Number); return { year: y, month: m - 1, day: d }; };

const STORAGE_KEY = "ledger-state-v1";
function loadPersisted() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function buildMonths(stored) {
  return EXPENSE.months.map((m) => {
    const tx = stored && stored.txByMonth && stored.txByMonth[m.key] ? stored.txByMonth[m.key] : m.transactions;
    return recompute({ ...m, transactions: tx });
  });
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#4f8ff7",
  "theme": "dark",
  "trendMode": "bars",
  "density": "comfortable",
  "budgetLine": true
}/*EDITMODE-END*/;

function recompute(month) {
  const byCat = {};
  EXPENSE.categories.forEach((c) => (byCat[c.id] = 0));
  const byDay = {};
  let total = 0;
  month.transactions.forEach((t) => {
    byCat[t.cat] += t.amount;
    byDay[t.day] = (byDay[t.day] || 0) + t.amount;
    total += t.amount;
  });
  return { ...month, byCat, byDay, total: Math.round(total * 100) / 100 };
}

function Delta({ value }) {
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

function KpiCard({ label, value, sub, delta, children }) {
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

function Paperclip({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.5 5.5l-5 5a1.8 1.8 0 01-2.5-2.5l5.2-5.2a2.6 2.6 0 013.7 3.7L7.4 11.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function TxDetail({ tx, catById, onClose, onEdit, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  React.useEffect(() => { setConfirmDel(false); }, [tx]);
  if (!tx) return null;
  const c = catById[tx.cat] || { name: "Uncategorized", hue: 256 };
  const atts = tx.attachments || [];
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
          <div className="td-meta-row"><span>Type</span><b>{tx.need ? "Necessity" : "Discretionary"}</b></div>
          {tx.recurId && <div className="td-meta-row"><span>Recurring</span><b className="td-recur">↻ Monthly</b></div>}
        </div>

        <div className="td-att">
          <span className="td-att-label">Attachments {atts.length > 0 && <em>({atts.length})</em>}</span>
          {atts.length > 0 ? (
            <div className="att-grid">
              {atts.map((a, i) =>
                a.type && a.type.startsWith("image/") ? (
                  <a key={i} className="att-item" href={a.url} target="_blank" rel="noopener">
                    <img src={a.url} alt={a.name} />
                    <span className="att-name">{a.name}</span>
                  </a>
                ) : (
                  <a key={i} className="att-item att-file" href={a.url} download={a.name}>
                    <div className="att-fileicon"><Paperclip size={22} /></div>
                    <span className="att-name">{a.name}</span>
                  </a>
                )
              )}
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

function AddExpense({ open, onClose, onAdd, editTx, defaultDate, minDate, maxDate, categories, catById }) {
  const seedDate = editTx ? `${editTx.year}-${pad2(editTx.month + 1)}-${pad2(editTx.day)}` : toDateInput(defaultDate);
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(categories[0] ? categories[0].id : "");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(seedDate);
  const [need, setNeed] = useState(true);
  const [files, setFiles] = useState([]);
  const [recurring, setRecurring] = useState(false);
  const [ongoing, setOngoing] = useState(true);
  const [until, setUntil] = useState("");
  const amtRef = useRef(null);
  const minStr = toDateInput(minDate), maxStr = toDateInput(maxDate);
  const untilMin = date.slice(0, 7);
  const untilMax = `${maxDate.getFullYear() + 10}-12`;

  useEffect(() => {
    if (open) {
      if (editTx) {
        setAmount(String(Math.round(editTx.amount * 100) / 100)); setCat(editTx.cat); setMerchant(editTx.merchant);
        setDate(`${editTx.year}-${pad2(editTx.month + 1)}-${pad2(editTx.day)}`);
        setNeed(editTx.need); setFiles(editTx.attachments || []);
      } else {
        const first = categories[0] ? categories[0].id : "";
        setAmount(""); setCat(first); setMerchant(""); setDate(toDateInput(defaultDate));
        setNeed(catById[first] ? catById[first].essential : true); setFiles([]);
      }
      setRecurring(false); setOngoing(true); setUntil("");
      setTimeout(() => amtRef.current && amtRef.current.focus(), 60);
    }
  }, [open]);

  if (!open) return null;
  const dateOk = date >= minStr && date <= maxStr;
  const valid = parseFloat(amount) > 0 && dateOk && (!recurring || ongoing || until);

  const selectCat = (id) => { setCat(id); setNeed(catById[id] ? catById[id].essential : true); };

  const onFiles = (e) => {
    const list = [...e.target.files];
    list.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, url: reader.result }]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };
  const removeFile = (i) => setFiles((prev) => prev.filter((_, j) => j !== i));

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const { year, month, day } = parseDateInput(date);
    onAdd({
      year, month, day, cat,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      merchant: merchant.trim() || catById[cat].name,
      need, attachments: files,
      recurring: recurring ? { endKey: ongoing ? null : until } : null,
      _editId: editTx ? editTx.id : null,
      _editKey: editTx ? editTx.monthKey : null,
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
            <span className="dollar">$</span>
            <input ref={amtRef} inputMode="decimal" value={amount} placeholder="0.00"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
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
        <div className="field-row">
          <label className="field">
            <span>Merchant</span>
            <input value={merchant} placeholder="Optional" onChange={(e) => setMerchant(e.target.value)} />
          </label>
          <label className="field date-field">
            <span>Date</span>
            <input type="date" value={date} min={minStr} max={maxStr} onChange={(e) => setDate(e.target.value)} />
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
                  onChange={(e) => setUntil(e.target.value)} />
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

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const persisted = useMemo(() => loadPersisted(), []);
  const [months, setMonths] = useState(() => buildMonths(persisted));
  const [idx, setIdx] = useState(EXPENSE.currentIndex);
  const [hoverCat, setHoverCat] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [addingRecurring, setAddingRecurring] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [view, setView] = useState("overview");
  const [categories, setCategories] = useState(() => (persisted && persisted.categories) ? persisted.categories : EXPENSE.categories.map((c) => ({ ...c })));
  const [recurring, setRecurring] = useState(() => (persisted && persisted.recurring) ? persisted.recurring : EXPENSE.recurring.map((r) => ({ ...r, active: true })));
  const [viewerTx, setViewerTx] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [txPage, setTxPage] = useState(0);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const month = months[idx];
  const prev = idx > 0 ? months[idx - 1] : null;
  const [budget, setBudget] = useState(() => (persisted && persisted.budget) || EXPENSE.monthlyBudget);
  const [currency, setCurrency] = useState(() => (persisted && persisted.currency) || "USD");
  setLedgerCurrency(currency);

  // period-aware comparison: if current month is partial, compare same day-range of prev month
  const cmp = useMemo(() => {
    if (!prev) return { prevTotal: null, label: null };
    if (month.isPartial) {
      let s = 0;
      for (let d = 1; d <= month.lastDay; d++) s += prev.byDay[d] || 0;
      return { prevTotal: s, label: `vs ${prev.shortLabel} through the ${ordinal(month.lastDay)}` };
    }
    return { prevTotal: prev.total, label: `vs ${prev.shortLabel}` };
  }, [month, prev]);

  const totalDelta = cmp.prevTotal ? ((month.total - cmp.prevTotal) / cmp.prevTotal) * 100 : null;
  const avgPerDay = month.total / month.lastDay;
  const projected = month.isPartial ? (month.total / month.lastDay) * month.daysInMonth : month.total;

  const catItems = useMemo(() =>
    categories
      .map((c) => ({ ...c, amount: month.byCat[c.id] || 0 }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    [month, categories]);
  const topCat = catItems[0];

  const budgetPct = Math.min(100, (month.total / budget) * 100);
  const overBudget = month.total > budget;

  // needs vs wants for the selected month
  const nw = useMemo(() => {
    let need = 0, want = 0, needCount = 0, wantCount = 0;
    const needCat = {}, wantCat = {};
    month.transactions.forEach((tx) => {
      if (tx.need) { need += tx.amount; needCount++; needCat[tx.cat] = (needCat[tx.cat] || 0) + tx.amount; }
      else { want += tx.amount; wantCount++; wantCat[tx.cat] = (wantCat[tx.cat] || 0) + tx.amount; }
    });
    const total = need + want || 1;
    const topOf = (obj) => Object.entries(obj)
      .map(([id, amt]) => ({ id, amt, cat: catById[id] }))
      .filter((x) => x.cat).sort((a, b) => b.amt - a.amt).slice(0, 3);
    return { need, want, needCount, wantCount,
      needPct: Math.round((need / total) * 100), wantPct: Math.round((want / total) * 100),
      topNeed: topOf(needCat), topWant: topOf(wantCat) };
  }, [month, catById]);

  const prevNeedPct = useMemo(() => {
    if (!prev) return null;
    let n = 0, t = 0;
    prev.transactions.forEach((tx) => { t += tx.amount; if (tx.need) n += tx.amount; });
    return t ? Math.round((n / t) * 100) : null;
  }, [prev]);

  const openDetail = (tx) => setViewerTx({
    ...tx,
    monthKey: month.key, year: month.year, month: month.month,
    dateText: `${month.label} ${tx.day}`,
    weekday: WEEKDAY_NAMES[new Date(month.year, month.month, tx.day).getDay()],
  });

  // date bounds for adding / back-dating
  const minDate = useMemo(() => new Date(months[0].year, months[0].month, 1), [months]);
  const maxDate = EXPENSE.today;
  const defaultDate = month.isCurrent ? EXPENSE.today : new Date(month.year, month.month, month.daysInMonth);

  const dayFilteredTx = useMemo(() => {
    let list = month.transactions;
    if (filterCat) list = list.filter((x) => x.cat === filterCat);
    if (selectedDay) list = list.filter((x) => x.day === selectedDay);
    return [...list].sort((a, b) => b.day - a.day || b.amount - a.amount);
  }, [month, filterCat, selectedDay]);
  const TX_PAGE = 5;
  const txPageCount = Math.max(1, Math.ceil(dayFilteredTx.length / TX_PAGE));
  const safePage = Math.min(txPage, txPageCount - 1);
  const pagedTx = dayFilteredTx.slice(safePage * TX_PAGE, safePage * TX_PAGE + TX_PAGE);

  // ----- category management -----
  const addCategory = (cat) => setCategories((prev) => [...prev, cat]);
  const removeCategory = (id, reassignTo) => {
    if (reassignTo) {
      setMonths((prevM) => prevM.map((m) => {
        if (!m.transactions.some((x) => x.cat === id)) return m;
        const tx = m.transactions.map((x) => (x.cat === id ? { ...x, cat: reassignTo } : x));
        return recompute({ ...m, transactions: tx });
      }));
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setFilterCat((f) => (f === id ? null : f));
  };

  // route transactions to the right month by date (supports back-dating + bulk)
  const routeInsert = (items) => {
    setMonths((prevM) => {
      const touched = {};
      items.forEach((it) => {
        const key = `${it.year}-${pad2(it.month + 1)}`;
        const i = prevM.findIndex((m) => m.key === key);
        if (i < 0) return;
        if (!touched[i]) touched[i] = { ...prevM[i], transactions: [...prevM[i].transactions] };
        touched[i].transactions.push({
          id: `tx-${it.year}-${it.month}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          day: it.day, cat: it.cat, amount: it.amount, merchant: it.merchant,
          need: it.need, attachments: it.attachments || [], recurId: it.recurId || null, _new: true,
        });
      });
      return prevM.map((m, i) => (touched[i] ? recompute(touched[i]) : m));
    });
  };

  const addExpense = (item) => {
    if (item._editId) {
      saveTransaction(item._editId, item._editKey, item);
      const i = months.findIndex((m) => m.key === `${item.year}-${pad2(item.month + 1)}`);
      if (i >= 0) setIdx(i);
      return;
    }
    let recurId = null;
    if (item.recurring) {
      recurId = `user-${Date.now()}`;
      setRecurring((prev) => [...prev, { id: recurId, merchant: item.merchant, cat: item.cat,
        amount: item.amount, day: item.day, need: item.need, endKey: item.recurring.endKey, active: true }]);
    }
    routeInsert([{ ...item, recurId }]);
    const i = months.findIndex((m) => m.key === `${item.year}-${pad2(item.month + 1)}`);
    if (i >= 0) setIdx(i);
  };
  const bulkInsert = (items) => routeInsert(items);

  // edit / delete a transaction
  const deleteTransaction = (id, key) => {
    setMonths((prevM) => prevM.map((m) => (m.key === key
      ? recompute({ ...m, transactions: m.transactions.filter((tx) => tx.id !== id) }) : m)));
  };
  const saveTransaction = (id, oldKey, item) => {
    const newKey = `${item.year}-${pad2(item.month + 1)}`;
    setMonths((prevM) => prevM.map((m) => {
      let tx = m.transactions;
      let changed = false;
      if (m.key === oldKey) { tx = tx.filter((x) => x.id !== id); changed = true; }
      if (m.key === newKey) {
        tx = [...tx, { id, day: item.day, cat: item.cat, amount: item.amount, merchant: item.merchant,
          need: item.need, attachments: item.attachments || [], recurId: item.recurId || null, _new: true }];
        changed = true;
      }
      return changed ? recompute({ ...m, transactions: tx }) : m;
    }));
  };

  // add a brand-new recurring expense (from the Recurring tab)
  const addRecurring = (item) => {
    const recurId = `user-${Date.now()}`;
    setRecurring((prev) => [...prev, { id: recurId, ...item, active: true }]);
    setMonths((prevM) => prevM.map((m) => {
      if (!m.isCurrent) return m;
      if (item.day <= m.lastDay && !m.transactions.some((tx) => tx.recurId === recurId)) {
        return recompute({ ...m, transactions: [...m.transactions, {
          id: `tx-${m.year}-${m.month}-${recurId}`, day: item.day, cat: item.cat, amount: item.amount,
          merchant: item.merchant, need: item.need, attachments: [], recurId, _new: true }] });
      }
      return m;
    }));
  };

  // ----- recurring management -----
  const editRecurringAmount = (id, amount) => {
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, amount } : r)));
    setMonths((prevM) => prevM.map((m) => (m.isCurrent
      ? recompute({ ...m, transactions: m.transactions.map((tx) => (tx.recurId === id ? { ...tx, amount, _new: true } : tx)) })
      : m)));
  };
  const toggleRecurring = (id) => {
    const rec = recurring.find((r) => r.id === id);
    if (!rec) return;
    const stopping = rec.active;
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    setMonths((prevM) => prevM.map((m) => {
      if (!m.isCurrent) return m;
      if (stopping) {
        return recompute({ ...m, transactions: m.transactions.filter((tx) => tx.recurId !== id) });
      }
      if (rec.day <= m.lastDay && !m.transactions.some((tx) => tx.recurId === id)) {
        return recompute({ ...m, transactions: [...m.transactions, {
          id: `tx-${m.year}-${m.month}-${id}-resume`, day: rec.day, cat: rec.cat, amount: rec.amount,
          merchant: rec.merchant, need: rec.need, attachments: [], recurId: id, _new: true }] });
      }
      return m;
    }));
  };

  // reset day selection on month change; reset pagination on any filter change
  useEffect(() => { setSelectedDay(null); }, [idx]);
  useEffect(() => { setTxPage(0); }, [selectedDay, filterCat, idx]);

  // keyboard month nav
  useEffect(() => {
    const h = (e) => {
      if (adding) return;
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(months.length - 1, i + 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [adding, months.length]);

  // apply theme at document root so text color cascades from the top (robust across switches)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", t.theme);
    document.body.setAttribute("data-theme", t.theme);
  }, [t.theme]);

  // persist state
  useEffect(() => {
    try {
      const txByMonth = {};
      months.forEach((m) => { txByMonth[m.key] = m.transactions; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, txByMonth, categories, recurring, budget, currency }));
    } catch (e) { /* quota or disabled storage — stay in-memory */ }
  }, [months, categories, recurring, budget, currency]);

  const resetData = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setMonths(EXPENSE.months.map(recompute));
    setCategories(EXPENSE.categories.map((c) => ({ ...c })));
    setRecurring(EXPENSE.recurring.map((r) => ({ ...r, active: true })));
    setBudget(EXPENSE.monthlyBudget); setCurrency("USD"); setLedgerCurrency("USD");
    setFilterCat(null); setViewerTx(null); setIdx(EXPENSE.currentIndex);
  };

  const rootStyle = { "--accent": t.accent };

  return (
    <div className="app" data-theme={t.theme} data-density={t.density} style={rootStyle}>
      <header className="topbar">
        <div className="tb-left">
          <div className="brand">
            <div className="logo" style={{ background: t.accent }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 18V8m5 10V5m5 13v-7m5 7V9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/></svg>
            </div>
            <span className="brand-name">Ledger</span>
          </div>
          <nav className="nav-tabs">
            <button className={view === "overview" ? "on" : ""} onClick={() => setView("overview")}>Overview</button>
            <button className={view === "transactions" ? "on" : ""} onClick={() => setView("transactions")}>Transactions</button>
            <button className={view === "recurring" ? "on" : ""} onClick={() => setView("recurring")}>Recurring</button>
            <button className={view === "categories" ? "on" : ""} onClick={() => setView("categories")}>Categories</button>
            <button className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>Settings</button>
          </nav>
        </div>

        {view === "overview" && (
          <div className="month-nav">
            <button className="icon-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous month">‹</button>
            <div className="month-display">
              <span className="month-title">{month.label}</span>
              {month.isPartial && <span className="month-tag">in progress</span>}
            </div>
            <button className="icon-btn" disabled={idx === months.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next month">›</button>
          </div>
        )}

        <div className="topbar-actions">
          <ExportMenu months={months} catById={catById} onPrint={() => window.print()} />
          <ThemeMenu theme={t.theme} onChange={(v) => setTweak("theme", v)} />
          {view === "overview" && (
            <>
              <button className="btn ghost bulk-btn" onClick={() => setBulk(true)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                Bulk add
              </button>
              <button className="btn primary add-btn" onClick={() => setAdding(true)}>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add expense
              </button>
            </>
          )}
        </div>
      </header>

      {view === "transactions" && (
        <Transactions months={months} categories={categories} catById={catById}
          onAddClick={() => setAdding(true)} onBulkClick={() => setBulk(true)} onOpenTx={setViewerTx} />
      )}
      {view === "recurring" && (
        <RecurringView recurring={recurring} catById={catById}
          onEditAmount={editRecurringAmount} onToggle={toggleRecurring} onAddClick={() => setAddingRecurring(true)} />
      )}
      {view === "categories" && (
        <CategoriesView categories={categories} months={months}
          onAdd={addCategory} onRemove={removeCategory} accent={t.accent} />
      )}
      {view === "settings" && (
        <SettingsView budget={budget} onBudget={setBudget}
          currency={currency} onCurrency={(code) => { setLedgerCurrency(code); setCurrency(code); }}
          currencies={CURRENCIES} onReset={resetData} />
      )}
      {view === "overview" && (
      <main className="grid">
        {/* KPI row */}
        <KpiCard label="Total spent" value={fmtUSD(month.total)} delta={totalDelta} sub={cmp.label} />
        <KpiCard label="Avg / day" value={fmtUSD(avgPerDay, true)} sub={`over ${month.lastDay} days`} />
        <KpiCard label="Top category" value={topCat ? topCat.name : "—"} sub={topCat ? `${fmtUSD(topCat.amount)} · ${Math.round((topCat.amount / month.total) * 100)}%` : ""}>
          {topCat && <span className="kpi-dot" style={{ background: catColor(topCat.hue) }} />}
        </KpiCard>
        <KpiCard label={month.isPartial ? "Projected vs budget" : "Spent vs budget"}
          value={fmtUSD(month.isPartial ? projected : month.total)}
          sub={overBudget ? `${fmtUSD(month.total - budget)} over` : `${fmtUSD(budget - month.total)} left of ${fmtUSD(budget)}`}>
          <div className="budget-bar">
            <div className="budget-fill" style={{ width: budgetPct + "%", background: overBudget ? "var(--danger)" : "var(--accent)" }} />
            {month.isPartial && <div className="budget-proj" style={{ left: Math.min(100, (projected / budget) * 100) + "%" }} title="projected" />}
          </div>
        </KpiCard>

        {/* Insights */}
        <Insights month={month} months={months} idx={idx} catById={catById} budget={budget} />

        {/* Trend */}
        <section className="card span-trend">
          <div className="card-head">
            <div>
              <h2>Monthly spending</h2>
              <p className="card-sub">Last 12 months · click a bar to jump to that month</p>
            </div>
            <div className="seg-mini">
              {["bars", "line", "area"].map((m) => (
                <button key={m} className={t.trendMode === m ? "on" : ""} onClick={() => setTweak("trendMode", m)}>{m}</button>
              ))}
            </div>
          </div>
          <TrendChart months={months} selectedIndex={idx} onSelect={setIdx}
            accent={t.accent} mode={t.trendMode} budget={t.budgetLine ? budget : 0} />
        </section>

        {/* Category breakdown */}
        <section className="card span-cat">
          <div className="card-head">
            <div>
              <h2>By category</h2>
              <p className="card-sub">{month.shortLabel} {month.year}{filterCat ? " · filtered" : ""}</p>
            </div>
            {filterCat && <button className="clear-link" onClick={() => setFilterCat(null)}>clear filter</button>}
          </div>
          <div className="cat-body">
            <CategoryDonut items={catItems} total={month.total} hovered={hoverCat || filterCat} onHover={setHoverCat} />
            <div className="legend">
              {catItems.map((c) => {
                const pct = (c.amount / month.total) * 100;
                const sel = filterCat === c.id;
                return (
                  <button key={c.id} className={"legend-row" + (sel ? " sel" : "")}
                    onMouseEnter={() => setHoverCat(c.id)} onMouseLeave={() => setHoverCat(null)}
                    onClick={() => setFilterCat(sel ? null : c.id)}>
                    <i className="legend-dot" style={{ background: catColor(c.hue) }} />
                    <span className="legend-name">{c.name}</span>
                    <span className="legend-bar"><span style={{ width: pct + "%", background: catColor(c.hue) }} /></span>
                    <span className="legend-amt">{fmtUSD(c.amount)}</span>
                    <span className="legend-pct">{pct.toFixed(0)}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Needs vs Wants */}
        <section className="card span-needs">
          <div className="card-head">
            <div>
              <h2>Needs vs Wants</h2>
              <p className="card-sub">How essential was {month.shortLabel}’s spending</p>
            </div>
            {prevNeedPct != null && (
              <div className="nw-compare">
                <Delta value={nw.needPct - prevNeedPct} />
                <span>needs vs {prevNeedPct}% in {prev.shortLabel}</span>
              </div>
            )}
          </div>
          <div className="nw-bar">
            <div className="nw-seg is-need" style={{ width: nw.needPct + "%" }}>
              {nw.needPct >= 12 && <span>{nw.needPct}%</span>}
            </div>
            <div className="nw-seg is-want" style={{ width: nw.wantPct + "%" }}>
              {nw.wantPct >= 12 && <span>{nw.wantPct}%</span>}
            </div>
          </div>
          <div className="nw-grid">
            {[{ k: "need", label: "Necessities", amt: nw.need, count: nw.needCount, top: nw.topNeed },
              { k: "want", label: "Discretionary", amt: nw.want, count: nw.wantCount, top: nw.topWant }].map((b) => (
              <div key={b.k} className="nw-detail">
                <div className="nw-detail-head">
                  <span className={"nw-dot is-" + b.k} />
                  <span className="nw-detail-label">{b.label}</span>
                </div>
                <div className="nw-detail-amt">{fmtUSD(b.amt)}</div>
                <div className="nw-detail-sub">{b.count} transaction{b.count !== 1 ? "s" : ""}</div>
                <div className="nw-cats">
                  {b.top.map((x) => (
                    <span key={x.id} className="nw-cat-chip">
                      <i style={{ background: catColor(x.cat.hue) }} />{x.cat.name}
                      <em>{fmtUSD(x.amt)}</em>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Heatmap */}
        <section className="card span-heat">
          <div className="card-head">
            <div>
              <h2>Daily spending</h2>
              <p className="card-sub">{selectedDay ? <><b className="cs-strong">{month.shortLabel} {selectedDay}</b> selected · <button className="clear-inline" onClick={() => setSelectedDay(null)}>clear</button></> : "Tap a day to filter transactions"}</p>
            </div>
            <div className="cal-nav">
              <button className="icon-btn sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous month">‹</button>
              <span className="cal-nav-label">{month.shortLabel} {month.year}</span>
              <button className="icon-btn sm" disabled={idx === months.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next month">›</button>
            </div>
          </div>
          <Heatmap month={month} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </section>

        {/* Transactions */}
        <section className="card span-tx">
          <div className="card-head">
            <div>
              <h2>Transactions</h2>
              <p className="card-sub">
                {selectedDay ? <><b className="cs-strong">{month.shortLabel} {selectedDay}</b> · </> : ""}
                {dayFilteredTx.length} {filterCat && catById[filterCat] ? catById[filterCat].name.toLowerCase() + " " : ""}item{dayFilteredTx.length !== 1 ? "s" : ""}
              </p>
            </div>
            {(filterCat || selectedDay) && <button className="clear-link" onClick={() => { setFilterCat(null); setSelectedDay(null); }}>show all</button>}
          </div>
          <div className="tx-list">
            {pagedTx.map((tx) => {
              const c = catById[tx.cat];
              if (!c) return null;
              const hasAtt = tx.attachments && tx.attachments.length > 0;
              return (
                <div key={tx.id} className={"tx-row clickable" + (tx._new ? " is-new" : "")}
                  onClick={() => openDetail(tx)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(tx); } }}>
                  <span className="tx-dot" style={{ background: catColor(c.hue) }} />
                  <div className="tx-main">
                    <span className="tx-merchant">{tx.merchant}</span>
                    <span className="tx-cat">{c.name}<span className={"need-tag " + (tx.need ? "is-need" : "is-want")}>{tx.need ? "Need" : "Want"}</span></span>
                  </div>
                  {hasAtt && (
                    <span className="att-badge" title={`${tx.attachments.length} attachment${tx.attachments.length > 1 ? "s" : ""}`}>
                      <Paperclip size={12} />{tx.attachments.length}
                    </span>
                  )}
                  <span className="tx-day">{month.shortLabel} {tx.day}</span>
                  <span className="tx-amt">{fmtUSD(tx.amount, true)}</span>
                </div>
              );
            })}
            {dayFilteredTx.length === 0 && <div className="tx-empty">No transactions{selectedDay ? ` on ${month.shortLabel} ${selectedDay}` : ""}.</div>}
          </div>
          {txPageCount > 1 && (
            <div className="tx-pager">
              <button className="pager-btn" disabled={safePage === 0} onClick={() => setTxPage(safePage - 1)} aria-label="Previous page">‹</button>
              <span className="pager-info">Page {safePage + 1} of {txPageCount}</span>
              <button className="pager-btn" disabled={safePage >= txPageCount - 1} onClick={() => setTxPage(safePage + 1)} aria-label="Next page">›</button>
            </div>
          )}
        </section>
      </main>
      )}

      <AddExpense open={adding} onClose={() => setAdding(false)} onAdd={addExpense}
        defaultDate={defaultDate} minDate={minDate} maxDate={maxDate} categories={categories} catById={catById} />
      <AddExpense open={!!editingTx} editTx={editingTx} onClose={() => setEditingTx(null)} onAdd={addExpense}
        defaultDate={defaultDate} minDate={minDate} maxDate={maxDate} categories={categories} catById={catById} />
      <BulkAdd open={bulk} onClose={() => setBulk(false)} onInsert={bulkInsert}
        categories={categories} catById={catById} minDate={minDate} maxDate={maxDate} />
      <AddRecurring open={addingRecurring} onClose={() => setAddingRecurring(false)} onAdd={addRecurring}
        categories={categories} catById={catById} />
      <TxDetail tx={viewerTx} catById={catById} onClose={() => setViewerTx(null)}
        onEdit={(tx) => { setEditingTx(tx); setViewerTx(null); }}
        onDelete={(tx) => { deleteTransaction(tx.id, tx.monthKey); setViewerTx(null); }} />

      <PrintReport month={month} categories={categories} catById={catById} budget={budget} />

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakSelect label="Theme" value={t.theme} options={THEMES.map((th) => ({ value: th.id, label: th.name }))} onChange={(v) => setTweak("theme", v)} />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS.map((a) => a.val)} onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density} options={["comfortable", "compact"]} onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Charts" />
        <TweakRadio label="Trend style" value={t.trendMode} options={["bars", "line", "area"]} onChange={(v) => setTweak("trendMode", v)} />
        <TweakToggle label="Budget line" value={t.budgetLine} onChange={(v) => setTweak("budgetLine", v)} />
        <TweakSection label="Data" />
        <TweakButton label="Reset to sample data" secondary onClick={resetData} />
      </TweaksPanel>
    </div>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
