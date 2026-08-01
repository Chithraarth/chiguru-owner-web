import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface CurrentSubscription {
  status: string;
}

// Stripe redirects here right after checkout, but the subscription only
// actually activates once our webhook processes the payment — which can lag
// the redirect by a second or two. Poll briefly rather than trusting the
// redirect itself as proof of payment.
const POLL_MS = 2000;
const MAX_POLLS = 15;

export default function SubscriptionSuccess() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"waiting" | "active" | "timeout">("waiting");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      if (cancelled) return;
      attempts += 1;
      try {
        const sub = await apiFetch<CurrentSubscription | null>("/subscription");
        if (cancelled) return;
        if (sub?.status === "active") {
          setStatus("active");
          return;
        }
      } catch {
        // Keep polling — a transient error shouldn't end the wait early.
      }
      if (attempts >= MAX_POLLS) {
        setStatus("timeout");
        return;
      }
      setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell title="Payment" back="/subscription">
      <div className="p-4 flex flex-col items-center justify-center text-center min-h-[60vh] max-w-md mx-auto">
        {status === "waiting" && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="font-semibold text-gray-800">Confirming your payment…</p>
            <p className="text-sm text-gray-500 mt-1">This usually takes a few seconds.</p>
          </>
        )}
        {status === "active" && (
          <>
            <CheckCircle2 className="w-14 h-14 text-primary mb-4" />
            <p className="font-bold text-gray-800 text-lg">Payment successful!</p>
            <p className="text-sm text-gray-500 mt-1">Your subscription is now active.</p>
            <Button
              onClick={() => navigate("/subscription")}
              className="mt-5 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11"
            >
              View subscription
            </Button>
          </>
        )}
        {status === "timeout" && (
          <>
            <p className="font-semibold text-gray-800">Still processing…</p>
            <p className="text-sm text-gray-500 mt-1">
              Your payment may still be confirming. Check back on the subscription page in a minute.
            </p>
            <Button
              onClick={() => navigate("/subscription")}
              variant="outline"
              className="mt-5 w-full rounded-xl h-11"
            >
              Go to subscription
            </Button>
          </>
        )}
      </div>
    </PageShell>
  );
}
