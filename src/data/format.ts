import type { Currency } from "../types";
import { CURRENCIES } from "./constants";

// date helpers (from legacy/app.jsx lines 56–58, 895)
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDateInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
};
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// category color (from legacy/charts.jsx line 21)
export const catColor = (hue: number, l = 0.68, c = 0.15) => `oklch(${l} ${c} ${hue})`;

// currency formatting — stateful singleton, faithful to legacy/charts.jsx lines 13–20
let _cur: Currency = CURRENCIES[0];
export function setLedgerCurrency(code: string): void {
  const c = CURRENCIES.find((x) => x.code === code);
  if (c) _cur = c;
}
// Current currency symbol — for amount-input prefixes so they track the
// selected currency (display only; never converts the underlying value).
export const currencySymbol = (): string => _cur.symbol;
export const fmtUSD = (n: number, cents?: boolean): string => {
  const d = _cur.decimals === 0 ? 0 : cents ? 2 : 0;
  return _cur.symbol + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
export const fmtCompact = (n: number): string => {
  if (n >= 1_000_000) return _cur.symbol + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1000) return _cur.symbol + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return _cur.symbol + Math.round(n);
};

// Group the integer part of a raw numeric input string with thousands commas,
// preserving any decimal portion (and a trailing ".") so it works while typing.
// Display-only: callers keep the un-grouped digits in state.
export function groupDigits(raw: string): string {
  if (!raw) return "";
  const dot = raw.indexOf(".");
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const rest = dot === -1 ? "" : raw.slice(dot);
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + rest;
}
