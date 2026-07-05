import type { Category, CategoryId, ExpenseData, MonthData, RecurringItem } from "../types";
import { MONTHS } from "./constants";

export function recompute(
  month: Omit<MonthData, "byCat" | "byDay" | "total">,
  categories: Category[],
): MonthData {
  // Null-prototype maps: category ids come from user-entered names ("Constructor"
  // slugs to "constructor"), which on a plain object would hit inherited keys.
  const byCat: Record<CategoryId, number> = Object.create(null);
  categories.forEach((c) => (byCat[c.id] = 0));
  const byDay: Record<number, number> = Object.create(null);
  let total = 0;
  month.transactions.forEach((t) => {
    byCat[t.cat] = (byCat[t.cat] ?? 0) + t.amount;
    byDay[t.day] = (byDay[t.day] ?? 0) + t.amount;
    total += t.amount;
  });
  return { ...month, byCat, byDay, total: Math.round(total * 100) / 100 };
}

// Default starter categories. These are a usable taxonomy, not sample data — a
// fresh ledger needs at least one category so the Add-expense flow has
// something to select. Users can add/remove these in the Categories tab.
const DEFAULT_CATEGORIES: Category[] = [
  { id: "housing",    name: "Housing",       hue: 222, subs: [] },
  { id: "groceries",  name: "Groceries",     hue: 152, subs: [] },
  { id: "dining",     name: "Dining & Bars", hue: 22,  subs: [] },
  { id: "transport",  name: "Transport",     hue: 280, subs: [] },
  { id: "shopping",   name: "Shopping",      hue: 330, subs: [] },
  { id: "utilities",  name: "Utilities",     hue: 196, subs: [] },
  { id: "health",     name: "Health",        hue: 8,   subs: [] },
  { id: "fun",        name: "Entertainment", hue: 48,  subs: [] },
  { id: "subs",       name: "Subscriptions", hue: 258, subs: [] },
];

// Materialize recurring charges that have come due. Historically a recurring
// item only wrote a transaction when it was created or resumed, so a new
// month never received its charges. For each active item, every month after
// its first posted month (or the current month, for items that never posted)
// gets the charge once its day has arrived — bounded by endKey, at most once
// per month. Runs on load; a tab left open across midnight catches up on the
// next reload.
export function postDueRecurring(
  months: MonthData[],
  recurring: RecurringItem[],
  categories: Category[],
): MonthData[] {
  const active = recurring.filter((r) => r.active);
  if (!active.length || !months.length) return months;
  const currentKey = months.find((m) => m.isCurrent)?.key ?? months[months.length - 1].key;
  // first month that already has this item's charge — the posting anchor
  const anchorOf = (id: string) => months.find((m) => m.transactions.some((t) => t.recurId === id))?.key;
  let changed = false;
  const next = months.map((m) => {
    if (m.key > currentKey) return m;
    let tx = m.transactions;
    active.forEach((r) => {
      const anchor = anchorOf(r.id);
      if (anchor ? m.key <= anchor : m.key !== currentKey) return;
      if (r.endKey && m.key > r.endKey) return;
      // ponytail: day 31 items skip 30-day months (same rule as manual posting);
      // clamp-to-last-day if that ever matters
      if (r.day > m.lastDay) return;
      if (tx.some((t) => t.recurId === r.id)) return;
      tx = [...tx, {
        id: `tx-${m.key}-${r.id}-auto`, day: r.day, cat: r.cat, subcat: r.subcat ?? null,
        amount: r.amount, merchant: r.merchant, need: r.need, attachments: [], recurId: r.id, _new: true,
      }];
    });
    if (tx === m.transactions) return m;
    changed = true;
    return recompute({ ...m, transactions: tx }, categories);
  });
  return changed ? next : months;
}

// Contiguous empty months from `from` to `to` (inclusive). recompute()
// zero-fills byCat / byDay / total for the empty transaction lists.
export function monthScaffold(
  from: { year: number; month: number },
  to: { year: number; month: number },
  today: Date,
  categories: Category[],
): MonthData[] {
  const out: MonthData[] = [];
  let y = from.year, m = from.month;
  while (y < to.year || (y === to.year && m <= to.month)) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const isCurrent = y === today.getFullYear() && m === today.getMonth();
    const lastDay = isCurrent ? today.getDate() : daysInMonth;
    out.push(recompute(
      {
        key: `${y}-${String(m + 1).padStart(2, "0")}`,
        year: y,
        month: m,
        label: `${MONTHS[m]} ${y}`,
        shortLabel: MONTHS[m].slice(0, 3),
        daysInMonth,
        lastDay,
        isCurrent,
        firstWeekday: new Date(y, m, 1).getDay(), // 0 = Sun
        transactions: [],
        isPartial: isCurrent && lastDay < daysInMonth,
      },
      categories,
    ));
    if (m === 11) { m = 0; y += 1; } else { m += 1; }
  }
  return out;
}

// Builds the initial ledger state: an empty 12-month scaffold ending at the
// current month plus default categories. There is no sample data — the ledger
// opens clean and the user enters their own expenses. (App widens the scaffold
// to cover older stored months on load.)
export function buildSeed(today: Date = new Date()): ExpenseData {
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const data = monthScaffold(
    { year: from.getFullYear(), month: from.getMonth() },
    { year: today.getFullYear(), month: today.getMonth() },
    today,
    DEFAULT_CATEGORIES,
  );
  return {
    categories: DEFAULT_CATEGORIES,
    months: data,
    today,
    monthlyBudget: 3800,
    currentIndex: data.length - 1,
    recurring: [],
  };
}
