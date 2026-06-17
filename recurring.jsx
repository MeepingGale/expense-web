/* Recurring expenses: add new, edit amount, stop / resume, set an end date. */
const { useState: useStateRec, useEffect: useEffectRec } = React;
const useState = useStateRec, useEffect = useEffectRec;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const _pad2r = (n) => String(n).padStart(2, "0");

function ordinalRec(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtEndKey(key) {
  if (!key) return null;
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_ABBR[m - 1]} ${y}`;
}

function RecurringRow({ item, catById, onEditAmount, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.amount));
  const c = catById[item.cat] || { name: "Uncategorized", hue: 256 };

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
        <span className="rec-meta">{c.name} · Monthly on the {ordinalRec(item.day)} · {end ? `until ${end}` : "ongoing"}</span>
      </div>

      {item.active
        ? <span className="rec-status active">Active</span>
        : <span className="rec-status">Stopped</span>}

      <div className="rec-amount">
        {editing ? (
          <div className="rec-edit">
            <div className="amount-input rec-edit-input">
              <span className="dollar">$</span>
              <input autoFocus inputMode="decimal" value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
            </div>
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

function RecurringView({ recurring, catById, onEditAmount, onToggle, onAddClick }) {
  const active = recurring.filter((r) => r.active);
  const monthlyTotal = active.reduce((s, r) => s + r.amount, 0);
  const needTotal = active.filter((r) => r.need).reduce((s, r) => s + r.amount, 0);

  // forecast: next 3 months of committed recurring (respecting end dates)
  const today = EXPENSE.today;
  const forecast = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${_pad2r(d.getMonth() + 1)}`;
    const due = active.filter((r) => !r.endKey || r.endKey >= key);
    forecast.push({ label: `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`, total: due.reduce((s, r) => s + r.amount, 0), count: due.length });
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

function AddRecurring({ open, onClose, onAdd, categories, catById }) {
  const first = categories[0] ? categories[0].id : "";
  const today = EXPENSE.today;
  const minMonth = `${today.getFullYear()}-${_pad2r(today.getMonth() + 1)}`;
  const maxMonth = `${today.getFullYear() + 10}-12`;
  const [merchant, setMerchant] = useState("");
  const [cat, setCat] = useState(first);
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(1);
  const [need, setNeed] = useState(catById[first] ? catById[first].essential : true);
  const [ongoing, setOngoing] = useState(true);
  const [until, setUntil] = useState("");
  const merchRef = React.useRef(null);

  useEffect(() => {
    if (open) {
      setMerchant(""); setCat(first); setAmount(""); setDay(1);
      setNeed(catById[first] ? catById[first].essential : true);
      setOngoing(true); setUntil("");
      setTimeout(() => merchRef.current && merchRef.current.focus(), 60);
    }
  }, [open]);

  if (!open) return null;
  const selectCat = (id) => { setCat(id); setNeed(catById[id] ? catById[id].essential : true); };
  const valid = parseFloat(amount) > 0 && merchant.trim() && (ongoing || until);

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      merchant: merchant.trim(),
      cat,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      day: Math.min(31, Math.max(1, parseInt(day) || 1)),
      need,
      endKey: ongoing ? null : until,
    });
    onClose();
  };

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <form className="modal modal-tall" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
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
            <div className="amount-input">
              <span className="dollar">$</span>
              <input inputMode="decimal" value={amount} placeholder="0.00"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            </div>
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

Object.assign(window, { RecurringView, AddRecurring });
