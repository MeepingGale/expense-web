import type { RecurringItem, StoredStateV4, Transaction } from "../types";
import { buildSeed } from "./seed";
import { DEFAULT_SETTINGS } from "./storage";

// Separate key so demo mode never touches the real blob's schema; cleared
// together with the blob when the user starts fresh.
export const DEMO_FLAG_KEY = "ledger-demo";

// Deterministic PRNG — same seed, same ledger, so the demo (and its test) is
// reproducible and the generated blob never churns between loads.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [merchant, min RM, max RM, need]
type Shop = [string, number, number, boolean];
const SHOPS: Record<string, { count: [number, number]; shops: Shop[] }> = {
  groceries: { count: [7, 9], shops: [
    ["Jaya Grocer", 45, 180, true], ["Lotus's", 35, 140, true], ["99 Speedmart", 8, 45, true],
    ["Village Grocer", 50, 190, true], ["FamilyMart", 6, 25, true],
  ] },
  dining: { count: [9, 13], shops: [
    ["Nasi Kandar Pelita", 9, 28, false], ["Tealive", 8, 17, false], ["ZUS Coffee", 9, 18, false],
    ["Sushi King", 25, 70, false], ["McDonald's", 12, 35, false], ["OldTown White Coffee", 12, 30, false],
  ] },
  transport: { count: [7, 10], shops: [
    ["Grab", 8, 38, true], ["Touch 'n Go", 10, 60, true], ["Petronas", 40, 120, true],
    ["Shell", 40, 110, true], ["KTM Komuter", 3, 12, true],
  ] },
  shopping: { count: [2, 4], shops: [
    ["Shopee", 20, 180, false], ["Uniqlo", 39, 180, false], ["Mr DIY", 8, 60, false], ["Watsons", 15, 80, false],
  ] },
  health: { count: [0, 2], shops: [["Klinik Mediviron", 40, 120, true], ["Guardian", 12, 70, true]] },
  fun: { count: [1, 3], shops: [["GSC Cinemas", 18, 55, false], ["Steam", 15, 90, false], ["Bowlero", 40, 80, false]] },
};

const RECURRING: (Omit<RecurringItem, "id"> & { id: string })[] = [
  { id: "demo-rent", merchant: "Rental — Casa Green", cat: "housing", subcat: null, amount: 1600, day: 1, need: true, active: true },
  { id: "demo-unifi", merchant: "Unifi Home", cat: "utilities", subcat: null, amount: 129, day: 8, need: true, active: true },
  { id: "demo-maxis", merchant: "Maxis Postpaid", cat: "utilities", subcat: null, amount: 88, day: 18, need: true, active: true },
  { id: "demo-netflix", merchant: "Netflix", cat: "subs", subcat: null, amount: 54.9, day: 3, need: false, active: true },
  { id: "demo-spotify", merchant: "Spotify", cat: "subs", subcat: null, amount: 23.9, day: 15, need: false, active: true },
];

// A full v4 blob: 12 months of plausible MYR spending ending at `today`
// (current month partial). Loaded via the normal storage boot path, so it
// goes through the same shape guards and month-widening as real data.
export function buildDemoState(today: Date = new Date()): StoredStateV4 {
  const scaffold = buildSeed(today);
  const txByMonth: Record<string, Transaction[]> = {};

  scaffold.months.forEach((m) => {
    const rng = mulberry32((m.year * 100 + m.month) * 7919 + 41);
    const lastDay = m.isCurrent ? today.getDate() : m.daysInMonth;
    const tx: Transaction[] = [];

    RECURRING.forEach((r) => {
      if (r.day > lastDay) return;
      tx.push({ id: `tx-${m.key}-${r.id}`, day: r.day, cat: r.cat, subcat: null,
        amount: r.amount, merchant: r.merchant, need: r.need, recurId: r.id, attachments: [] });
    });

    // electricity varies month to month; not a fixed recurring item
    const tnbDay = 12 + Math.floor(rng() * 4);
    if (tnbDay <= lastDay) {
      tx.push({ id: `tx-${m.key}-tnb`, day: tnbDay, cat: "utilities", subcat: null,
        amount: Math.round((90 + rng() * 70) * 100) / 100, merchant: "TNB", need: true, recurId: null, attachments: [] });
    }

    Object.entries(SHOPS).forEach(([cat, { count, shops }]) => {
      const n = count[0] + Math.floor(rng() * (count[1] - count[0] + 1));
      for (let i = 0; i < n; i++) {
        const [merchant, lo, hi, need] = shops[Math.floor(rng() * shops.length)];
        tx.push({
          id: `tx-${m.key}-${cat}-${i}`,
          day: 1 + Math.floor(rng() * lastDay),
          cat, subcat: null,
          amount: Math.round((lo + rng() * (hi - lo)) * 100) / 100,
          merchant, need, recurId: null, attachments: [],
        });
      }
    });

    txByMonth[m.key] = tx;
  });

  return {
    v: 4,
    txByMonth,
    categories: scaffold.categories,
    recurring: RECURRING.map((r) => ({ ...r })),
    budget: 3800,
    catBudgets: { groceries: 700, dining: 600 },
    currency: "MYR",
    settings: { ...DEFAULT_SETTINGS },
  };
}
