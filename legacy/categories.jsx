/* Category manager: add / remove categories. Receives state via props from App. */
const { useState: useStateCat, useMemo: useMemoCat } = React;
const useState = useStateCat, useMemo = useMemoCat;

const HUE_SWATCHES = [222, 196, 152, 120, 80, 48, 22, 8, 330, 300, 280, 258];

function slugify(name, existing) {
  let base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
  let id = base, n = 2;
  while (existing.has(id)) id = base + "-" + n++;
  return id;
}

function CategoriesView({ categories, months, onAdd, onRemove, accent }) {
  const [name, setName] = useState("");
  const [hue, setHue] = useState(120);
  const [essential, setEssential] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [reassign, setReassign] = useState("");

  // usage stats per category across all months
  const usage = useMemo(() => {
    const u = {};
    categories.forEach((c) => (u[c.id] = { count: 0, total: 0 }));
    months.forEach((m) => m.transactions.forEach((tx) => {
      if (u[tx.cat]) { u[tx.cat].count++; u[tx.cat].total += tx.amount; }
    }));
    return u;
  }, [categories, months]);

  const existingIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const usedHues = new Set(categories.map((c) => c.hue));

  const submit = (e) => {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return;
    onAdd({ id: slugify(nm, existingIds), name: nm, hue, essential });
    setName(""); setEssential(true);
    const nextHue = HUE_SWATCHES.find((h) => !usedHues.has(h));
    if (nextHue != null) setHue(nextHue);
  };

  const startRemove = (id) => {
    setConfirmId(id);
    const target = categories.find((c) => c.id !== id);
    setReassign(target ? target.id : "");
  };
  const confirmRemove = () => {
    const count = usage[confirmId] ? usage[confirmId].count : 0;
    onRemove(confirmId, count > 0 ? reassign : null);
    setConfirmId(null);
  };

  return (
    <div className="catv">
      <div className="catv-head">
        <div>
          <h1>Categories</h1>
          <p className="txv-sub">{categories.length} categories · organize how spending is grouped</p>
        </div>
      </div>

      <div className="catv-cols">
        {/* add form */}
        <form className="card catv-form" onSubmit={submit}>
          <h2>New category</h2>
          <label className="field">
            <span>Name</span>
            <input value={name} placeholder="e.g. Travel, Pets, Gifts" maxLength={24}
              onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>Color</span>
            <div className="hue-grid">
              {HUE_SWATCHES.map((h) => (
                <button type="button" key={h} className={"hue-swatch" + (hue === h ? " sel" : "")}
                  style={{ background: catColor(h) }} onClick={() => setHue(h)} aria-label={"hue " + h}>
                  {hue === h && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Default type</span>
            <div className="need-toggle">
              <button type="button" className={essential ? "on" : ""} onClick={() => setEssential(true)}>Necessity</button>
              <button type="button" className={!essential ? "on" : ""} onClick={() => setEssential(false)}>Discretionary</button>
            </div>
            <p className="field-hint">New expenses in this category default to this type.</p>
          </div>
          <div className="catv-preview">
            <span className="catv-preview-label">Preview</span>
            <span className="cat-row-chip"><i style={{ background: catColor(hue) }} />{name.trim() || "Category name"}</span>
          </div>
          <button type="submit" className="btn primary" disabled={!name.trim()} style={{ width: "100%", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Add category
          </button>
        </form>

        {/* list */}
        <div className="card catv-list">
          {categories.map((c) => {
            const u = usage[c.id] || { count: 0, total: 0 };
            const confirming = confirmId === c.id;
            const others = categories.filter((x) => x.id !== c.id);
            return (
              <div key={c.id} className={"cat-manage-row" + (confirming ? " confirming" : "")}>
                <div className="cat-manage-main">
                  <span className="cat-swatch" style={{ background: catColor(c.hue) }} />
                  <div className="cat-manage-text">
                    <span className="cat-manage-name">{c.name}
                      <span className={"need-tag " + (c.essential ? "is-need" : "is-want")}>{c.essential ? "Need" : "Want"}</span>
                    </span>
                    <span className="cat-manage-usage">
                      {u.count > 0 ? `${u.count} transaction${u.count !== 1 ? "s" : ""} · ${fmtUSD(u.total)}` : "No transactions yet"}
                    </span>
                  </div>
                  <button className="cat-del-btn" onClick={() => startRemove(c.id)} disabled={categories.length <= 1}
                    title={categories.length <= 1 ? "Keep at least one category" : "Remove"}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                {confirming && (
                  <div className="cat-confirm">
                    {u.count > 0 ? (
                      <div className="cat-confirm-row">
                        <span>Move its <b>{u.count}</b> transaction{u.count !== 1 ? "s" : ""} to</span>
                        <label className="txv-select-wrap">
                          <select value={reassign} onChange={(e) => setReassign(e.target.value)}>
                            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <span>Remove <b>{c.name}</b>? This can’t be undone.</span>
                    )}
                    <div className="cat-confirm-actions">
                      <button className="btn ghost" onClick={() => setConfirmId(null)}>Cancel</button>
                      <button className="btn danger" onClick={confirmRemove}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CategoriesView });
