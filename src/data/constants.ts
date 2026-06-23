import type { ThemeOption, AccentOption, Currency } from "../types";

export const THEMES: ThemeOption[] = [
  { id: "dark",   name: "Midnight", bg: "#1c2230", card: "#2a3142", text: "#f5f7fa" },
  { id: "carbon", name: "Carbon",   bg: "#181818", card: "#2b2b2b", text: "#f7f7f7" },
  { id: "light",  name: "Daylight", bg: "#f1f1ee", card: "#ffffff", text: "#2b2f38" },
  { id: "sand",   name: "Sand",     bg: "#ece4d6", card: "#fbf8f2", text: "#3a3026" },
];

export const ACCENTS: AccentOption[] = [
  { id: "blue",   val: "#4f8ff7" },
  { id: "cyan",   val: "#22c5d6" },
  { id: "violet", val: "#8b7cf6" },
  { id: "green",  val: "#34c98a" },
  { id: "amber",  val: "#e8a23d" },
];

export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$",  decimals: 2, name: "US Dollar" },
  { code: "MYR", symbol: "RM", decimals: 2, name: "Malaysian Ringgit" },
  { code: "EUR", symbol: "€",  decimals: 2, name: "Euro" },
  { code: "GBP", symbol: "£",  decimals: 2, name: "British Pound" },
  { code: "JPY", symbol: "¥",  decimals: 0, name: "Japanese Yen" },
  { code: "INR", symbol: "₹",  decimals: 2, name: "Indian Rupee" },
  { code: "CAD", symbol: "C$", decimals: 2, name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", decimals: 2, name: "Australian Dollar" },
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
