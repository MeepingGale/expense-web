/* Main dashboard app — wires every ported module together. */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import type {
  AddExpensePayload,
  Category,
  CategoryId,
  MonthData,
  RecurringItem,
  SetSetting,
  Settings,
  Transaction,
} from "./types";
import { buildSeed, recompute, monthScaffold, postDueRecurring } from "./data/seed";
import { load, save, DEFAULT_SETTINGS, STORAGE_KEY } from "./data/storage";
import { catColor, fmtUSD, setLedgerCurrency, pad2, toDateInput, ordinal } from "./data/format";
import { CURRENCIES, WEEKDAYS } from "./data/constants";
import { Delta, Paperclip, KpiCard, ThemeMenu, TxDetail, AddExpense } from "./components/common";
import { TrendChart, CategoryDonut, Heatmap } from "./components/Charts";
import { Transactions } from "./components/Transactions";
import { CategoriesView } from "./components/CategoriesView";
import { RecurringView, AddRecurring } from "./components/RecurringView";
import { BulkAdd } from "./components/BulkAdd";
import { Insights } from "./components/Insights";
import { ExportMenu, PrintReport } from "./components/Export";
import { SettingsView } from "./components/SettingsView";

// What BulkAdd.onInsert / routeInsert work with.
interface InsertItem {
  year: number;
  month: number; // 0-indexed
  day: number;
  cat: CategoryId;
  subcat?: string | null;
  amount: number;
  merchant: string;
  need: boolean;
  attachments?: Transaction["attachments"];
  recurId?: string | null;
}

