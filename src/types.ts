export type CategoryId = string;

export interface SubCategory {
  id: string;
  name: string;
  hue: number;
  essential: boolean; // default need/want for new transactions in this sub
}

export interface Category {
  id: CategoryId;
  name: string;
  hue: number; // auto-assigned for the chart; color is edited on sub-categories
  subs: SubCategory[];
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string; // data URL from FileReader.readAsDataURL
}

export interface Transaction {
  id: string;
  day: number;
  cat: CategoryId;
  subcat?: string | null; // sub-category id; null/undefined = unassigned (all legacy data)
  amount: number;
  merchant: string;
  need: boolean;
  recurId: string | null;
  attachments?: Attachment[];
  monthKey?: string; // attached in delete flow
  _new?: boolean;    // transient UI flag
  // Optional display/transient fields attached by App when opening a tx
  // (openDetail) or seeding the edit form. Keep them optional so seed/
  // storage data stays valid without them.
  year?: number;
  month?: number;    // 0-indexed
  dateText?: string;
  weekday?: string;
}

// What AddExpense.onAdd emits: a transaction-shaped object plus the transient
// submit fields the form carries. App reads `_editId`/`_editKey`/`recurring`
// to branch add-vs-edit and recurring linkage, then strips them.
export interface AddExpensePayload {
  year: number;
  month: number; // 0-indexed
  day: number;
  cat: CategoryId;
  subcat: string | null;
  amount: number;
  merchant: string;
  need: boolean;
  attachments: Attachment[];
  recurring: { endKey: string | null } | null;
  recurId: string | null;
  _editId: string | null;
  _editKey: string | null;
}

export interface MonthData {
  key: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  daysInMonth: number;
  lastDay: number;
  isCurrent: boolean;
  firstWeekday: number;
  transactions: Transaction[];
  byCat: Record<CategoryId, number>;
  byDay: Record<number, number>;
  total: number;
  isPartial: boolean;
}

export interface RecurringItem {
  id: string;
  merchant: string;
  cat: CategoryId;
  subcat?: string | null; // sub-category id; null/undefined = unassigned
  amount: number;
  day: number;
  need: boolean;
  active?: boolean;
  endKey?: string | null; // YYYY-MM end month, or null/undefined for ongoing
}

export interface Settings {
  theme: "dark" | "carbon" | "light" | "sand";
  accent: string; // hex; see ACCENTS palette
  trendMode: "bars" | "line" | "area";
  density: "comfortable" | "compact";
  budgetLine: boolean;
}

// Typed single-key setter for Settings (used by App + the settings/categories views).
export type SetSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
  decimals?: number; // extended: number of decimal places used for formatting
}

export interface ThemeOption {
  id: Settings["theme"];
  name: string;
  bg: string;
  card: string;
  text: string;
}

export interface AccentOption {
  id: string;
  val: string;
}

export interface ExpenseData {
  categories: Category[];
  months: MonthData[];
  today: Date;
  monthlyBudget: number;
  currentIndex: number;
  recurring: RecurringItem[];
}

export interface StoredStateV1 {
  v: 1;
  txByMonth: Record<string, Transaction[]>;
  categories: Category[];
  recurring: RecurringItem[];
  budget: number;
  catBudgets?: Record<string, number>; // optional per-category monthly limits
  currency: string;
}

export interface StoredStateV2 extends Omit<StoredStateV1, "v"> {
  v: 2;
  settings: Settings;
}

// Same shape as V2; the bump exists to trigger a one-time clear of the legacy
// seeded sample data (transactions + recurring) on load. See data/storage.ts.
export interface StoredStateV3 extends Omit<StoredStateV2, "v"> {
  v: 3;
}

// v4 adds sub-categories: Category gains `subs`, Transaction gains `subcat`.
// Existing data migrates with empty subs / null subcat.
export interface StoredStateV4 extends Omit<StoredStateV3, "v"> {
  v: 4;
}
