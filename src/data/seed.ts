import type { Category, CategoryId, ExpenseData, MonthData } from "../types";

export function recompute(
  month: Omit<MonthData, "byCat" | "byDay" | "total">,
  categories: Category[],
): MonthData {
  const byCat: Record<CategoryId, number> = {};
  categories.forEach((c) => (byCat[c.id] = 0));
  const byDay: Record<number, number> = {};
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
  { id: "housing",    name: "Housing",       hue: 222, essential: true  },
  { id: "groceries",  name: "Groceries",     hue: 152, essential: true  },
  { id: "dining",     name: "Dining & Bars", hue: 22,  essential: false },
  { id: "transport",  name: "Transport",     hue: 280, essential: true  },
  { id: "shopping",   name: "Shopping",      hue: 330, essential: false },
  { id: "utilities",  name: "Utilities",     hue: 196, essential: true  },
  { id: "health",     name: "Health",        hue: 8,   essential: true  },
  { id: "fun",        name: "Entertainment", hue: 48,  essential: false },
  { id: "subs",       name: "Subscriptions", hue: 258, essential: false },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Builds the initial ledger state: an empty 12-month scaffold ending June 2026
// plus default categories. There is no sample data — every month starts with
// zero transactions and there are no recurring items, so the ledger opens
// clean and the user enters their own expenses.
export function buildSeed(today: Date = new Date()): ExpenseData {
  // 12 consecutive months ending at the current (real) month — index 11.
  const months: { year: number; month: number }[] = [];
  const endYear = today.getFullYear(), endMonth = today.getMonth();
  for (let i = 11; i >= 0; i--) {
    let m = endMonth - i, y = endYear;
    while (m < 0) { m += 12; y -= 1; }
    months.push({ year: y, month: m });
  }

  const data: MonthData[] = months.map((mo) => {
    const daysInMonth = new Date(mo.year, mo.month + 1, 0).getDate();
    const isCurrent = mo.year === today.getFullYear() && mo.month === today.getMonth();
    const lastDay = isCurrent ? today.getDate() : daysInMonth;
    // recompute() zero-fills byCat, empties byDay, and sets total to 0 for the
    // empty transaction list — no need to duplicate that aggregation here.
    return recompute(
      {
        key: `${mo.year}-${String(mo.month + 1).padStart(2, "0")}`,
        year: mo.year,
        month: mo.month,
        label: `${MONTH_NAMES[mo.month]} ${mo.year}`,
        shortLabel: MONTH_NAMES[mo.month].slice(0, 3),
        daysInMonth,
        lastDay,
        isCurrent,
        firstWeekday: new Date(mo.year, mo.month, 1).getDay(), // 0 = Sun
        transactions: [],
        isPartial: isCurrent && lastDay < daysInMonth,
      },
      DEFAULT_CATEGORIES,
    );
  });

  return {
    categories: DEFAULT_CATEGORIES,
    catById: Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>,
    months: data,
    today,
    monthlyBudget: 3800,
    currentIndex: data.length - 1,
    recurring: [],
  };
}
