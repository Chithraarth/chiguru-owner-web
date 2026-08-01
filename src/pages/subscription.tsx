import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Check, Loader2, Users, Minus, Plus, Receipt } from "lucide-react";
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
  maxEstates: number | null;
  managerSeats: number;
}

interface ManagerSeatAddon {
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

export default function Subscription() {
  const { toast } = useToast();
  const [seats, setSeats] = useState(1);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [busySeats, setBusySeats] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data: plansData } = useQuery<{ plans: Plan[]; managerSeatAddon: ManagerSeatAddon }>({
    queryKey: ["subscription-plans"],
    queryFn: () => apiFetch("/subscription/plans"),
  });

  const { data: current, refetch: refetchCurrent } = useQuery<CurrentSubscription | null>({
    queryKey: ["subscription"],
    queryFn: () => apiFetch("/subscription"),
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => apiFetch("/payments"),
  });

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

  async function buySeats() {
    setBusySeats(true);
    try {
      const res = await apiMutate<{ url: string }>("POST", "/subscription/seats/checkout", { seats });
      if (res?.url) window.location.href = res.url;
      else toast({ title: "Could not start checkout — try again", variant: "destructive" });
    } catch {
      toast({ title: "Could not start checkout — try again", variant: "destructive" });
    } finally {
      setBusySeats(false);
    }
  }

  async function cancelAutoRenew() {
    setCancelling(true);
    try {
      await apiMutate("POST", "/subscription/cancel-autorenew");
      toast({ title: "Auto-renew cancelled — your plan stays active until the current period ends" });
      refetchCurrent();
    } catch {
      toast({ title: "Could not cancel auto-renew — try again", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  const plans = plansData?.plans ?? [];
  const isActive = current?.status === "active";

  return (
    <PageShell title="Subscription" back="/">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-10">
        {/* Current plan */}
        <section className="bg-primary text-primary-foreground rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            <h2 className="font-bold">Current Plan</h2>
          </div>
          {current ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-lg font-bold">{current.planName}</p>
              <p className="text-primary-foreground/80">
                Status: <span className="font-semibold capitalize">{current.status}</span>
              </p>
              {current.renewalDate && (
                <p className="text-primary-foreground/80">Next billing date: {current.renewalDate}</p>
              )}
              <p className="text-primary-foreground/80">Manager seats: {current.managerSeats} purchased</p>
              {isActive && (
                <Button
                  onClick={cancelAutoRenew}
                  disabled={cancelling}
                  variant="outline"
                  className="mt-2 w-full bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-xl h-10"
                >
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel auto-renew"}
                </Button>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-primary-foreground/80">
              No active subscription yet — pick a plan below to get started.
            </p>
          )}
        </section>

        {/* Plans */}
        <section className="space-y-2.5">
          <h3 className="font-semibold text-gray-700 text-sm px-1">Plans</h3>
          {plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">{plan.name}</p>
                  <p className="text-sm text-gray-500">
                    {fmtMoney(plan.amount)}/{plan.billingCycle === "monthly" ? "month" : plan.billingCycle}
                  </p>
                </div>
                <Button
                  onClick={() => choosePlan(plan.id)}
                  disabled={busyPlan === plan.id || current?.planName === plan.name}
                  className="rounded-xl h-10 bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                >
                  {busyPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : current?.planName === plan.name ? (
                    <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Current</span>
                  ) : (
                    "Select"
                  )}
                </Button>
              </div>
              <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                <li>{plan.maxEstates == null ? "Unlimited estates" : `${plan.maxEstates} estate${plan.maxEstates > 1 ? "s" : ""}`}</li>
                <li>{plan.managerSeats > 0 ? `Includes ${plan.managerSeats} manager seat${plan.managerSeats > 1 ? "s" : ""}` : "No managers"}</li>
              </ul>
            </div>
          ))}
        </section>

        {/* Manager seats add-on */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-gray-800">Buy Manager Seats</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {fmtMoney(plansData?.managerSeatAddon.amount ?? 0)}/seat/month, added on top of your current plan.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSeats((s) => Math.max(1, s - 1))}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-semibold text-gray-800">{seats}</span>
            <button
              onClick={() => setSeats((s) => s + 1)}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600"
            >
              <Plus className="w-4 h-4" />
            </button>
            <Button
              onClick={buySeats}
              disabled={busySeats}
              className="flex-1 rounded-xl h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {busySeats ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy Manager Seats"}
            </Button>
          </div>
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
      </div>
    </PageShell>
  );
}
