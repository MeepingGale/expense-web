/* Auto-generated spending insights for the selected month. */
import React, { useMemo } from "react";
import { fmtUSD } from "../data/format";
import type { Category, CategoryId, MonthData } from "../types";

type InsightIconKind = "trend" | "star" | "alert" | "check" | "repeat";
type InsightType = "warn" | "good" | "info";

interface InsightIconProps {
  kind: InsightIconKind;
}

interface InsightsProps {
  month: MonthData;
  months: MonthData[];
  idx: number;
  catById: Record<CategoryId, Category>;
  budget: number;
  catBudgets: Record<string, number>;
}

interface InsightItem {
  type: InsightType;
  icon: InsightIconKind;
  text: React.ReactNode;
}

interface BestCat {
  cid: CategoryId;
  pct: number;
  cur: number;
  avg: number;
}

export function InsightIcon({ kind }: InsightIconProps) {
  const p = {
    trend: <path d="M2 11l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    star: <path d="M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.4 4.3 13.3l.8-4.1L2 6.3l4.2-.5z" fill="currentColor"/>,
    alert: <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M8 5v4"/><path d="M8 11.5v.5"/><circle cx="8" cy="8" r="6"/></g>,
    check: <path d="M3 8.5l3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    repeat: <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 018.5-3.5L13 6M13 8a5 5 0 01-8.5 3.5L3 10"/><path d="M13 3v3h-3M3 13v-3h3"/></g>,
  }[kind];
  return <svg width="16" height="16" viewBox="0 0 16 16">{p}</svg>;
}

function computeInsights({ month, months, idx, catById, budget, catBudgets }: InsightsProps): InsightItem[] {
  const out: InsightItem[] = [];
  const hist = months.slice(Math.max(0, idx - 3), idx);

  // category spike / dip vs trailing average
  if (hist.length) {
    let best: BestCat | null = null;
    for (const cid of Object.keys(month.byCat)) {
      const cur = month.byCat[cid] || 0;
      if (cur < 30 || !catById[cid]) continue;
      const avg = hist.reduce((s, m) => s + (m.byCat[cid] || 0), 0) / hist.length;
      if (avg < 20) continue;
      const pct = ((cur - avg) / avg) * 100;
      if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { cid, pct, cur, avg };
    }
    if (best && Math.abs(best.pct) >= 20) {
      out.push({ type: best.pct > 0 ? "warn" : "good", icon: "trend",
        text: <><b>{catById[best.cid].name}</b> is {best.pct > 0 ? "up" : "down"} {Math.abs(Math.round(best.pct))}% vs your {hist.length}-month average — {fmtUSD(best.cur)} vs {fmtUSD(best.avg)}.</> });
    }
  }

  // budget pace
  const projected = month.isPartial ? (month.total / month.lastDay) * month.daysInMonth : month.total;
  if (projected > budget) {
    out.push({ type: "warn", icon: "alert",
      text: <>{month.isPartial ? "On pace to spend" : "Spent"} <b>{fmtUSD(projected)}</b> — {fmtUSD(projected - budget)} over your {fmtUSD(budget)} budget.</> });
  } else {
    out.push({ type: "good", icon: "check",
      text: <>{month.isPartial ? "On pace to stay" : "Stayed"} under budget by <b>{fmtUSD(budget - projected)}</b>.</> });
  }

  // worst category over its own budget (pace-aware in the current month)
  let worst: { name: string; proj: number; b: number } | null = null;
  for (const cid of Object.keys(catBudgets)) {
    const b = catBudgets[cid];
    if (!b || !catById[cid]) continue;
    const cur = month.byCat[cid] || 0;
    const proj = month.isPartial ? (cur / month.lastDay) * month.daysInMonth : cur;
    if (proj > b && (!worst || proj - b > worst.proj - worst.b)) worst = { name: catById[cid].name, proj, b };
  }
  if (worst) {
    out.push({ type: "warn", icon: "alert",
      text: <><b>{worst.name}</b> is {month.isPartial ? "on pace for" : "at"} {fmtUSD(worst.proj)} — {fmtUSD(worst.proj - worst.b)} over its {fmtUSD(worst.b)} budget.</> });
  }

  // largest single expense
  if (month.transactions.length) {
    const big = [...month.transactions].sort((a, b) => b.amount - a.amount)[0];
    out.push({ type: "info", icon: "star",
      text: <>Largest expense: <b>{big.merchant}</b> — {fmtUSD(big.amount, true)}{catById[big.cat] ? ` · ${catById[big.cat].name}` : ""}.</> });
  }

  // most frequent merchant (null-proto: merchant names are user text)
  const freq: Record<string, number> = Object.create(null);
  month.transactions.forEach((tx) => { freq[tx.merchant] = (freq[tx.merchant] || 0) + 1; });
  const topM = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (topM && topM[1] >= 3) {
    out.push({ type: "info", icon: "repeat",
      text: <>Most frequent: <b>{topM[0]}</b> — {topM[1]} visits this month.</> });
  }

  return out.slice(0, 4);
}

export function Insights({ month, months, idx, catById, budget, catBudgets }: InsightsProps) {
  const items = useMemo(() => computeInsights({ month, months, idx, catById, budget, catBudgets }), [month, months, idx, catById, budget, catBudgets]);
  if (!items.length) return null;
  return (
    <section className="card span-insights">
      <div className="card-head">
        <div>
          <h2>Insights</h2>
          <p className="card-sub">What stands out in {month.shortLabel} {month.year}</p>
        </div>
      </div>
      <div className="insights-grid">
        {items.map((it, i) => (
          <div key={i} className={"insight " + it.type}>
            <span className="insight-icon"><InsightIcon kind={it.icon} /></span>
            <span className="insight-text">{it.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
