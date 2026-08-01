import { useState } from "react";
import { X, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildUpiLink, upiAvailable, CHIGURU_UPI_ID } from "@/lib/pay-methods";
import { fmtMoney } from "@/lib/currency";

interface UpiPlanSheetProps {
  /** What is being bought, e.g. "Farmer plan". */
  title: string;
  /** Short line under the title, e.g. "₹399 per month". */
  subtitle: string;
  amount: number;
  /** UPI transaction note, e.g. "Chiguru Farmer plan". */
  note: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Bottom sheet for paying a plan/add-on by UPI. Same safety model as the
 * worker PaySheet: the app never moves money — the deep link opens the
 * owner's own UPI app (Google Pay / PhonePe / Paytm / BHIM) with amount and
 * payee filled in, they confirm with their own PIN, then come back and tap
 * "I've paid" to activate.
 */
export function UpiPlanSheet({ title, subtitle, amount, note, confirmLabel, pending, onConfirm, onClose }: UpiPlanSheetProps) {
  // Survive the round-trip through the owner's UPI app: opening a upi:// link
  // can background or even reload the PWA, so remember the "opened" step.
  const openedKey = `upiOpened:${note}`;
  const [upiOpened, setUpiOpenedState] = useState(() => {
    try {
      return sessionStorage.getItem(openedKey) === "1";
    } catch {
      return false;
    }
  });
  const markUpiOpened = () => {
    setUpiOpenedState(true);
    try { sessionStorage.setItem(openedKey, "1"); } catch { /* ignore */ }
  };
  const clearOpened = () => {
    try { sessionStorage.removeItem(openedKey); } catch { /* ignore */ }
  };
  const canUpi = upiAvailable();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg text-gray-900">Pay for {title}</h2>
          <button onClick={() => { clearOpened(); onClose(); }} aria-label="Close"><X size={20} className="text-gray-500" /></button>
        </div>
        <p className="text-sm text-gray-500">{subtitle}</p>

        <div className="mt-4 bg-primary/5 border border-primary/15 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-500">Amount to pay</p>
          <p className="text-3xl font-bold text-primary mt-0.5">{fmtMoney(amount, 0)}</p>
          <p className="text-xs text-gray-400 mt-1">to Chiguru · {CHIGURU_UPI_ID}</p>
        </div>

        {canUpi ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-600 leading-snug">
              This opens <b>your own UPI app</b> (Google Pay, PhonePe, Paytm…) with the amount
              filled in. You confirm the payment there with <b>your PIN</b>, then come back here.
            </p>
            <button
              type="button"
              onClick={() => {
                markUpiOpened();
                const link = buildUpiLink(CHIGURU_UPI_ID, "Chiguru", amount, note);
                // Launch the UPI app WITHOUT navigating this page away: a top-frame
                // upi:// navigation can leave the PWA in a hung "navigating" state
                // where taps stop working. window.open hands the intent to a new
                // context; if the browser blocks it, fall back to direct navigation.
                const w = window.open(link, "_blank");
                if (!w) window.location.href = link;
              }}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold"
            >
              <ExternalLink size={15} /> Open UPI app to pay {fmtMoney(amount, 0)}
            </button>
            {upiOpened && (
              <p className="text-xs text-primary font-medium">
                After paying in your UPI app, come back and tap the button below.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-600 leading-snug">
            Pay {fmtMoney(amount, 0)} to <b>{CHIGURU_UPI_ID}</b> from your payment or bank app,
            then tap the button below.
          </p>
        )}

        <Button
          className="w-full h-12 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold rounded-xl"
          disabled={pending || (canUpi && !upiOpened)}
          onClick={() => { clearOpened(); onConfirm(); }}
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : confirmLabel}
        </Button>
        {canUpi && !upiOpened && (
          <p className="text-[11px] text-gray-400 text-center mt-2">Open your UPI app and pay first — then this button unlocks.</p>
        )}

        <p className="mt-3 text-[11px] text-gray-400 text-center leading-snug flex items-center justify-center gap-1">
          <ShieldCheck size={13} className="shrink-0" />
          Money moves only through your own UPI app — Chiguru never touches it.
        </p>
      </div>
    </div>
  );
}
