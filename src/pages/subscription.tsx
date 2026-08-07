import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Check, Loader2, Lock, Share2, PartyPopper, Users, Receipt, AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}
interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

interface Plan {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingPeriod: string;
  managerLimit: number;
}

interface CurrentSubscription {
  status: string;
  platform: string;
  provider: string;
  startDate: string | null;
  expiryDate: string | null;
  autoRenew: boolean;
  cancelledAt: string | null;
  plan: { id: number; name: string; managerLimit: number; price: number } | null;
}

interface SubscriptionMe {
  subscription: CurrentSubscription | null;
  entitlement: { managerLimit: number; managersUsed: number; remainingManagers: number };
  sharePlatforms: string | null;
  shareRewardClaimedAt: string | null;
  freeMonthPending: boolean;
}

interface Payment {
  id: number;
  amount: string;
  currency: string;
  paymentStatus: string;
  createdAt: string;
}

type FlowState =
  | "idle"
  | "creating"
  | "opening_checkout"
  | "verifying"
  | "failed"
  | "cancelled_by_user";

const SHARE_TARGET = 3;
const SHARE_MESSAGE = "I'm running my farm on Chiguru — attendance, expenses, harvest and Agri Doctor, all in one app. Try it:";
const SHARE_LINK = "https://thechiguru.com";
interface ShareOption {
  id: string;
  label: string;
  url: ((text: string, link: string) => string) | null;
}
const SHARE_OPTIONS: ShareOption[] = [
  { id: "whatsapp", label: "WhatsApp", url: (t, l) => `https://wa.me/?text=${encodeURIComponent(`${t} ${l}`)}` },
  { id: "facebook", label: "Facebook", url: (_t, l) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(l)}` },
  { id: "x", label: "X (Twitter)", url: (t, l) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(l)}` },
  { id: "telegram", label: "Telegram", url: (t, l) => `https://t.me/share/url?url=${encodeURIComponent(l)}&text=${encodeURIComponent(t)}` },
  { id: "other", label: "Instagram / more", url: null },
];

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Loads checkout.js once, lazily — only this page needs it. */
function useRazorpayScript() {
  const [ready, setReady] = useState(!!window.Razorpay);
  useEffect(() => {
    if (window.Razorpay) {
      setReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  return ready;
}

export default function Subscription() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const razorpayReady = useRazorpayScript();
  const [flow, setFlow] = useState<FlowState>("idle");
  const [busyPlanId, setBusyPlanId] = useState<number | null>(null);
  const [busyShare, setBusyShare] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch("/subscriptions/plans"),
  });

  const { data: me, isLoading: meLoading, refetch: refetchMe } = useQuery<SubscriptionMe>({
    queryKey: ["subscription-me"],
    queryFn: () => apiFetch("/subscriptions/me"),
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => apiFetch("/payments"),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["subscription-me"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  async function subscribe(plan: Plan) {
    if (!razorpayReady || !window.Razorpay) {
      toast({ title: "Payment page didn't load", description: "Check your connection and try again.", variant: "destructive" });
      return;
    }
    setBusyPlanId(plan.id);
    setFlow("creating");
    try {
      const created = await apiMutate<{ subscriptionId: string; keyId: string }>("POST", "/subscriptions/razorpay/create", { planId: plan.id });
      if (!created) throw new Error("offline");

      setFlow("opening_checkout");
      const razorpay = new window.Razorpay({
        key: created.keyId,
        subscription_id: created.subscriptionId,
        name: "Chiguru",
        description: `${plan.name} plan`,
        theme: { color: "#2E2A54" },
        handler: (response) => {
          setFlow("verifying");
          apiMutate("POST", "/subscriptions/razorpay/verify", response)
            .then((res) => {
              if (!res) throw new Error("offline");
              setFlow("idle");
              invalidateAll();
              toast({ title: "Subscription active", description: `Your ${plan.name} plan is now active.` });
            })
            .catch((err: unknown) => {
              setFlow("failed");
              const msg = err instanceof ApiError ? (err.body?.message ?? "Please contact support if this keeps happening.") : "Please contact support if this keeps happening.";
              toast({ title: "Couldn't verify your payment", description: msg, variant: "destructive" });
            });
        },
        modal: {
          ondismiss: () => setFlow("cancelled_by_user"),
        },
      });
      razorpay.open();
    } catch (err) {
      setFlow("failed");
      const msg = err instanceof ApiError ? (err.body?.message ?? "Network error — please try again.") : "Network error — please try again.";
      toast({ title: "Couldn't start checkout", description: msg, variant: "destructive" });
    } finally {
      setBusyPlanId(null);
    }
  }

  async function cancelSubscription() {
    setCancelling(true);
    try {
      await apiMutate("POST", "/subscriptions/cancel");
      toast({ title: "Subscription cancelled", description: "Your plan stays active until the current billing period ends." });
      refetchMe();
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body?.message ?? "Please try again.") : "Please try again.";
      toast({ title: "Couldn't cancel", description: msg, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  async function share(opt: ShareOption) {
    if (opt.url) {
      window.open(opt.url(SHARE_MESSAGE, SHARE_LINK), "_blank", "noopener");
    } else if (navigator.share) {
      try {
        await navigator.share({ title: "Chiguru", text: SHARE_MESSAGE, url: SHARE_LINK });
      } catch {
        return;
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${SHARE_MESSAGE} ${SHARE_LINK}`);
        toast({ title: "Link copied", description: "Paste it wherever you'd like to share." });
      } catch {
        /* ignore */
      }
    }
    setBusyShare(opt.id);
    try {
      const res = await apiMutate<{ rewardGranted?: boolean }>("POST", "/subscriptions/share", { platform: opt.id });
      invalidateAll();
      if (res?.rewardGranted) {
        toast({ title: "1 month free!", description: "Thanks for spreading the word about Chiguru." });
      }
    } catch {
      toast({ title: "Couldn't record your share — try again", variant: "destructive" });
    } finally {
      setBusyShare(null);
    }
  }

  const plans = plansData?.plans ?? [];
  const sub = me?.subscription ?? null;
  const isActive = sub?.status === "ACTIVE" || sub?.status === "GRACE_PERIOD";
  const shared = new Set((me?.sharePlatforms ?? "").split(",").filter(Boolean));
  const shareClaimed = !!me?.shareRewardClaimedAt;
  const shareCount = Math.min(shared.size, SHARE_TARGET);
  const freeMonthPending = !!me?.freeMonthPending;

  const busy = flow === "creating" || flow === "opening_checkout" || flow === "verifying";

  return (
    <PageShell title="Plans & pricing" back="/">
      <div className="p-4 space-y-4 w-full max-w-5xl mx-auto pb-10">
        {plansLoading || meLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Explicit flow-state banner — never claims "Active" before the backend confirms it */}
            {flow === "verifying" && (
              <div className="rounded-2xl p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Payment received. Verifying your subscription...
              </div>
            )}
            {flow === "failed" && (
              <div className="rounded-2xl p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Something went wrong verifying your payment. If money was deducted, it will be refunded automatically if the subscription didn't activate.
              </div>
            )}
            {flow === "cancelled_by_user" && (
              <div className="rounded-2xl p-3 bg-gray-50 border border-gray-200 text-gray-600 text-sm">
                Checkout closed — no payment was made.
              </div>
            )}

            {/* Status banner */}
            {isActive ? (
              <section className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  <h2 className="font-bold">{sub!.plan?.name} plan active</h2>
                </div>
                <p className="text-primary-foreground/80 text-sm mt-1">Your farm is fully active — everything is unlocked.</p>
                {sub!.expiryDate && (
                  <p className="text-primary-foreground/60 text-xs mt-2">
                    {sub!.autoRenew ? `Auto-pay on — renews on ${fmtDate(sub!.expiryDate)}` : `Access continues until ${fmtDate(sub!.expiryDate)}`}
                  </p>
                )}
                {sub!.autoRenew && (
                  <Button
                    onClick={cancelSubscription}
                    disabled={cancelling}
                    variant="outline"
                    className="mt-3 w-full bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-xl h-10"
                  >
                    {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel subscription"}
                  </Button>
                )}
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>
                    {me?.entitlement.managersUsed}/{me?.entitlement.managerLimit} managers used
                    {" · "}
                    {me?.entitlement.remainingManagers} remaining
                  </span>
                </div>
              </section>
            ) : (
              <section className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  <h2 className="font-bold">Subscribe to unlock</h2>
                </div>
                <p className="text-primary-foreground/80 text-sm mt-1">Pick a plan below to run your whole farm and add managers.</p>
              </section>
            )}

            {/* Share on 3 apps → 1 month free */}
            <section className="rounded-2xl p-4 border-2 border-emerald-200 bg-emerald-50/60">
              <div className="flex items-center gap-2">
                {shareClaimed ? <PartyPopper className="h-5 w-5 text-emerald-600" /> : <Share2 className="h-5 w-5 text-emerald-600" />}
                <h2 className="font-bold text-gray-900">{shareClaimed ? "Free month claimed!" : "Share on 3 apps → 1 month FREE"}</h2>
              </div>
              {shareClaimed ? (
                <p className="text-sm text-gray-600 mt-1">
                  Thanks for sharing Chiguru{isActive ? "." : freeMonthPending ? " — your free month applies the moment you pick a plan below." : "."}
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mt-1">
                    Post about Chiguru on any 3 different apps and get 1 month free (applied to your first plan if you haven't subscribed yet).
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {Array.from({ length: SHARE_TARGET }).map((_, i) => (
                      <span key={i} className={`h-2.5 w-8 rounded-full ${i < shareCount ? "bg-emerald-500" : "bg-emerald-200"}`} />
                    ))}
                    <span className="ml-1 text-xs font-semibold text-emerald-700">{shareCount}/{SHARE_TARGET} shared</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SHARE_OPTIONS.map((opt) => {
                      const done = shared.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => share(opt)}
                          disabled={busyShare === opt.id}
                          className={`px-3 h-10 rounded-xl text-sm font-semibold border ${done ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-800 border-gray-300 active:bg-gray-50"}`}
                        >
                          {done ? "✓ " : ""}{opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* Plans — DB-driven, nothing hardcoded */}
            <section className="space-y-2.5">
              <h3 className="font-semibold text-gray-700 text-sm px-1">Plans</h3>
              {plans.map((plan) => {
                const isCurrent = isActive && sub?.plan?.id === plan.id;
                return (
                  <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">{plan.name}</p>
                        {plan.description && <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>}
                        <p className="text-sm text-gray-500 mt-1">{fmtMoney(plan.price)}/{plan.billingPeriod === "monthly" ? "month" : plan.billingPeriod}</p>
                      </div>
                      <Button
                        onClick={() => subscribe(plan)}
                        disabled={busy || isCurrent}
                        className="rounded-xl h-10 bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                      >
                        {busyPlanId === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrent ? (
                          <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Current</span>
                        ) : (
                          "Subscribe"
                        )}
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {plan.managerLimit} manager{plan.managerLimit > 1 ? "s" : ""} included
                    </p>
                  </div>
                );
              })}
            </section>

            {/* Payment history */}
            <section className="space-y-2">
              <h3 className="font-semibold text-gray-700 text-sm px-1 flex items-center gap-1.5">
                <Receipt className="w-4 h-4" /> Payment History
              </h3>
              {payments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">
                  No payments yet.
                </div>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{fmtMoney(Number(p.amount))}</p>
                      <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                        p.paymentStatus === "succeeded" ? "bg-primary/10 text-primary" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {p.paymentStatus}
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
