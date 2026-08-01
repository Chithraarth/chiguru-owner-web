// Currency support: the owner picks their country in the app menu and every
// money value in the app is shown in that country's currency automatically.
// The ISO currency code is also synced to the farm profile on the server so
// the paired manager device shows the same currency.

import { readStoredCountry } from "./i18n-data";

// ISO 4217 currency per supported country (see COUNTRY_CODES in i18n-data).
export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  IN: "INR", BR: "BRL", VN: "VND", CO: "COP", ET: "ETB", ID: "IDR",
  KE: "KES", LK: "LKR", CN: "CNY", UG: "UGX", TZ: "TZS", RW: "RWF",
  BD: "BDT", NP: "NPR", PK: "PKR", TH: "THB", MM: "MMK", PH: "PHP",
  MY: "MYR", MX: "MXN", GT: "GTQ", HN: "HNL", PE: "PEN", EC: "USD",
  CI: "XOF", GH: "GHS", NG: "NGN", TR: "TRY", MG: "MGA", PG: "PGK",
  CR: "CRC", CL: "CLP", ZA: "ZAR", EG: "EGP", MA: "MAD", ES: "EUR",
  US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", GB: "GBP", FR: "EUR",
  DE: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", AR: "ARS", SA: "SAR",
  AE: "AED", JP: "JPY", KR: "KRW", RU: "RUB", UA: "UAH",
};

const CURRENCY_STORAGE_KEY = "jk.currency";

/** Currency code for a country code, INR when unknown. */
export function currencyForCountry(country: string | null): string {
  return (country && CURRENCY_BY_COUNTRY[country]) || "INR";
}

/** Persist the active currency (called when the owner picks a country). */
export function storeCurrency(code: string) {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/** The active currency code: stored value, else derived from stored country. */
export function activeCurrency(): string {
  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return currencyForCountry(readStoredCountry());
}

function formatter(maxFraction: number): Intl.NumberFormat {
  const currency = activeCurrency();
  // en-IN gives lakh/crore grouping for INR; other currencies use their own.
  const locale = currency === "INR" ? "en-IN" : undefined;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  });
}

/** Format a money amount in the active currency, e.g. 32000 → "₹32,000" / "$32,000". */
export function fmtMoney(n: number | string | null | undefined, maxFraction = 2): string {
  const v = Number(n ?? 0);
  try {
    return formatter(maxFraction).format(Number.isFinite(v) ? v : 0);
  } catch {
    return `₹${v.toLocaleString("en-IN")}`;
  }
}

/** Just the currency symbol for the active currency, e.g. "₹", "$", "R$". */
export function curSymbol(): string {
  try {
    const parts = formatter(0).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "₹";
  } catch {
    return "₹";
  }
}
