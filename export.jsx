/* Export: CSV download of all transactions + a printable monthly PDF report. */
const _pad2e = (n) => String(n).padStart(2, "0");

function exportCSV(months, catById) {
  const rows = [["Date", "Merchant", "Category", "Amount", "Type", "Recurring"]];
  months.forEach((m) => {
    [...m.transactions].sort((a, b) => a.day - b.day).forEach((tx) => {
      rows.push([
        `${m.year}-${_pad2e(m.month + 1)}-${_pad2e(tx.day)}`,
        tx.merchant,
        (catById[tx.cat] && catById[tx.cat].name) || tx.cat,
        tx.amount.toFixed(2),
        tx.need ? "Need" : "Want",
        tx.recurId ? "Yes" : "No",
      ]);
    });
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "ledger-transactions.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportMenu({ months, catById, onPrint }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="theme-menu">
      <button className="btn ghost export-btn" onClick={() => setOpen((o) => !o)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Export
      </button>
      {open && (
        <>
          <div className="theme-pop-scrim" onClick={() => setOpen(false)} />
          <div className="theme-pop export-pop">
            <button className="theme-opt" onClick={() => { exportCSV(months, catById); setOpen(false); }}>
              <span className="export-ic"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6h6M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg></span>
              <span className="theme-opt-name">Download CSV<em className="export-hint">All transactions</em></span>
            </button>
            <button className="theme-opt" onClick={() => { setOpen(false); setTimeout(onPrint, 60); }}>
              <span className="export-ic"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6V2.5h8V6M4 12H3a1 1 0 01-1-1V8a1 1 0 011-1h10a1 1 0 011 1v3a1 1 0 01-1 1h-1M4 10h8v3.5H4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              <span className="theme-opt-name">Save as PDF<em className="export-hint">Print this month</em></span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PrintReport({ month, categories, catById, budget }) {
  const catItems = categories
    .map((c) => ({ ...c, amount: month.byCat[c.id] || 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  let need = 0, want = 0;
  month.transactions.forEach((tx) => { if (tx.need) need += tx.amount; else want += tx.amount; });
  const rows = [...month.transactions].sort((a, b) => a.day - b.day || b.amount - a.amount);
  const projected = month.isPartial ? (month.total / month.lastDay) * month.daysInMonth : month.total;

  return (
    <div className="print-report">
      <div className="pr-head">
        <div>
          <div className="pr-brand">Ledger</div>
          <h1 className="pr-title">{month.label} spending report</h1>
        </div>
        <div className="pr-total">
          <span>Total spent</span>
          <b>{fmtUSD(month.total)}</b>
        </div>
      </div>

      <div className="pr-stats">
        <div className="pr-stat"><span>Transactions</span><b>{month.transactions.length}</b></div>
        <div className="pr-stat"><span>Avg / day</span><b>{fmtUSD(month.total / month.lastDay, true)}</b></div>
        <div className="pr-stat"><span>{month.isPartial ? "Projected" : "vs budget"}</span><b>{fmtUSD(month.isPartial ? projected : budget)}</b></div>
        <div className="pr-stat"><span>Needs / Wants</span><b>{fmtUSD(need)} / {fmtUSD(want)}</b></div>
      </div>

      <h2 className="pr-h2">By category</h2>
      <table className="pr-table">
        <thead><tr><th>Category</th><th className="pr-r">Amount</th><th className="pr-r">Share</th></tr></thead>
        <tbody>
          {catItems.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td className="pr-r">{fmtUSD(c.amount)}</td>
              <td className="pr-r">{Math.round((c.amount / month.total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="pr-h2">Transactions ({rows.length})</h2>
      <table className="pr-table">
        <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Type</th><th className="pr-r">Amount</th></tr></thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id}>
              <td>{month.shortLabel} {tx.day}</td>
              <td>{tx.merchant}</td>
              <td>{(catById[tx.cat] && catById[tx.cat].name) || ""}</td>
              <td>{tx.need ? "Need" : "Want"}</td>
              <td className="pr-r">{fmtUSD(tx.amount, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pr-foot">Generated from Ledger · {month.label}</div>
    </div>
  );
}

Object.assign(window, { ExportMenu, PrintReport, exportCSV });
