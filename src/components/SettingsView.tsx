/* Settings: editable budget, currency, appearance, and data reset. */
import React, { useState, useEffect } from "react";
import { ACCENTS } from "../data/constants";
import type { Currency, Settings } from "../types";

interface SettingsViewProps {
  budget: number;
  onBudget: (v: number) => void;
  currency: string;
  onCurrency: (code: string) => void;
  currencies: Currency[];
  onReset: () => void;
  // re-homed from the dropped tweaks panel:
  settings: Settings;
  onSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export function SettingsView({
  budget, onBudget, currency, onCurrency, currencies, onReset, settings, onSetting,
}: SettingsViewProps) {
  const [draft, setDraft] = useState(String(budget));
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { setDraft(String(budget)); }, [budget]);

  const cur = currencies.find((c) => c.code === currency) || currencies[0];
  const commitBudget = () => {
    const v = Math.round(parseFloat(draft) || 0);
    if (v > 0) onBudget(v); else setDraft(String(budget));
  };

  return (
    <div className="setv">
      <div className="setv-head">
        <h1>Settings</h1>
        <p className="txv-sub">Configure your budget, currency, appearance, and data</p>
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
                onKeyDown={(e) => { if (e.key === "Enter") { commitBudget(); (e.target as HTMLInputElement).blur(); } }} />
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
        <div className="setv-label">
          <h2>Appearance</h2>
          <p>Tune the accent color, layout density, and chart details.</p>
        </div>

        <div className="cur-grid">
          {ACCENTS.map((a) => (
            <button key={a.id} className={"cur-opt" + (settings.accent === a.val ? " sel" : "")}
              onClick={() => onSetting("accent", a.val)}>
              <span className="cur-sym" style={{ background: a.val, color: "#fff", borderColor: "transparent" }} />
              <span className="cur-meta">
                <span className="cur-code" style={{ textTransform: "capitalize" }}>{a.id}</span>
                <span className="cur-name">Accent color</span>
              </span>
              {settings.accent === a.val && (
                <svg className="cur-check" width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          ))}
        </div>

        <div className="setv-row">
          <div className="setv-label">
            <h2>Density</h2>
            <p>Compact tightens padding and spacing across the dashboard.</p>
          </div>
          <div className="setv-control">
            <div className="need-toggle">
              <button type="button" className={settings.density === "comfortable" ? "on" : ""}
                onClick={() => onSetting("density", "comfortable")}>Comfortable</button>
              <button type="button" className={settings.density === "compact" ? "on" : ""}
                onClick={() => onSetting("density", "compact")}>Compact</button>
            </div>
          </div>
        </div>

        <div className="setv-row">
          <div className="setv-label">
            <h2>Budget line on chart</h2>
            <p>Overlays your monthly budget on the spending trend.</p>
          </div>
          <div className="setv-control">
            <div className="need-toggle">
              <button type="button" className={settings.budgetLine ? "on" : ""}
                onClick={() => onSetting("budgetLine", true)}>On</button>
              <button type="button" className={!settings.budgetLine ? "on" : ""}
                onClick={() => onSetting("budgetLine", false)}>Off</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card setv-card">
        <div className="setv-row">
          <div className="setv-label">
            <h2>Clear all data</h2>
            <p>Permanently delete every transaction and recurring item, and start fresh.</p>
          </div>
          <div className="setv-control">
            {confirmReset ? (
              <div className="setv-confirm">
                <span>Are you sure?</span>
                <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
                <button className="btn danger" onClick={() => { onReset(); setConfirmReset(false); }}>Clear</button>
              </div>
            ) : (
              <button className="btn ghost setv-reset" onClick={() => setConfirmReset(true)}>Clear all data</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
