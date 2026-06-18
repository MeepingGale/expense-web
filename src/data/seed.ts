import type { Category, CategoryId, ExpenseData, MonthData, Transaction } from "../types";

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

export function buildSeed(): ExpenseData {
  function mulberry32(a: number) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CATEGORIES: Category[] = [
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

  const MERCHANTS: Record<string, string[]> = {
    housing:   ["Maple Street Apartments"],
    groceries: ["Whole Foods", "Trader Joe's", "Safeway", "Corner Market", "Costco"],
    dining:    ["Blue Bottle", "Tacos El Sol", "Sushi Nori", "The Smoke House", "Olive & Vine", "Ramen Yama", "Pizzeria Bianco", "Night Owl Bar"],
    transport: ["Uber", "Lyft", "Metro Card", "Shell", "Chevron", "City Parking"],
    shopping:  ["Amazon", "Uniqlo", "IKEA", "Best Buy", "Nike", "Muji"],
    utilities: ["PG&E", "City Water", "Comcast", "AT&T Mobile"],
    health:    ["CVS Pharmacy", "FitClub Gym", "Dr. Reyes Clinic", "Walgreens"],
    fun:       ["AMC Theatres", "Steam", "Live Nation", "Bowlero", "MoMA"],
    subs:      ["Netflix", "Spotify", "iCloud+", "NYT", "Adobe CC", "ChatGPT Plus"],
  };

  function money(rng: () => number, lo: number, hi: number): number {
    return Math.round((lo + rng() * (hi - lo)) * 100) / 100;
  }
  function pick(rng: () => number, arr: string[]): string {
    return arr[Math.floor(rng() * arr.length)];
  }

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Build 12 months ending at June 2026 (index 5, year 2026).
  const months: { year: number; month: number }[] = [];
  const endYear = 2026, endMonth = 5; // June
  for (let i = 11; i >= 0; i--) {
    let m = endMonth - i, y = endYear;
    while (m < 0) { m += 12; y -= 1; }
    months.push({ year: y, month: m });
  }

  const today = new Date(2026, 5, 8); // June 8, 2026

  const data: MonthData[] = months.map((mo) => {
    const rng = mulberry32((mo.year * 100 + mo.month) * 7919 + 13);
    const daysInMonth = new Date(mo.year, mo.month + 1, 0).getDate();
    const isCurrent = mo.year === today.getFullYear() && mo.month === today.getMonth();
    const lastDay = isCurrent ? today.getDate() : daysInMonth;
    const seasonal = 1 + 0.16 * Math.sin((mo.month / 12) * Math.PI * 2 - 1) + (mo.month === 11 ? 0.22 : 0); // Dec bump
    const tx: Transaction[] = [];
    let uid = 0;
    const catEssential: Record<string, boolean> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.essential]));
    const add = (day: number, catId: string, amount: number, merchant: string, recurId?: string) => {
      if (day < 1 || day > lastDay) return;
      const base = catEssential[catId];
      const need = rng() < 0.12 ? !base : base; // ~12% deviate from category default
      tx.push({ id: `${mo.year}-${mo.month}-${uid++}`, day, cat: catId, amount, merchant, need, recurId: recurId || null });
    };

    // Housing — 1st of month
    add(1, "housing", 1650, MERCHANTS.housing[0], "rent");
    // Subscriptions — fixed recurring on set days
    ([ ["Netflix", 5, 15.49], ["Spotify", 8, 11.99], ["iCloud+", 10, 2.99], ["Adobe CC", 12, 22.99], ["ChatGPT Plus", 18, 20], ["NYT", 22, 4] ] as [string, number, number][]).forEach(([name, day, amt]) => add(day, "subs", amt, name, "sub-" + name));
    // Utilities — a few bills
    add(6, "utilities", money(rng, 70, 130), "PG&E");
    add(14, "utilities", money(rng, 35, 60), "City Water");
    add(16, "utilities", money(rng, 60, 85), "Comcast");
    add(20, "utilities", 55, "AT&T Mobile");
    // Groceries — ~weekly
    const groceryTrips = 5 + Math.floor(rng() * 3);
    for (let g = 0; g < groceryTrips; g++) add(2 + Math.floor(rng() * (daysInMonth - 2)), "groceries", money(rng, 35, 145) * seasonal, pick(rng, MERCHANTS.groceries));
    // Dining — frequent
    const diningTrips = 9 + Math.floor(rng() * 8);
    for (let d = 0; d < diningTrips; d++) add(1 + Math.floor(rng() * daysInMonth), "dining", money(rng, 11, 68) * seasonal, pick(rng, MERCHANTS.dining));
    // Transport
    const transTrips = 6 + Math.floor(rng() * 7);
    for (let t = 0; t < transTrips; t++) add(1 + Math.floor(rng() * daysInMonth), "transport", money(rng, 6, 48), pick(rng, MERCHANTS.transport));
    // Shopping — occasional, sometimes a big one
    const shopTrips = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < shopTrips; s++) add(1 + Math.floor(rng() * daysInMonth), "shopping", money(rng, 18, 160) * seasonal, pick(rng, MERCHANTS.shopping));
    if (rng() > 0.5) add(1 + Math.floor(rng() * daysInMonth), "shopping", money(rng, 180, 420) * seasonal, pick(rng, MERCHANTS.shopping));
    // Health
    if (rng() > 0.4) add(1 + Math.floor(rng() * daysInMonth), "health", money(rng, 18, 130), pick(rng, MERCHANTS.health));
    add(3, "health", 39, "FitClub Gym", "gym");
    // Entertainment
    const funTrips = 2 + Math.floor(rng() * 4);
    for (let f = 0; f < funTrips; f++) add(1 + Math.floor(rng() * daysInMonth), "fun", money(rng, 12, 75), pick(rng, MERCHANTS.fun));

    tx.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));

    const byCat: Record<string, number> = {};
    CATEGORIES.forEach((c) => (byCat[c.id] = 0));
    const byDay: Record<number, number> = {};
    let total = 0;
    tx.forEach((t) => {
      byCat[t.cat] += t.amount;
      byDay[t.day] = (byDay[t.day] || 0) + t.amount;
      total += t.amount;
    });

    return {
      key: `${mo.year}-${String(mo.month + 1).padStart(2, "0")}`,
      year: mo.year,
      month: mo.month,
      label: `${MONTH_NAMES[mo.month]} ${mo.year}`,
      shortLabel: MONTH_NAMES[mo.month].slice(0, 3),
      daysInMonth,
      lastDay,
      isCurrent,
      firstWeekday: new Date(mo.year, mo.month, 1).getDay(), // 0 = Sun
      transactions: tx,
      byCat,
      byDay,
      total: Math.round(total * 100) / 100,
      isPartial: isCurrent && lastDay < daysInMonth,
    };
  });

  return {
    categories: CATEGORIES,
    catById: Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>,
    months: data,
    today,
    monthlyBudget: 3800,
    currentIndex: data.length - 1,
    recurring: [
      { id: "rent",             merchant: "Maple Street Apartments", cat: "housing", amount: 1650,  day: 1,  need: true  },
      { id: "gym",              merchant: "FitClub Gym",             cat: "health",  amount: 39,    day: 3,  need: true  },
      { id: "sub-Netflix",      merchant: "Netflix",                 cat: "subs",    amount: 15.49, day: 5,  need: false },
      { id: "sub-Spotify",      merchant: "Spotify",                 cat: "subs",    amount: 11.99, day: 8,  need: false },
      { id: "sub-iCloud+",      merchant: "iCloud+",                 cat: "subs",    amount: 2.99,  day: 10, need: false },
      { id: "sub-Adobe CC",     merchant: "Adobe CC",                cat: "subs",    amount: 22.99, day: 12, need: false },
      { id: "sub-ChatGPT Plus", merchant: "ChatGPT Plus",            cat: "subs",    amount: 20,    day: 18, need: false },
      { id: "sub-NYT",          merchant: "NYT",                     cat: "subs",    amount: 4,     day: 22, need: false },
    ],
  };
}
