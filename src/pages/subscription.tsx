import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Check, Loader2, Lock, Share2, PartyPopper, MapPinned, Smartphone, Sprout, Landmark, Receipt } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";

interface Plan {
  id: string;
  name: string;
  amount: number;
  billingCycle: string;
  tagline: string;
  maxEstates: number | null;
  maxManagerDevices: number;
}

interface AddonPrice {
  amount: number;
}

interface CurrentSubscription {
  id: number;
  planName: string;
  billingCycle: string;
  amount: string;
  currency: string;
  status: string;
  startDate: string | null;
  renewalDate: string | null;
  managerSeats: number;
  extraEstates: number;
}

interface SubscriptionStatus {
  subscription: CurrentSubscription | null;
  sharePlatforms: string | null;
  shareRewardClaimedAt: string | null;
  freeMonthPending: boolean;
}

interface Payment {
  id: number;
  amount: string;
  currency: string;
  paymentStatus: string;
  paymentMethod: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

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

function PlanIcon({ plan }: { plan: Plan }) {
  if (plan.id === "farmer") return <Sprout className="h-5 w-5 text-primary" />;
  if (plan.id === "planter") return <Smartphone className="h-5 w-5 text-emerald-600" />;
  return <Landmark className="h-5 w-5 text-amber-600" />;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Subscription() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [busyAddon, setBusyAddon] = useState<"estate" | "device" | null>(null);
  const [busyShare, setBusyShare] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { data: plansData } = useQuery<{ plans: Plan[]; estateAddon: AddonPrice; managerDeviceAddon: AddonPrice }>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch("/subscription/plans"),
  });

  const { data: status, refetch: refetchStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription"],
    queryFn: () => apiFetch("/subscription"),
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => apiFetch("/payments"),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["subscription"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  async function choosePlan(planId: string) {
    setBusyPlan(planId);
    try {
      const res = await apiMutate<{ url: string }>("POST", "/subscription/checkout", { planId });
      if (res?.url) window.location.href = res.url;
      else toast({ title: "Could not start checkout — try again", variant: "destructive" });
    } catch {
      toast({ title: "Could not start checkout — try again", variant: "destructive" });
    } finally {
      setBusyPlan(null);
    }
  }

  async function buyAddon(kind: "estate" | "device") {
    setBusyAddon(kind);
    try {
      const path = kind === "estate" ? "/subscription/estate-addon/checkout" : "/subscription/device-addon/checkout";
      const res = await apiMutate<{ url: string }>("POST", path);
      if (res?.url) window.location.href = res.url;
      else toast({ title: "Could not start checkout — try again", variant: "destructive" });
    } catch {
      toast({ title: "Could not start checkout — try again", variant: "destructive" });
    } finally {
      setBusyAddon(null);
    }
  }

  async function cancelAutoRenew() {
    setCancelling(true);
    try {
      await apiMutate("POST", "/subscription/cancel-autorenew");
      toast({ title: "Auto-renew cancelled — your plan stays active until the current period ends" });
      refetchStatus();
    } catch {
      toast({ title: "Could not cancel auto-renew — try again", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  async function share(opt: ShareOption) {
    const link = SHARE_LINK;
    if (opt.url) {
      window.open(opt.url(SHARE_MESSAGE, link), "_blank", "noopener");
    } else if (navigator.share) {
      try {
        await navigator.share({ title: "Chiguru", text: SHARE_MESSAGE, url: link });
      } catch {
        return;
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${SHARE_MESSAGE} ${link}`);
        toast({ title: "Link copied", description: "Paste it wherever you'd like to share." });
      } catch {
        /* ignore */
      }
    }
    setBusyShare(opt.id);
    try {
      const res = await apiMutate<{ rewardGranted?: boolean }>("POST", "/subscription/share", { platform: opt.id });
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
  const current = status?.subscription ?? null;
  const isActive = current?.status === "active";
  const shared = new Set((status?.sharePlatforms ?? "").split(",").filter(Boolean));
  const shareClaimed = !!status?.shareRewardClaimedAt;
  const shareCount = Math.min(shared.size, SHARE_TARGET);
  const freeMonthPending = !!status?.freeMonthPending;

  return (
    <PageShell title="Plans & pricing" back="/">
      <div className="p-4 space-y-4 w-full max-w-5xl mx-auto pb-10">
        {/* Status banner */}
        {isActive ? (
          <section className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              <h2 className="font-bold">{current!.planName} plan active</h2>
            </div>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Your farm is fully active — everything is unlocked, including selling on Chiguru.
            </p>
            {current!.renewalDate && (
              <p className="text-primary-foreground/60 text-xs mt-2">Auto-pay on — renews automatically on {fmtDate(current!.renewalDate)}</p>
            )}
            <Button
              onClick={cancelAutoRenew}
              disabled={cancelling}
              variant="outline"
              className="mt-3 w-full bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-xl h-10"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel auto-renew"}
            </Button>
          </section>
        ) : (
          <section className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <h2 className="font-bold">Subscribe to unlock</h2>
            </div>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Pick a plan below to run your whole farm — attendance, expenses, harvest, Agri Doctor and selling on Chiguru.
            </p>
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
              Thanks for sharing Chiguru{current?.renewalDate ? ` — your plan is active till ${fmtDate(current.renewalDate)}` : freeMonthPending ? ". Your free month will apply the moment you pick a plan below." : "."}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mt-1">
                Post about Chiguru on any 3 different apps — WhatsApp, Facebook, Instagram, X, TikTok or others — and get 1 month of your plan free.
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

        {/* Honest promise */}
        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 text-center">
          <p className="text-base font-bold text-primary">Simple, honest prices</p>
          <p className="text-sm text-primary/80 mt-1 leading-relaxed">
            Every plan runs your whole farm — everything included. Just pick the size that fits: Farmer, Planter or Company Estate.
          </p>
        </div>

        {/* Plan cards */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
          {plans.map((plan) => {
            const isCurrent = isActive && current?.planName === plan.name;
            const isFarmer = plan.id === "farmer";
            const iconBg = isFarmer ? "bg-primary/10" : plan.id === "planter" ? "bg-emerald-50" : "bg-amber-50";
            const features = [
              "Attendance + AI count",
              "Advances + loans",
              "Profit / loss",
              "Agri Doctor",
              "Sell + works offline",
              plan.maxEstates == null ? "Unlimited estates" : `${plan.maxEstates} estate${plan.maxEstates > 1 ? "s" : ""} included`,
              `${plan.maxManagerDevices} manager device${plan.maxManagerDevices > 1 ? "s" : ""} included`,
            ];
            return (
              <div
                key={plan.id}
                className={`snap-center shrink-0 w-[80%] max-w-[340px] md:max-w-none md:w-auto flex flex-col rounded-2xl p-4 border-2 ${isCurrent ? "border-primary bg-primary/5" : isFarmer ? "border-primary bg-white shadow-md" : "border-gray-200 bg-white shadow-sm"}`}
              >
                <span className={`self-start text-[10px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 ${isCurrent || isFarmer ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-600"}`}>
                  {isCurrent ? "Current" : isFarmer ? "Best value" : plan.id === "planter" ? "For plantations" : "For companies"}
                </span>
                <div className="mt-3 flex items-center gap-2.5">
                  <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center`}><PlanIcon plan={plan} /></div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-500">{plan.tagline}</p>
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold text-gray-900">{fmtMoney(plan.amount)}</p>
                <p className="text-sm text-gray-500">per month</p>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full h-11 mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl"
                  disabled={busyPlan === plan.id || isCurrent}
                  onClick={() => choosePlan(plan.id)}
                >
                  {isCurrent ? "Current plan" : busyPlan === plan.id ? <Loader2 className="h-5 w-5 animate-spin" /> : "Choose"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add-ons */}
        <div className="space-y-3">
          <p className="text-base font-bold text-gray-900">Add-ons — grow beyond your plan</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-white rounded-2xl p-4 border-2 border-gray-200 shadow-sm flex flex-col">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center"><MapPinned className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <p className="text-base font-bold text-gray-900">Extra estate add-on</p>
                  <p className="text-xs text-gray-500">Add one more estate on top of your plan</p>
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{fmtMoney(plansData?.estateAddon.amount ?? 199)}<span className="text-sm font-normal text-gray-500"> per month, each</span></p>
              {(current?.extraEstates ?? 0) > 0 && (
                <p className="text-xs text-emerald-700 font-semibold mt-1">You have {current?.extraEstates} extra estate add-on{(current?.extraEstates ?? 0) > 1 ? "s" : ""}</p>
              )}
              <div className="flex-1" />
              <p className="mt-3 text-xs text-gray-500">Renews automatically each month until cancelled.</p>
              <Button
                className="w-full h-11 mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl"
                disabled={busyAddon === "estate"}
                onClick={() => buyAddon("estate")}
              >
                {busyAddon === "estate" ? <Loader2 className="h-4 w-4 animate-spin" /> : "+ Add an estate"}
              </Button>
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-gray-200 shadow-sm flex flex-col">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Smartphone className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-base font-bold text-gray-900">Extra manager device add-on</p>
                  <p className="text-xs text-gray-500">Add one more manager phone on top of your plan</p>
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{fmtMoney(plansData?.managerDeviceAddon.amount ?? 199)}<span className="text-sm font-normal text-gray-500"> per month, each</span></p>
              <div className="flex-1" />
              <p className="mt-3 text-xs text-gray-500">Renews automatically each month until cancelled.</p>
              <Button
                className="w-full h-11 mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl"
                disabled={busyAddon === "device"}
                onClick={() => buyAddon("device")}
              >
                {busyAddon === "device" ? <Loader2 className="h-4 w-4 animate-spin" /> : "+ Add a device"}
              </Button>
            </div>
          </div>
        </div>

        {/* Why we charge */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2.5">
          <p className="text-base font-bold text-gray-900">Why do we charge this money?</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Your plan runs your whole farm: attendance with AI face recognition, employee pay and advances, expenses, harvest, profit & loss, Agri Doctor, selling on Chiguru — and it all works offline.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            The AI features cost us real money. Our technology partners charge us for every photo the AI checks — every face marked in attendance and every crop photo Agri Doctor looks at. Your subscription pays those bills.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            We make little to no profit from this. Chiguru exists to help farmers and planters improve their farms — better records, better growth, better yield. Farming builds so many lives, and we are here to help it grow.
          </p>
        </div>

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
      </div>
    </PageShell>
  );
}
