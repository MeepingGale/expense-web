/* Chart + viz components. SVG-based, theme-driven via CSS vars. */
import React, { useState } from "react";
import { catColor, fmtUSD, fmtCompact } from "../data/format";
import type { MonthData, CategoryId, Settings } from "../types";

interface TrendChartProps {
  months: MonthData[]; selectedIndex: number; onSelect: (i: number) => void;
  accent: string; mode: Settings["trendMode"]; budget: number;
}
interface DonutSlice { id: CategoryId; name: string; hue: number; amount: number; }
interface CategoryDonutProps {
  items: DonutSlice[]; total: number;
  hovered: CategoryId | null; onHover: (id: CategoryId | null) => void;
}
interface HeatmapProps {
  month: MonthData; selectedDay: number | null; onSelectDay: (day: number | null) => void;
}

// ───────────────────────── Trend chart (12 months) ─────────────────────────
// Fixed design-coordinate SVG stretched to fill via preserveAspectRatio="none".
// No pixel measurement (rAF/ResizeObserver are unreliable in-preview), so it paints immediately.
export function TrendChart({ months, selectedIndex, onSelect, accent, mode, budget }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const DW = 1000, DH = 400, padT = 18, padB = 6;
  const innerH = DH - padT - padB;
  const vals = months.map((m) => m.total);
  const max = Math.max(budget * 1.05, ...vals) || 1;
  const y = (v: number) => padT + innerH * (1 - v / max);
  const band = months.length ? DW / months.length : 0;
  const xc = (i: number) => band * i + band / 2;
  const pctX = (i: number) => (xc(i) / DW) * 100;
  const pctY = (v: number) => (y(v) / DH) * 100;

  const linePts = months.map((m, i) => [xc(i), y(m.total)]);
  const pathD = linePts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const areaD = pathD + ` L${linePts[linePts.length - 1][0].toFixed(1)} ${padT + innerH} L${linePts[0][0].toFixed(1)} ${padT + innerH} Z`;

  return (
    <div className="chart-wrap chart-fill trend-wrap">
      <div className="trend-plot">
        <svg className="trend-svg" viewBox={`0 0 ${DW} ${DH}`} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="0" x2={DW} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)}
              stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {budget > 0 && (
            <line x1="0" x2={DW} y1={y(budget)} y2={y(budget)} stroke="var(--text-faint)" strokeWidth="1"
              strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          )}
          {mode === "area" && (
            <>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#trendFill)" />
            </>
          )}
          {(mode === "line" || mode === "area") && (
            <path d={pathD} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {months.map((m, i) => {
            const isSel = i === selectedIndex, isHover = hover === i;
            const bw = band * 0.56, bx = xc(i) - bw / 2, top = y(m.total);
            const po = m.isPartial ? 0.55 : 1;
            return (
              <g key={m.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                 onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
                <rect x={band * i} y={0} width={band} height={DH} fill="transparent" />
                {mode === "bars" ? (
                  <rect x={bx} y={top} width={bw} height={padT + innerH - top} rx="6"
                    fill={isSel ? accent : "var(--bar)"} opacity={isSel ? po : isHover ? 0.85 : 0.55}
                    style={{ transition: "y .35s cubic-bezier(.3,.8,.3,1), height .35s cubic-bezier(.3,.8,.3,1), fill .2s, opacity .2s" }} />
                ) : (
                  <circle cx={xc(i)} cy={top} r={isSel ? 7 : isHover ? 6 : 4}
                    fill={isSel ? accent : "var(--card)"} stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                )}
              </g>
            );
          })}
        </svg>
        {budget > 0 && (
          <span className="trend-budget-label" style={{ top: `calc(${pctY(budget)}% - 15px)` }}>budget {fmtCompact(budget)}</span>
        )}
        {hover != null && (
          <div className={"chart-tip trend-tip" + (pctX(hover) > 72 ? " flip-l" : pctX(hover) < 12 ? " flip-r" : "")}
            style={{ left: pctX(hover) + "%", top: pctY(months[hover].total) + "%" }}>
            <div className="tip-title">{months[hover].label}{months[hover].isPartial ? " · so far" : ""}</div>
            <div className="tip-big">{fmtUSD(months[hover].total)}</div>
            <div className="tip-sub">{months[hover].transactions.length} transactions</div>
          </div>
        )}
      </div>
      <div className="trend-xaxis">
        {months.map((m, i) => (
          <button key={m.key} className={"trend-xtick" + (i === selectedIndex ? " is-sel" : "")}
            onClick={() => onSelect(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="trend-xname">{m.shortLabel}</span>
            {m.month === 0 && <span className="trend-xyear">{m.year}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Category donut ─────────────────────────
export function CategoryDonut({ items, total, hovered, onHover }: CategoryDonutProps) {
  const size = 188, stroke = 26, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const gap = 0.012; // fraction gap between segments
  const active = hovered ? items.find((it) => it.id === hovered) : null;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {items.map((it) => {
            const frac = it.amount / total;
            const len = Math.max(0, (frac - gap) * circ);
            const dash = `${len} ${circ - len}`;
            const offset = -acc * circ;
            acc += frac;
            const dim = hovered && hovered !== it.id;
            return (
              <circle key={it.id} cx={cx} cy={cy} r={r} fill="none"
                stroke={catColor(it.hue)} strokeWidth={hovered === it.id ? stroke + 5 : stroke}
                strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="butt"
                opacity={dim ? 0.32 : 1}
                onMouseEnter={() => onHover(it.id)} onMouseLeave={() => onHover(null)}
                style={{ transition: "opacity .2s, stroke-width .15s", cursor: "pointer" }} />
            );
          })}
        </g>
        <text x={cx} y={cy - 6} textAnchor="middle" className="donut-center-label">
          {active ? active.name : "Total spent"}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="donut-center-value">
          {active ? fmtUSD(active.amount) : fmtUSD(total)}
        </text>
        {active && (
          <text x={cx} y={cy + 36} textAnchor="middle" className="donut-center-pct">
            {Math.round((active.amount / total) * 100)}% of spend
          </text>
        )}
      </svg>
    </div>
  );
}

// ───────────────────────── Calendar (daily spending) ─────────────────────────
export function Heatmap({ month, selectedDay, onSelectDay }: HeatmapProps) {
  const first = month.firstWeekday; // 0 Sun
  const days = month.daysInMonth;
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const maxDay = Math.max(1, ...Object.values(month.byDay));
  const txByDay: Record<number, number> = {};
  month.transactions.forEach((t) => (txByDay[t.day] = (txByDay[t.day] || 0) + 1));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const intensity = (v: number) => (v ? 0.2 + 0.8 * Math.pow(v / maxDay, 0.6) : 0);

  return (
    <div className="cal-wrap">
      <div className="cal-weekdays">
        {weekdays.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} className="cal-empty" />;
          const v = month.byDay[d] || 0;
          const future = month.isCurrent && d > month.lastDay;
          const isToday = month.isCurrent && d === month.lastDay;
          const isSel = selectedDay === d;
          const n = txByDay[d] || 0;
          return (
            <button key={i} type="button" disabled={future}
              className={"cal-cell" + (future ? " is-future" : "") + (isToday ? " is-today" : "") + (isSel ? " is-sel" : "") + (v > 0 ? " has-spend" : "")}
              onClick={() => onSelectDay(isSel ? null : d)}
              title={v > 0 ? `${month.shortLabel} ${d} · ${fmtUSD(v)} · ${n} item${n !== 1 ? "s" : ""}` : `${month.shortLabel} ${d}`}>
              <span className="cal-top">
                <span className="cal-num">{d}</span>
                {isToday && <span className="cal-today">Today</span>}
              </span>
              {v > 0 && (
                <span className="cal-spend">
                  <span className="cal-amt">{fmtCompact(v)}</span>
                  <span className="cal-bar"><span style={{ width: intensity(v) * 100 + "%" }} /></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
