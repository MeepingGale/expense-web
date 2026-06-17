/* Settings: editable budget, currency, and data reset. */
const { useState: useStateSet } = React;
const useState = useStateSet;

function SettingsView({ budget, onBudget, currency, onCurrency, currencies, onReset }) {
  const [draft, setDraft] = useState(String(budget));
  const [confirmReset, setConfirmReset] = useState(false);
  React.useEffect(() => { setDraft(String(budget)); }, [budget]);

  const cur = currencies.find((c) => c.code === currency) || currencies[0];
  const commitBudget = () => {
    const v = Math.round(parseFloat(draft) || 0);
    if (v > 0) onBudget(v); else setDraft(String(budget));
  };

  return (
    <div className="setv">
      <div className="setv-head">
        <h1>Settings</h1>
        <p className="txv-sub">Configure your budget, currency, and data</p>
      </div>

      <section className="card setv-card">
        <div className="setv-row">
          <div className="setv-label">
            <h2>Monthly budget</h2>
            <p>Used across KPIs, the budget line, and insights.</p>
          </div>
          <div className="setv-control">
            <div className="amount-input setv-budget">
              <span className="dollar">{cur.symbol}</span>
              <input inputMode="decimal" value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
                onBlur={commitBudget}
                onKeyDown={(e) => { if (e.key === "Enter") { commitBudget(); e.target.blur(); } }} />
            </div>
          </div>
        </div>
      </section>

      <section className="card setv-card">
        <div className="setv-label">
          <h2>Currency</h2>
          <p>Changes how every amount is displayed. Values aren’t converted.</p>
        </div>
        <div className="cur-grid">
          {currencies.map((c) => (
            <button key={c.code} className={"cur-opt" + (c.code === currency ? " sel" : "")}
              onClick={() => onCurrency(c.code)}>
              <span className="cur-sym">{c.symbol}</span>
              <span className="cur-meta">
                <span className="cur-code">{c.code}</span>
                <span className="cur-name">{c.name}</span>
              </span>
              {c.code === currency && (
                <svg className="cur-check" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="card setv-card">
        <div className="setv-row">
          <div className="setv-label">
            <h2>Reset data</h2>
            <p>Discard your changes and restore the sample data.</p>
          </div>
          <div className="setv-control">
            {confirmReset ? (
              <div className="setv-confirm">
                <span>Are you sure?</span>
                <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
                <button className="btn danger" onClick={() => { onReset(); setConfirmReset(false); }}>Reset</button>
              </div>
            ) : (
              <button className="btn ghost setv-reset" onClick={() => setConfirmReset(true)}>Reset to sample data</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { SettingsView });
