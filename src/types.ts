export type CategoryId = string;

export interface Category {
  id: CategoryId;
  name: string;
  hue: number;
  essential: boolean;
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
  amount: number;
  merchant: string;
  need: boolean;
  recurId: string | null;
  attachments?: Attachment[];
  monthKey?: string; // attached in delete flow
  _new?: boolean;    // transient UI flag
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
  amount: number;
  day: number;
  need: boolean;
  active?: boolean;
}

export interface Settings {
  theme: "dark" | "carbon" | "light" | "sand";
  accent: string; // hex; see ACCENTS palette
  trendMode: "bars" | "line" | "area";
  density: "comfortable" | "compact";
  budgetLine: boolean;
}

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
  catById: Record<CategoryId, Category>;
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
  currency: string;
}

export interface StoredStateV2 extends Omit<StoredStateV1, "v"> {
  v: 2;
  settings: Settings;
}
