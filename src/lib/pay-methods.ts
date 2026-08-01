// Country-aware payment options for paying workers directly.
//
// IMPORTANT SAFETY DESIGN: the app never holds or moves money itself.
// - "cash" simply records a cash handover in the farm's ledger.
// - "upi" (India) builds a standard upi://pay deep link that opens the owner's
//   OWN payment app (PhonePe, Google Pay, Paytm — anything UPI). The owner
//   sees the payee + amount in that app and completes the payment there with
//   their own PIN. The farm app only records what was paid afterwards.
// - Other digital methods (M-Pesa, Pix, GCash, bank transfer, …) are
//   record-only: the owner pays in their usual app/bank and records it here.

import { readStoredCountry } from "./i18n-data";

export interface PayMethod {
  id: "cash" | "upi" | "bank" | "wallet" | "other";
  label: string;
  emoji: string;
  /** Placeholder for the payee handle input (UPI ID, wallet number, …). */
  handlePlaceholder?: string;
  /** Hint shown under the method, e.g. which apps it covers. */
  hint?: string;
}

const CASH: PayMethod = { id: "cash", label: "Cash", emoji: "💵", hint: "Hand over cash and record it here" };
const BANK: PayMethod = { id: "bank", label: "Bank transfer", emoji: "🏦", hint: "Pay from your bank app, then record here", handlePlaceholder: "Account / reference (optional)" };
const OTHER: PayMethod = { id: "other", label: "Other", emoji: "📝", hint: "Any other way — record it here" };

const UPI: PayMethod = {
  id: "upi",
  label: "UPI (PhonePe / Google Pay / Paytm)",
  emoji: "📱",
  handlePlaceholder: "UPI ID e.g. name@ybl or 9876543210@upi",
  hint: "Opens your own UPI app with amount filled — you confirm with your PIN",
};

function wallet(label: string, placeholder: string): PayMethod {
  return { id: "wallet", label, emoji: "📲", handlePlaceholder: placeholder, hint: "Pay in that app, then record here" };
}

/** Payment options for a country code (from the app-menu country picker). */
export function payMethodsForCountry(country: string | null): PayMethod[] {
  switch (country) {
    case "IN":
      return [UPI, CASH, BANK, OTHER];
    case "KE":
    case "TZ":
    case "UG":
    case "RW":
      return [CASH, wallet("M-Pesa / Mobile Money", "Mobile money number"), BANK, OTHER];
    case "GH":
    case "NG":
    case "ET":
    case "MG":
    case "CI":
      return [CASH, wallet("Mobile Money", "Mobile money number"), BANK, OTHER];
    case "BR":
      return [CASH, wallet("Pix", "Pix key (phone / CPF / email)"), BANK, OTHER];
    case "PH":
      return [CASH, wallet("GCash / Maya", "GCash / Maya number"), BANK, OTHER];
    case "ID":
      return [CASH, wallet("GoPay / OVO / DANA", "Wallet number"), BANK, OTHER];
    case "VN":
      return [CASH, wallet("MoMo / ZaloPay", "Wallet number"), BANK, OTHER];
    case "TH":
      return [CASH, wallet("PromptPay", "PromptPay ID / phone"), BANK, OTHER];
    case "BD":
      return [CASH, wallet("bKash / Nagad", "bKash / Nagad number"), BANK, OTHER];
    case "PK":
      return [CASH, wallet("JazzCash / Easypaisa", "Wallet number"), BANK, OTHER];
    case "NP":
      return [CASH, wallet("eSewa / Khalti", "Wallet ID / phone"), BANK, OTHER];
    case "LK":
      return [CASH, wallet("eZ Cash / FriMi", "Wallet number"), BANK, OTHER];
    case "CN":
      return [CASH, wallet("WeChat Pay / Alipay", "Wallet ID / phone"), BANK, OTHER];
    case "MM":
      return [CASH, wallet("KBZPay / Wave Money", "Wallet number"), BANK, OTHER];
    case "MY":
      return [CASH, wallet("Touch 'n Go / DuitNow", "Wallet / DuitNow ID"), BANK, OTHER];
    case "US":
      return [CASH, wallet("Venmo / Zelle / Cash App", "Handle / phone / email"), BANK, OTHER];
    case "GB":
    case "FR":
    case "DE":
    case "IT":
    case "NL":
    case "PT":
    case "ES":
      return [CASH, BANK, wallet("PayPal / Wise", "PayPal email / handle"), OTHER];
    case "MX":
    case "CO":
    case "PE":
    case "CL":
    case "AR":
    case "GT":
    case "HN":
    case "CR":
    case "EC":
      return [CASH, BANK, wallet("Digital wallet", "Wallet ID / phone"), OTHER];
    default:
      return [CASH, BANK, wallet("Mobile wallet", "Wallet ID / phone"), OTHER];
  }
}

/** True when the UPI deep-link flow is available (India). */
export function upiAvailable(): boolean {
  return (readStoredCountry() ?? "IN") === "IN";
}

/** All available methods for the currently selected country. */
export function activePayMethods(): PayMethod[] {
  return payMethodsForCountry(readStoredCountry() ?? "IN");
}

/**
 * Standard UPI deep link (NPCI spec). Opens whichever UPI app the owner has —
 * PhonePe, Google Pay, Paytm, BHIM… The owner still confirms in their app.
 */
export function buildUpiLink(payeeHandle: string, payeeName: string, amount: number, note?: string): string {
  const params = new URLSearchParams({
    pa: payeeHandle.trim(),
    pn: payeeName.trim() || "Worker",
    am: amount > 0 ? amount.toFixed(2) : "",
    cu: "INR",
    tn: note || "Farm wage payment",
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * UPI ID that receives Chiguru subscription payments.
 * Replace with the real business UPI ID before going live.
 */
export const CHIGURU_UPI_ID = "chiguru@upi";

/** Loose UPI ID check: something@something (e.g. 98765xxxxx@ybl, name@oksbi). */
export function looksLikeUpiId(v: string): boolean {
  return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v.trim());
}
