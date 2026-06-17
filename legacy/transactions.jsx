/* Full cross-month transaction browser: search, filter by month + category, sort. */
const { useState: useStateTx, useMemo: useMemoTx } = React;
const useState = useStateTx, useMemo = useMemoTx;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TxIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.6"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

function Transactions({ months, categories, catById, onAddClick, onBulkClick, onOpenTx }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");
  const [cats, setCats] = useState(() => new Set());
  const [sort, setSort] = useState("newest");

  // flatten every transaction with month context
  const allTx = useMemo(() => {
    const out = [];
    months.forEach((m, mi) => {
      m.transactions.forEach((tx) => {
        out.push({
          ...tx, mi, year: m.year, month: m.month, monthKey: m.key,
          monthLabel: m.label, shortLabel: m.shortLabel,
          weekday: WEEKDAYS[new Date(m.year, m.month, tx.day).getDay()],
        });
      });
    });
    return out;
  }, [months]);

  const lastIdx = months.length - 1;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTx.filter((tx) => {
      if (q && !tx.merchant.toLowerCase().includes(q) && !(catById[tx.cat] && catById[tx.cat].name.toLowerCase().includes(q))) return false;
      if (cats.size && !cats.has(tx.cat)) return false;
      if (range === "recent3" && tx.mi < lastIdx - 2) return false;
      if (range !== "all" && range !== "recent3" && tx.monthKey !== range) return false;
      return true;
    });
  }, [allTx, query, cats, range, lastIdx]);

  const stat = useMemo(() => {
    const total = filtered.reduce((s, x) => s + x.amount, 0);
    const needTotal = filtered.reduce((s, x) => s + (x.need ? x.amount : 0), 0);
    return { total, count: filtered.length, avg: filtered.length ? total / filtered.length : 0,
      needPct: total ? Math.round((needTotal / total) * 100) : 0 };
  }, [filtered]);

  const byAmount = sort === "highest" || sort === "lowest";

  // grouped by month (date sorts) or flat (amount sorts)
  const groups = useMemo(() => {
    if (byAmount) {
      const flat = [...filtered].sort((a, b) => sort === "highest" ? b.amount - a.amount : a.amount - b.amount);
      return [{ key: "__flat", rows: flat, showMonth: true }];
    }
    const map = new Map();
    filtered.forEach((tx) => {
      if (!map.has(tx.monthKey)) map.set(tx.monthKey, { key: tx.monthKey, label: tx.monthLabel, mi: tx.mi, rows: [], total: 0 });
      const g = map.get(tx.monthKey);
      g.rows.push(tx); g.total += tx.amount;
    });
    const arr = [...map.values()].sort((a, b) => sort === "newest" ? b.mi - a.mi : a.mi - b.mi);
    arr.forEach((g) => g.rows.sort((a, b) => sort === "newest" ? b.day - a.day || b.amount - a.amount : a.day - b.day || b.amount - a.amount));
    return arr;
  }, [filtered, sort, byAmount]);

  const toggleCat = (id) => setCats((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const anyFilter = query || range !== "all" || cats.size;

  return (
    <div className="txv">
      <div className="txv-head">
        <div>
          <h1>Transactions</h1>
          <p className="txv-sub">
            <b>{stat.count.toLocaleString()}</b> transaction{stat.count !== 1 ? "s" : ""} ·
            <b> {fmtUSD(stat.total)}</b> total · {fmtUSD(stat.avg, true)} avg · <b>{stat.needPct}%</b> needs
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn ghost bulk-btn" onClick={onBulkClick}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            Bulk add
          </button>
          <button className="btn primary add-btn" onClick={onAddClick}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add expense
          </button>
        </div>
      </div>

      <div className="card txv-filters">
        <div className="txv-filter-top">
          <label className="txv-search">
            <TxIcon />
            <input value={query} placeholder="Search merchant or category…" onChange={(e) => setQuery(e.target.value)} />
            {query && <button className="txv-clear-x" onClick={() => setQuery("")} aria-label="Clear">✕</button>}
          </label>
          <label className="txv-select-wrap">
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All months</option>
              <option value="recent3">Last 3 months</option>
              <optgroup label="Jump to month">
                {[...months].slice().reverse().map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </optgroup>
            </select>
          </label>
          <label className="txv-select-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
          </label>
        </div>
        <div className="txv-chips">
          <button className={"txv-chip" + (cats.size === 0 ? " sel" : "")} onClick={() => setCats(new Set())}>All categories</button>
          {categories.map((c) => (
            <button key={c.id} className={"txv-chip" + (cats.has(c.id) ? " sel" : "")} onClick={() => toggleCat(c.id)}>
              <i style={{ background: catColor(c.hue) }} />{c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card txv-list">
        {stat.count === 0 && (
          <div className="txv-empty">
            <p>No transactions match your filters.</p>
            {anyFilter && <button className="btn ghost" onClick={() => { setQuery(""); setRange("all"); setCats(new Set()); }}>Reset filters</button>}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key} className="txv-group">
            {g.key !== "__flat" && (
              <div className="txv-group-head">
                <span className="txv-group-label">{g.label}</span>
                <span className="txv-group-meta">{g.rows.length} item{g.rows.length !== 1 ? "s" : ""} · {fmtUSD(g.total)}</span>
              </div>
            )}
            {g.rows.map((tx) => {
              const c = catById[tx.cat];
              if (!c) return null;
              const hasAtt = tx.attachments && tx.attachments.length > 0;
              const open = () => onOpenTx({ ...tx, dateText: `${tx.monthLabel} ${tx.day}` });
              return (
                <div key={tx.id} className={"txv-row clickable" + (tx._new ? " is-new" : "")}
                  onClick={open} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
                  <div className="txv-date">
                    <span className="txv-date-day">{g.showMonth ? `${tx.shortLabel} ${tx.day}` : tx.day}</span>
                    <span className="txv-date-wd">{tx.weekday}</span>
                  </div>
                  <span className="txv-dot" style={{ background: catColor(c.hue) }} />
                  <div className="txv-main">
                    <span className="txv-merchant">{tx.merchant}
                      <span className={"need-tag " + (tx.need ? "is-need" : "is-want")}>{tx.need ? "Need" : "Want"}</span>
                    </span>
                    <span className="txv-cat"><i style={{ background: catColor(c.hue) }} />{c.name}</span>
                  </div>
                  {hasAtt && (
                    <span className="att-badge"
                      title={`${tx.attachments.length} attachment${tx.attachments.length > 1 ? "s" : ""}`}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M11.5 5.5l-5 5a1.8 1.8 0 01-2.5-2.5l5.2-5.2a2.6 2.6 0 013.7 3.7L7.4 11.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {tx.attachments.length}
                    </span>
                  )}
                  <span className="txv-chevron">›</span>
                  <span className="txv-amt">{fmtUSD(tx.amount, true)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Transactions });