export default function App() {
  const EXPENSE = useMemo(() => buildSeed(), []);
  const stored = useMemo(() => load(), []);

  const [t, setT] = useState<Settings>(stored?.settings ?? DEFAULT_SETTINGS);
  const setTweak = useCallback<SetSetting>((key, value) =>
    setT((prev) => ({ ...prev, [key]: value })), []);

  // "auto" theme follows the OS scheme; resolve to a concrete theme for the DOM
  const [sysDark, setSysDark] = useState<boolean>(() =>
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const resolvedTheme = t.theme === "auto" ? (sysDark ? "dark" : "light") : t.theme;

  // Initial months: the seed's trailing-12 scaffold, widened backward to the
  // earliest stored month that has transactions — old data must never silently
  // age out of the window — then merged with the stored transactions.
  const initialMonths = useMemo<MonthData[]>(() => {
    const cats = stored?.categories ?? EXPENSE.categories;
    let scaffold = EXPENSE.months;
    const earliest = Object.entries(stored?.txByMonth ?? {})
      .filter(([, txs]) => (txs?.length ?? 0) > 0)
      .map(([k]) => k)
      .sort()[0];
    if (earliest && earliest < scaffold[0].key) {
      const [y, m] = earliest.split("-").map(Number);
      const last = scaffold[scaffold.length - 1];
      scaffold = monthScaffold({ year: y, month: m - 1 }, { year: last.year, month: last.month }, EXPENSE.today, cats);
    }
    return scaffold.map((m) =>
      recompute({ ...m, transactions: stored?.txByMonth?.[m.key] ?? m.transactions }, cats),
    );
  }, [EXPENSE, stored]);

  const [months, setMonths] = useState<MonthData[]>(initialMonths);
  const [idx, setIdx] = useState<number>(initialMonths.length - 1);

  // materialize recurring charges that came due since the last visit
  // (mount-only: initial recurring/categories are what the blob loaded)
  useEffect(() => {
    setMonths((prev) => postDueRecurring(prev, recurring, categories));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [hoverCat, setHoverCat] = useState<CategoryId | null>(null);
  const [filterCat, setFilterCat] = useState<CategoryId | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const [bulk, setBulk] = useState<boolean>(false);
  const [addingRecurring, setAddingRecurring] = useState<boolean>(false);
  const [editingRec, setEditingRec] = useState<RecurringItem | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [view, setView] = useState<string>("overview");
  const [categories, setCategories] = useState<Category[]>(
    stored?.categories ?? EXPENSE.categories.map((c) => ({ ...c })),
  );
  const [recurring, setRecurring] = useState<RecurringItem[]>(
    stored?.recurring ?? EXPENSE.recurring.map((r) => ({ ...r, active: true })),
  );
  const [viewerTx, setViewerTx] = useState<Transaction | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [txPage, setTxPage] = useState<number>(0);
  const [budget, setBudget] = useState<number>(stored?.budget ?? EXPENSE.monthlyBudget);
  const [catBudgets, setCatBudgets] = useState<Record<string, number>>(() =>
    Object.assign(Object.create(null), stored?.catBudgets));
  const [currency, setCurrency] = useState<string>(stored?.currency ?? "USD");
  const [saveFailed, setSaveFailed] = useState<boolean>(false);

  const setCatBudget = (id: CategoryId, v: number | null) => setCatBudgets((prev) => {
    const next: Record<string, number> = Object.assign(Object.create(null), prev);
    if (v && v > 0) next[id] = v; else delete next[id];
    return next;
  });

  const catById = useMemo(() => {
    const map: Record<CategoryId, Category> = Object.create(null); // user-derived ids — avoid inherited keys
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  // merchant memory: most-recent categorization per merchant, for autocomplete
  // + prefill in the add flows (later months win — they're later in the array)
  const merchantIndex = useMemo(() => {
    const map: Record<string, { cat: CategoryId; subcat: string | null; need: boolean }> = Object.create(null);
    months.forEach((m) => m.transactions.forEach((tx) => {
      const k = tx.merchant.trim().toLowerCase();
      if (k) map[k] = { cat: tx.cat, subcat: tx.subcat ?? null, need: tx.need };
    }));
    return map;
  }, [months]);
  const merchantNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    months.forEach((m) => m.transactions.forEach((tx) => {
      const n = tx.merchant.trim();
      if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); names.push(n); }
    }));
    return names.sort((a, b) => a.localeCompare(b));
  }, [months]);

  const month = months[idx];
  const prev = idx > 0 ? months[idx - 1] : null;

  // year view: the scaffold can span years ("grows with your data"), so the
  // picker jumps between them and the trend chart is scoped to the selected
  // month's year instead of cramming every month into one chart
  const years = useMemo(() => [...new Set(months.map((m) => m.year))], [months]);
  const yearMonths = useMemo(() => months.filter((m) => m.year === month.year), [months, month.year]);
  const yearSelIdx = yearMonths.findIndex((m) => m.key === month.key);
  const selectYearMonth = (i: number) => {
    const gi = months.findIndex((m) => m.key === yearMonths[i]?.key);
    if (gi >= 0) setIdx(gi);
  };
  const jumpToYear = (y: number) => {
    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i].year === y) { setIdx(i); return; } // latest month of that year
    }
  };

  // Keep format.ts's currency singleton in sync BEFORE children render — an
  // effect runs after the pass, so everything rendered alongside a currency
  // change (KPIs, chart labels) would show the previous symbol. Idempotent,
  // so React strict-mode double renders are harmless.
  setLedgerCurrency(currency);

  // period-aware comparison: if current month is partial, compare same day-range of prev month
  const cmp = useMemo<{ prevTotal: number | null; label: string | null }>(() => {
    if (!prev) return { prevTotal: null, label: null };
    if (month.isPartial) {
      let s = 0;
      for (let d = 1; d <= month.lastDay; d++) s += prev.byDay[d] || 0;
      return { prevTotal: s, label: `vs ${prev.shortLabel} through the ${ordinal(month.lastDay)}` };
    }
    return { prevTotal: prev.total, label: `vs ${prev.shortLabel}` };
  }, [month, prev]);

  const totalDelta = cmp.prevTotal ? ((month.total - cmp.prevTotal) / cmp.prevTotal) * 100 : null;
  const avgPerDay = month.total / month.lastDay;
  const projected = month.isPartial ? (month.total / month.lastDay) * month.daysInMonth : month.total;

  const catItems = useMemo(() =>
    categories
      .map((c) => ({ ...c, amount: month.byCat[c.id] || 0 }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    [month, categories]);
  const topCat = catItems[0];

  // donut drill-down: top level shows main categories; selecting one (filterCat)
  // shows that category's sub-category breakdown (with an "Unassigned" bucket for
  // legacy / sub-less transactions).
  const donutData = useMemo(() => {
    if (!filterCat) return { items: catItems, total: month.total, label: "Total spent" };
    const main = catById[filterCat];
    if (!main) return { items: catItems, total: month.total, label: "Total spent" };
    const bySub: Record<string, number> = {};
    month.transactions.forEach((tx) => {
      if (tx.cat !== filterCat) return;
      bySub[tx.subcat ?? "__none"] = (bySub[tx.subcat ?? "__none"] || 0) + tx.amount;
    });
    const items = main.subs
      .map((s) => ({ id: s.id, name: s.name, hue: s.hue, amount: bySub[s.id] || 0 }))
      .filter((it) => it.amount > 0);
    if (bySub["__none"]) items.push({ id: "__none", name: "Unassigned", hue: 256, amount: bySub["__none"] });
    items.sort((a, b) => b.amount - a.amount);
    return { items, total: month.byCat[filterCat] || 0, label: main.name };
  }, [filterCat, catItems, month, catById]);

  const budgetPct = Math.min(100, (month.total / budget) * 100);
  const overBudget = month.total > budget;

  // needs vs wants for the selected month
  const nw = useMemo(() => {
    let need = 0, want = 0, needCount = 0, wantCount = 0;
    const needCat: Record<string, number> = Object.create(null), wantCat: Record<string, number> = Object.create(null);
    month.transactions.forEach((tx) => {
      if (tx.need) { need += tx.amount; needCount++; needCat[tx.cat] = (needCat[tx.cat] || 0) + tx.amount; }
      else { want += tx.amount; wantCount++; wantCat[tx.cat] = (wantCat[tx.cat] || 0) + tx.amount; }
    });
    const total = need + want || 1;
    const topOf = (obj: Record<string, number>) => Object.entries(obj)
      .map(([id, amt]) => ({ id, amt, cat: catById[id] }))
      .filter((x) => x.cat).sort((a, b) => b.amt - a.amt).slice(0, 3);
    return { need, want, needCount, wantCount,
      needPct: Math.round((need / total) * 100), wantPct: Math.round((want / total) * 100),
      topNeed: topOf(needCat), topWant: topOf(wantCat) };
  }, [month, catById]);

  const prevNeedPct = useMemo<number | null>(() => {
    if (!prev) return null;
    let n = 0, tt = 0;
    prev.transactions.forEach((tx) => { tt += tx.amount; if (tx.need) n += tx.amount; });
    return tt ? Math.round((n / tt) * 100) : null;
  }, [prev]);

  const openDetail = (tx: Transaction) => setViewerTx({
    ...tx,
    monthKey: month.key, year: month.year, month: month.month,
    dateText: `${month.label} ${tx.day}`,
    weekday: WEEKDAYS[new Date(month.year, month.month, tx.day).getDay()],
  });

  // date bounds for adding / back-dating (strings, per the new component contracts)
  const minDate = useMemo(() => toDateInput(new Date(months[0].year, months[0].month, 1)), [months]);
  // ponytail: live, not frozen at mount — a long-open tab must still cap the
  // date picker at the *real* today, not the day the app first loaded.
  const maxDate = toDateInput(new Date());
  const defaultDate = month.isCurrent
    ? toDateInput(new Date())
    : toDateInput(new Date(month.year, month.month, month.daysInMonth));

  const dayFilteredTx = useMemo(() => {
    let list = month.transactions;
    if (filterCat) list = list.filter((x) => x.cat === filterCat);
    if (selectedDay) list = list.filter((x) => x.day === selectedDay);
    return [...list].sort((a, b) => b.day - a.day || b.amount - a.amount);
  }, [month, filterCat, selectedDay]);
  const TX_PAGE = 5;
  const txPageCount = Math.max(1, Math.ceil(dayFilteredTx.length / TX_PAGE));
  const safePage = Math.min(txPage, txPageCount - 1);
  const pagedTx = dayFilteredTx.slice(safePage * TX_PAGE, safePage * TX_PAGE + TX_PAGE);

  // ----- category management -----
  const addCategory = (cat: Category) => setCategories((prev) => [...prev, cat]);
  const editCategory = (id: CategoryId, patch: Partial<Pick<Category, "name" | "subs">>) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCategory = (id: CategoryId, reassignTo: CategoryId | null) => {
    if (reassignTo) {
      setMonths((prevM) => prevM.map((m) => {
        if (!m.transactions.some((x) => x.cat === id)) return m;
        const tx = m.transactions.map((x) => (x.cat === id ? { ...x, cat: reassignTo, subcat: null } : x));
        return recompute({ ...m, transactions: tx }, categories);
      }));
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setFilterCat((f) => (f === id ? null : f));
  };

  // route transactions to the right month by date (supports back-dating + bulk)
  const routeInsert = (items: InsertItem[]) => {
    setMonths((prevM) => {
      // A tab left open across a month boundary: the live date picker allows
      // days in months the mount-time scaffold doesn't have yet. Extend the
      // scaffold forward instead of silently dropping the transaction.
      let base = prevM;
      const last = prevM[prevM.length - 1];
      const maxKey = items.reduce((mx, it) => {
        const k = `${it.year}-${pad2(it.month + 1)}`;
        return k > mx ? k : mx;
      }, last.key);
      if (maxKey > last.key) {
        const [y, m] = maxKey.split("-").map(Number);
        const ext = monthScaffold(
          { year: last.month === 11 ? last.year + 1 : last.year, month: (last.month + 1) % 12 },
          { year: y, month: m - 1 },
          new Date(),
          categories,
        );
        // the previously-current month is over — clear its stale flags
        base = [
          ...prevM.map((mm) => (mm.isCurrent ? { ...mm, isCurrent: false, isPartial: false, lastDay: mm.daysInMonth } : mm)),
          ...ext,
        ];
      }
      const touched: Record<number, MonthData> = {};
      items.forEach((it) => {
        const key = `${it.year}-${pad2(it.month + 1)}`;
        const i = base.findIndex((m) => m.key === key);
        if (i < 0) return; // before the scaffold start — unreachable via the UI (minDate)
        if (!touched[i]) touched[i] = { ...base[i], transactions: [...base[i].transactions] };
        touched[i].transactions.push({
          id: `tx-${crypto.randomUUID()}`,
          day: it.day, cat: it.cat, subcat: it.subcat ?? null, amount: it.amount, merchant: it.merchant,
          need: it.need, attachments: it.attachments || [], recurId: it.recurId || null, _new: true,
        });
      });
      return base.map((m, i) => (touched[i] ? recompute(touched[i], categories) : m));
    });
  };

  const addExpense = (item: AddExpensePayload) => {
    if (item._editId) {
      saveTransaction(item._editId, item._editKey, item);
      const i = months.findIndex((m) => m.key === `${item.year}-${pad2(item.month + 1)}`);
      if (i >= 0) setIdx(i);
      return;
    }
    let recurId: string | null = null;
    if (item.recurring) {
      recurId = `user-${crypto.randomUUID()}`;
      setRecurring((prev) => [...prev, { id: recurId!, merchant: item.merchant, cat: item.cat, subcat: item.subcat,
        amount: item.amount, day: item.day, need: item.need, endKey: item.recurring!.endKey, active: true }]);
    }
    routeInsert([{ ...item, recurId }]);
    const i = months.findIndex((m) => m.key === `${item.year}-${pad2(item.month + 1)}`);
    if (i >= 0) setIdx(i);
  };
  const bulkInsert = (items: InsertItem[]) => routeInsert(items);

  // edit / delete a transaction (delete keeps an undo window)
  const [undoTx, setUndoTx] = useState<{ tx: Transaction; monthKey: string } | null>(null);
  useEffect(() => {
    if (!undoTx) return;
    const timer = setTimeout(() => setUndoTx(null), 6000);
    return () => clearTimeout(timer);
  }, [undoTx]);

  const deleteTransaction = (tx: Transaction) => {
    const key = tx.monthKey;
    if (!key) return;
    setMonths((prevM) => prevM.map((m) => (m.key === key
      ? recompute({ ...m, transactions: m.transactions.filter((x) => x.id !== tx.id) }, categories) : m)));
    // keep a clean copy (no transient display fields) for undo
    setUndoTx({
      monthKey: key,
      tx: { id: tx.id, day: tx.day, cat: tx.cat, subcat: tx.subcat ?? null, amount: tx.amount,
        merchant: tx.merchant, need: tx.need, attachments: tx.attachments ?? [], recurId: tx.recurId ?? null },
    });
  };

  const undoDelete = () => {
    if (!undoTx) return;
    setMonths((prevM) => prevM.map((m) => (m.key === undoTx.monthKey
      ? recompute({ ...m, transactions: [...m.transactions, { ...undoTx.tx, _new: true }] }, categories) : m)));
    setUndoTx(null);
  };
  const saveTransaction = (id: string, oldKey: string | null, item: AddExpensePayload) => {
    const newKey = `${item.year}-${pad2(item.month + 1)}`;
    setMonths((prevM) => prevM.map((m) => {
      let tx = m.transactions;
      let changed = false;
      if (m.key === oldKey) { tx = tx.filter((x) => x.id !== id); changed = true; }
      if (m.key === newKey) {
        tx = [...tx, { id, day: item.day, cat: item.cat, subcat: item.subcat ?? null, amount: item.amount, merchant: item.merchant,
          need: item.need, attachments: item.attachments || [], recurId: item.recurId || null, _new: true }];
        changed = true;
      }
      return changed ? recompute({ ...m, transactions: tx }, categories) : m;
    }));
  };

  // add a brand-new recurring expense (from the Recurring tab)
  const addRecurring = (item: Omit<RecurringItem, "id" | "active">) => {
    const recurId = `user-${crypto.randomUUID()}`;
    setRecurring((prev) => [...prev, { id: recurId, ...item, active: true }]);
    setMonths((prevM) => prevM.map((m) => {
      if (!m.isCurrent) return m;
      if (item.day <= m.lastDay && !m.transactions.some((tx) => tx.recurId === recurId)) {
        return recompute({ ...m, transactions: [...m.transactions, {
          id: `tx-${m.year}-${m.month}-${recurId}`, day: item.day, cat: item.cat, subcat: item.subcat ?? null,
          amount: item.amount, merchant: item.merchant, need: item.need, attachments: [], recurId, _new: true }] }, categories);
      }
      return m;
    }));
  };

  // ----- recurring management -----
  // full edit: patch the item, and reflect everything except the day on this
  // month's already-posted charge (a new day takes effect from next month)
  const editRecurringFull = (id: string, item: Omit<RecurringItem, "id" | "active">) => {
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, ...item } : r)));
    setMonths((prevM) => prevM.map((m) => (m.isCurrent
      ? recompute({ ...m, transactions: m.transactions.map((tx) => (tx.recurId === id
          ? { ...tx, cat: item.cat, subcat: item.subcat ?? null, amount: item.amount, merchant: item.merchant, need: item.need, _new: true }
          : tx)) }, categories)
      : m)));
  };

  const editRecurringAmount = (id: string, amount: number) => {
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, amount } : r)));
    setMonths((prevM) => prevM.map((m) => (m.isCurrent
      ? recompute({ ...m, transactions: m.transactions.map((tx) => (tx.recurId === id ? { ...tx, amount, _new: true } : tx)) }, categories)
      : m)));
  };
  const toggleRecurring = (id: string) => {
    const rec = recurring.find((r) => r.id === id);
    if (!rec) return;
    const stopping = rec.active;
    setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    setMonths((prevM) => prevM.map((m) => {
      if (!m.isCurrent) return m;
      if (stopping) {
        return recompute({ ...m, transactions: m.transactions.filter((tx) => tx.recurId !== id) }, categories);
      }
      if (rec.day <= m.lastDay && !m.transactions.some((tx) => tx.recurId === id)) {
        return recompute({ ...m, transactions: [...m.transactions, {
          id: `tx-${m.year}-${m.month}-${id}-resume`, day: rec.day, cat: rec.cat, subcat: rec.subcat ?? null,
          amount: rec.amount, merchant: rec.merchant, need: rec.need, attachments: [], recurId: id, _new: true }] }, categories);
      }
      return m;
    }));
  };

  // reset day selection on month change; reset pagination on any filter change
  useEffect(() => { setSelectedDay(null); }, [idx]);
  useEffect(() => { setTxPage(0); }, [selectedDay, filterCat, idx]);

  // keyboard: N opens Add expense; arrows navigate months. Both stay out of
  // the way while a modal is open or the user is typing in a field.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      const modalOpen = adding || bulk || addingRecurring || !!editingTx || !!viewerTx;
      if (typing || modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setAdding(true); return; }
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(months.length - 1, i + 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [adding, bulk, addingRecurring, editingTx, viewerTx, months.length]);

  // apply theme at document root so text color cascades from the top (robust across switches)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.body.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  // persist state (v4; storage.ts migrates legacy blobs). Debounced: the blob
  // includes attachment data URLs, so serializing on every keystroke would
  // stringify megabytes repeatedly. Save failures (storage quota) surface as
  // a banner instead of being swallowed — this app must not lose data silently.
  useEffect(() => {
    const timer = setTimeout(() => {
      const txByMonth: Record<string, Transaction[]> = {};
      months.forEach((m) => { txByMonth[m.key] = m.transactions; });
      setSaveFailed(!save({ v: 4, txByMonth, categories, recurring, budget, catBudgets, currency, settings: t }));
    }, 300);
    return () => clearTimeout(timer);
  }, [months, categories, recurring, budget, catBudgets, currency, t]);

  const changeCurrency = (code: string) => setCurrency(code);

  // repeat a purchase today: same merchant/category/sub/amount, no attachments
  // (receipts belong to the original purchase)
  const duplicateTransaction = (tx: Transaction) => {
    const now = new Date();
    routeInsert([{ year: now.getFullYear(), month: now.getMonth(), day: now.getDate(),
      cat: tx.cat, subcat: tx.subcat ?? null, amount: tx.amount, merchant: tx.merchant, need: tx.need }]);
    setViewerTx(null);
    const key = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const i = months.findIndex((m) => m.key === key);
    if (i >= 0) setIdx(i);
  };

  // full-fidelity JSON backup (CSV is lossy: no attachments/subs/settings)
  const exportBackup = () => {
    const txByMonth: Record<string, Transaction[]> = {};
    months.forEach((m) => { txByMonth[m.key] = m.transactions; });
    const data = JSON.stringify({ v: 4, txByMonth, categories, recurring, budget, catBudgets, currency, settings: t }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-backup-${toDateInput(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importBackup = (file: File) => {
    file.text().then((text) => {
      let parsed: { v?: unknown } | null = null;
      try { parsed = JSON.parse(text); } catch { /* rejected below */ }
      if (!parsed || typeof parsed !== "object" || typeof parsed.v !== "number" || parsed.v < 1 || parsed.v > 4) {
        alert("That file isn't a Ledger backup."); return;
      }
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        if (current) localStorage.setItem(`${STORAGE_KEY}-pre-import`, current); // escape hatch
        localStorage.setItem(STORAGE_KEY, text);
      } catch { alert("Couldn't store the backup — browser storage is full."); return; }
      location.reload(); // the boot path validates + migrates the imported blob
    });
  };

  const resetData = () => {
    setMonths(EXPENSE.months.map((m) => recompute(m, EXPENSE.categories)));
    setCategories(EXPENSE.categories.map((c) => ({ ...c })));
    setRecurring(EXPENSE.recurring.map((r) => ({ ...r, active: true })));
    setBudget(EXPENSE.monthlyBudget); setCurrency("USD");
    setFilterCat(null); setViewerTx(null); setIdx(EXPENSE.currentIndex);
  };

  const rootStyle = { "--accent": t.accent } as React.CSSProperties;

  return (
    <div className="app" data-theme={resolvedTheme} data-density={t.density} style={rootStyle}>
      {saveFailed && (
        <div className="save-warn" role="alert">
          ⚠ Your latest changes could not be saved — browser storage is full. Remove some large
          attachments (or export a CSV backup now) to avoid losing data when this tab closes.
        </div>
      )}
      <header className="topbar">
        <div className="tb-left">
          <div className="brand">
            <div className="logo" style={{ background: t.accent }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 18V8m5 10V5m5 13v-7m5 7V9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/></svg>
            </div>
            <span className="brand-name">Ledger</span>
          </div>
          {/* top tab bar on desktop; fixed bottom app bar on phones (see media CSS) */}
          <nav className="nav-tabs">
            <button className={view === "overview" ? "on" : ""} onClick={() => setView("overview")}>
              <svg className="nav-ic" width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 13V8m3.3 5V4m3.4 9V6.5M13 13V5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              <span>Overview</span>
            </button>
            <button className={view === "transactions" ? "on" : ""} onClick={() => setView("transactions")}>
              <svg className="nav-ic" width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              <span>Transactions</span>
            </button>
            <button className={view === "recurring" ? "on" : ""} onClick={() => setView("recurring")}>
              <svg className="nav-ic" width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 018.5-3.5L13 6M13 8a5 5 0 01-8.5 3.5L3 10M13 3v3h-3M3 13v-3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>Recurring</span>
            </button>
            <button className={view === "categories" ? "on" : ""} onClick={() => setView("categories")}>
              <svg className="nav-ic" width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2.5 2.5h5.2L14 8.8a1.4 1.4 0 010 2L10.8 14a1.4 1.4 0 01-2 0L2.5 7.7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="5.6" cy="5.6" r="1" fill="currentColor"/></svg>
              <span>Categories</span>
            </button>
            <button className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>
              <svg className="nav-ic" width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M3 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="6.2" cy="5" r="1.9" stroke="currentColor" strokeWidth="1.4"/><circle cx="9.8" cy="11" r="1.9" stroke="currentColor" strokeWidth="1.4"/></svg>
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {view === "overview" && (
          <div className="month-nav">
            <button className="icon-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous month">‹</button>
            <div className="month-display">
              <span className="month-title">{month.label}</span>
              {month.isPartial && <span className="month-tag">in progress</span>}
            </div>
            <button className="icon-btn" disabled={idx === months.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next month">›</button>
            {years.length > 1 && (
              <label className="txv-select-wrap year-pick">
                <select value={month.year} onChange={(e) => jumpToYear(Number(e.target.value))} aria-label="Year">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="topbar-actions">
          <ExportMenu months={months} catById={catById} onPrint={() => window.print()} onBulk={() => setBulk(true)} />
          <ThemeMenu theme={t.theme} onChange={(v) => setTweak("theme", v)} />
          {view === "overview" && (
            <>
              <button className="btn ghost bulk-btn" onClick={() => setBulk(true)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                Bulk add
              </button>
              <button className="btn primary add-btn" onClick={() => setAdding(true)}>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add expense
              </button>
            </>
          )}
        </div>
      </header>

      {view === "transactions" && (
        <Transactions months={months} categories={categories} catById={catById}
          onAddClick={() => setAdding(true)} onBulkClick={() => setBulk(true)} onOpenTx={openDetail} />
      )}
      {view === "recurring" && (
        <RecurringView recurring={recurring} catById={catById}
          onEditAmount={editRecurringAmount} onEditItem={setEditingRec}
          onToggle={toggleRecurring} onAddClick={() => setAddingRecurring(true)}
          today={EXPENSE.today} />
      )}
      {view === "categories" && (
        <CategoriesView categories={categories} months={months}
          onAdd={addCategory} onEdit={editCategory} onRemove={removeCategory} />
      )}
      {view === "settings" && (
        <SettingsView budget={budget} onBudget={setBudget}
          categories={categories} catBudgets={catBudgets} onCatBudget={setCatBudget}
          currency={currency} onCurrency={changeCurrency}
          currencies={CURRENCIES} onReset={resetData} settings={t} onSetting={setTweak}
          onExportBackup={exportBackup} onImportBackup={importBackup} />
      )}
      {view === "overview" && (
      <main className="grid">
        {/* KPI row */}
        <KpiCard label="Total spent" value={fmtUSD(month.total)} delta={totalDelta ?? undefined} sub={cmp.label} />
        <KpiCard label="Avg / day" value={fmtUSD(avgPerDay, true)} sub={`over ${month.lastDay} days`} />
        <KpiCard label="Top category" value={topCat ? topCat.name : "—"} sub={topCat ? `${fmtUSD(topCat.amount)} · ${Math.round((topCat.amount / month.total) * 100)}%` : ""}>
          {topCat && <span className="kpi-dot" style={{ background: catColor(topCat.hue) }} />}
        </KpiCard>
        <KpiCard label={month.isPartial ? "Projected vs budget" : "Spent vs budget"}
          value={fmtUSD(month.isPartial ? projected : month.total)}
          sub={overBudget ? `${fmtUSD(month.total - budget)} over` : `${fmtUSD(budget - month.total)} left of ${fmtUSD(budget)}`}>
          <div className="budget-bar">
            <div className="budget-fill" style={{ width: budgetPct + "%", background: overBudget ? "var(--danger)" : "var(--accent)" }} />
            {month.isPartial && <div className="budget-proj" style={{ left: Math.min(100, (projected / budget) * 100) + "%" }} title="projected" />}
          </div>
        </KpiCard>

        {/* Insights */}
        <Insights month={month} months={months} idx={idx} catById={catById} budget={budget} catBudgets={catBudgets} />

        {/* Trend */}
        <section className="card span-trend">
          <div className="card-head">
            <div>
              <h2>Monthly spending</h2>
              <p className="card-sub">{years.length > 1 ? `${month.year} · ` : ""}click a bar to jump to that month</p>
            </div>
            <div className="seg-mini">
              {(["bars", "line", "area"] as const).map((m) => (
                <button key={m} className={t.trendMode === m ? "on" : ""} onClick={() => setTweak("trendMode", m)}>{m}</button>
              ))}
            </div>
          </div>
          <TrendChart months={yearMonths} selectedIndex={yearSelIdx} onSelect={selectYearMonth}
            accent={t.accent} mode={t.trendMode} budget={t.budgetLine ? budget : 0} />
        </section>

        {/* Category breakdown */}
        <section className="card span-cat">
          <div className="card-head">
            <div>
              <h2>By category</h2>
              <p className="card-sub">{filterCat && catById[filterCat] ? `${catById[filterCat].name} · sub-categories` : `${month.shortLabel} ${month.year}`}</p>
            </div>
            {filterCat && <button className="clear-link" onClick={() => setFilterCat(null)}>‹ all categories</button>}
          </div>
          <div className="cat-body">
            <CategoryDonut items={donutData.items} total={donutData.total} centerLabel={donutData.label}
              swapKey={filterCat ?? "main"} hovered={hoverCat}
              onHover={setHoverCat} onSelect={(id) => { if (!filterCat) setFilterCat(id); }} />
            <div className="legend">
              {donutData.items.map((c) => {
                const pct = donutData.total ? (c.amount / donutData.total) * 100 : 0;
                const catBudget = !filterCat ? catBudgets[c.id] : undefined; // budgets apply to main categories
                return (
                  <button key={c.id} className={"legend-row" + (filterCat ? " static" : "")}
                    onMouseEnter={() => setHoverCat(c.id)} onMouseLeave={() => setHoverCat(null)}
                    onClick={() => { if (!filterCat) setFilterCat(c.id); }}>
                    <i className="legend-dot" style={{ background: catColor(c.hue) }} />
                    <span className="legend-name">{c.name}</span>
                    <span className="legend-bar"><span style={{ width: pct + "%", background: catColor(c.hue) }} /></span>
                    <span className={"legend-amt" + (catBudget && c.amount > catBudget ? " over" : "")}>
                      {fmtUSD(c.amount)}{catBudget ? <em className="legend-budget"> / {fmtUSD(catBudget)}</em> : null}
                    </span>
                    <span className="legend-pct">{pct.toFixed(0)}%</span>
                  </button>
                );
              })}
              {filterCat && donutData.items.length === 0 && <div className="legend-empty">No sub-category spending in {catById[filterCat]?.name}.</div>}
            </div>
          </div>
        </section>

        {/* Needs vs Wants */}
        <section className="card span-needs">
          <div className="card-head">
            <div>
              <h2>Needs vs Wants</h2>
              <p className="card-sub">How essential was {month.shortLabel}’s spending</p>
            </div>
            {prevNeedPct != null && prev && (
              <div className="nw-compare">
                <Delta value={nw.needPct - prevNeedPct} />
                <span>needs vs {prevNeedPct}% in {prev.shortLabel}</span>
              </div>
            )}
          </div>
          <div className="nw-bar">
            <div className="nw-seg is-need" style={{ width: nw.needPct + "%" }}>
              {nw.needPct >= 12 && <span>{nw.needPct}%</span>}
            </div>
            <div className="nw-seg is-want" style={{ width: nw.wantPct + "%" }}>
              {nw.wantPct >= 12 && <span>{nw.wantPct}%</span>}
            </div>
          </div>
          <div className="nw-grid">
            {[{ k: "need", label: "Necessities", amt: nw.need, count: nw.needCount, top: nw.topNeed },
              { k: "want", label: "Discretionary", amt: nw.want, count: nw.wantCount, top: nw.topWant }].map((b) => (
              <div key={b.k} className="nw-detail">
                <div className="nw-detail-head">
                  <span className={"nw-dot is-" + b.k} />
                  <span className="nw-detail-label">{b.label}</span>
                </div>
                <div className="nw-detail-amt">{fmtUSD(b.amt)}</div>
                <div className="nw-detail-sub">{b.count} transaction{b.count !== 1 ? "s" : ""}</div>
                <div className="nw-cats">
                  {b.top.map((x) => (
                    <span key={x.id} className="nw-cat-chip">
                      <i style={{ background: catColor(x.cat.hue) }} />{x.cat.name}
                      <em>{fmtUSD(x.amt)}</em>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Heatmap */}
        <section className="card span-heat">
          <div className="card-head">
            <div>
              <h2>Daily spending</h2>
              <p className="card-sub">{selectedDay ? <><b className="cs-strong">{month.shortLabel} {selectedDay}</b> selected · <button className="clear-inline" onClick={() => setSelectedDay(null)}>clear</button></> : "Tap a day to filter transactions"}</p>
            </div>
            <div className="cal-nav">
              <button className="icon-btn sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous month">‹</button>
              <span className="cal-nav-label">{month.shortLabel} {month.year}</span>
              <button className="icon-btn sm" disabled={idx === months.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next month">›</button>
            </div>
          </div>
          <Heatmap month={month} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </section>

        {/* Transactions */}
        <section className="card span-tx">
          <div className="card-head">
            <div>
              <h2>Transactions</h2>
              <p className="card-sub">
                {selectedDay ? <><b className="cs-strong">{month.shortLabel} {selectedDay}</b> · </> : ""}
                {dayFilteredTx.length} {filterCat && catById[filterCat] ? catById[filterCat].name.toLowerCase() + " " : ""}item{dayFilteredTx.length !== 1 ? "s" : ""}
              </p>
            </div>
            {(filterCat || selectedDay) && <button className="clear-link" onClick={() => { setFilterCat(null); setSelectedDay(null); }}>show all</button>}
          </div>
          <div className="tx-list">
            {pagedTx.map((tx) => {
              const c = catById[tx.cat];
              if (!c) return null;
              const sub = tx.subcat ? c.subs.find((s) => s.id === tx.subcat) : undefined;
              const hasAtt = tx.attachments && tx.attachments.length > 0;
              return (
                <div key={tx.id} className={"tx-row clickable" + (tx._new ? " is-new" : "")}
                  onClick={() => openDetail(tx)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(tx); } }}>
                  <span className="tx-dot" style={{ background: catColor(c.hue) }} />
                  <div className="tx-main">
                    <span className="tx-merchant">{tx.merchant}</span>
                    <span className="tx-cat">{c.name}{sub ? ` · ${sub.name}` : ""}<span className={"need-tag " + (tx.need ? "is-need" : "is-want")}>{tx.need ? "Need" : "Want"}</span></span>
                  </div>
                  {hasAtt && tx.attachments && (
                    <span className="att-badge" title={`${tx.attachments.length} attachment${tx.attachments.length > 1 ? "s" : ""}`}>
                      <Paperclip size={12} />{tx.attachments.length}
                    </span>
                  )}
                  <span className="tx-day">{month.shortLabel} {tx.day}</span>
                  <span className="tx-amt">{fmtUSD(tx.amount, true)}</span>
                </div>
              );
            })}
            {dayFilteredTx.length === 0 && <div className="tx-empty">No transactions{selectedDay ? ` on ${month.shortLabel} ${selectedDay}` : ""}.</div>}
          </div>
          {txPageCount > 1 && (
            <div className="tx-pager">
              <button className="pager-btn" disabled={safePage === 0} onClick={() => setTxPage(safePage - 1)} aria-label="Previous page">‹</button>
              <span className="pager-info">Page {safePage + 1} of {txPageCount}</span>
              <button className="pager-btn" disabled={safePage >= txPageCount - 1} onClick={() => setTxPage(safePage + 1)} aria-label="Next page">›</button>
            </div>
          )}
        </section>
      </main>
      )}

      <datalist id="merchants">
        {merchantNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <AddExpense open={adding} onClose={() => setAdding(false)} onAdd={addExpense} editTx={null}
        defaultDate={defaultDate} minDate={minDate} maxDate={maxDate} categories={categories} catById={catById}
        merchantIndex={merchantIndex} />
      <AddExpense open={!!editingTx} editTx={editingTx} onClose={() => setEditingTx(null)} onAdd={addExpense}
        defaultDate={defaultDate} minDate={minDate} maxDate={maxDate} categories={categories} catById={catById}
        merchantIndex={merchantIndex} />
      <BulkAdd open={bulk} onClose={() => setBulk(false)} onInsert={bulkInsert}
        categories={categories} catById={catById} minDate={minDate} maxDate={maxDate}
        merchantIndex={merchantIndex} />
      <AddRecurring open={addingRecurring || !!editingRec} editItem={editingRec}
        onClose={() => { setAddingRecurring(false); setEditingRec(null); }}
        onAdd={addRecurring} onSave={editRecurringFull}
        categories={categories} catById={catById} today={EXPENSE.today} />
      <TxDetail tx={viewerTx} catById={catById} onClose={() => setViewerTx(null)}
        onEdit={(tx) => { setEditingTx(tx); setViewerTx(null); }}
        onDuplicate={duplicateTransaction}
        onDelete={(tx) => { deleteTransaction(tx); setViewerTx(null); }} />

      <PrintReport month={month} categories={categories} catById={catById} budget={budget} />

      {/* phone-only floating add button (hidden on desktop via CSS) */}
      <button className="fab" onClick={() => setAdding(true)} aria-label="Add expense">
        <svg width="22" height="22" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>

      {undoTx && (
        <div className="undo-toast" role="status">
          <span>Deleted “{undoTx.tx.merchant}” — {fmtUSD(undoTx.tx.amount, true)}</span>
          <button className="undo-btn" onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
