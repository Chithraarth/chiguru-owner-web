import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Calendar, Banknote, Wallet, CreditCard, Scale, Send, Trash2, ChevronRight, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GroupFolderList, buildGroupIds } from "@/components/group-folders";
import { apiFetch, apiMutate } from "@/lib/api";
import { PaySheet } from "@/components/pay-sheet";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface AttendanceRecord {
  id: number;
  workerId: number | null;
  workerName: string;
  workGroupId: number | null;
  workGroupName: string | null;
  date: string;
  hoursWorked: number | null;
  wageAmount: string | null;
  notes: string | null;
  createdAt?: string | null;
}

// Server-recorded time (DB sets createdAt) — a device with a wrong clock
// can't fake when the attendance was actually marked.
function fmtRecordedAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

interface WorkGroup {
  id: number;
  name: string;
  paymentType?: string | null;
  rate?: string | number | null;
  advancePerUnit?: string | number | null;
  upiId?: string | null;
  seasonClosed?: boolean;
  clearedAt?: string | null;
}

interface WorkerPayment {
  id: number;
  workerId: number | null;
  workGroupId: number | null;
  payeeName: string;
  amount: string;
  method: string;
  methodLabel: string | null;
  payeeHandle: string | null;
  paymentDate: string;
  note: string | null;
}

interface AdvancePayment {
  id: number;
  paymentDate: string;
  periodLabel: string;
  daysCount: number;
  workerCount: number;
  totalAdvancePaid: number;
}

interface GroupLoan {
  id: number;
  workerName?: string;
  amount: number;
  totalDue: number;
  repaidAmount: number;
  status: string;
  issuedDate: string;
}

type ViewMode = "weekly" | "monthly" | "yearly" | "final";

// Per-worker money summary from GET /workers/:id/money — shape matches the
// backend's reference route (days worked, wages, loans, direct payments, net due).
interface WorkerMoney {
  workerId: number;
  workerName: string;
  upiId: string | null;
  totalDays: number;
  totalWage: number;
  totalEarned: number;
  lastWorkedDate: string | null;
  loanTaken: number;
  loanRepaid: number;
  loanOutstanding: number;
  paymentsTotal: number;
  paymentsCount: number;
  netDue: number;
  payments: { id: number; amount: string; method: string; methodLabel: string | null; paymentDate: string; note: string | null }[];
  loans: { id: number; amount: string; totalDue: string; repaidAmount: string; status: string; issuedDate: string }[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" });
}

function formatCurrency(val: string | null | number) {
  if (val == null || val === "") return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return fmtMoney(n, 0);
}

function inr(n: number) {
  return fmtMoney(n, 0);
}

/** Monday of the week that contains dateStr, as YYYY-MM-DD (local calendar, no UTC shift). */
function weekStart(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function weekLabel(startStr: string) {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("en-IN", opts)} – ${e.toLocaleDateString("en-IN", opts)}`;
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string) {
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function yearKey(dateStr: string) {
  return dateStr.slice(0, 4);
}

export default function LabourRecords() {
  const [openFolder, setOpenFolder] = useState<{ id: number | null; name: string } | null>(null);
  const [openWorker, setOpenWorker] = useState<{ id: number; name: string } | null>(null);
  const [view, setView] = useState<ViewMode>("weekly");
  const [showPaySheet, setShowPaySheet] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  useSubScreenHistory(
    openFolder ? (openWorker ? 2 : 1) : 0,
    () => (openWorker ? setOpenWorker(null) : setOpenFolder(null)),
  );

  const { data: workerMoney, isLoading: moneyLoading } = useQuery<WorkerMoney>({
    queryKey: ["worker-money", openWorker?.id],
    queryFn: () => apiFetch(`/workers/${openWorker!.id}/money`),
    enabled: openWorker != null,
  });

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-all"],
    queryFn: () => apiFetch("/attendance"),
  });

  const { data: workGroups = [] } = useQuery<WorkGroup[]>({
    queryKey: ["work-groups"],
    queryFn: async () => (await apiFetch("/work-groups")) as WorkGroup[],
  });

  const groupOpen = openFolder != null && openFolder.id != null;

  const { data: advances = [] } = useQuery<AdvancePayment[]>({
    queryKey: ["advance-payments", openFolder?.id],
    queryFn: async () => (await apiFetch(`/work-groups/${openFolder!.id}/advance-payments`)) as AdvancePayment[],
    enabled: groupOpen,
  });

  const { data: groupLoans = [] } = useQuery<GroupLoan[]>({
    queryKey: ["group-loans", openFolder?.id],
    queryFn: async () => (await apiFetch(`/work-groups/${openFolder!.id}/loans`)) as GroupLoan[],
    enabled: groupOpen,
  });

  // Direct payments made to this group's workers (cash/UPI/wallet/bank ledger).
  const { data: allPayments = [] } = useQuery<WorkerPayment[]>({
    queryKey: ["worker-payments"],
    queryFn: () => apiFetch("/worker-payments"),
    enabled: openFolder != null,
  });
  const payments = openFolder != null
    ? allPayments.filter((pm) => (pm.workGroupId ?? null) === openFolder.id)
    : [];
  const paymentsTotal = payments.reduce((s2, pm) => s2 + Number(pm.amount), 0);

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/worker-payments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worker-payments"] }),
  });

  // Archive a fully-settled group into "Accounts history" (idempotent on the server).
  const clearAccount = useMutation({
    mutationFn: (id: number) => apiMutate("POST", `/work-groups/${id}/clear`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-groups"] });
      toast({ title: "Account cleared", description: "Moved into Accounts history below." });
      setOpenFolder(null);
    },
    onError: () => toast({ title: "Could not clear the account", variant: "destructive" }),
  });

  // Cleared groups live in "Accounts history" — view-only, out of the active list.
  const clearedGroups = workGroups.filter((g) => g.clearedAt != null);
  const clearedIds = new Set(clearedGroups.map((g) => g.id));
  // Folder list built automatically from Work Attendance groups (+ orphans).
  // Cleared groups are excluded here — this page shows them in history instead.
  const groupList = buildGroupIds(workGroups, records).filter((g) => !clearedIds.has(g.id));
  const generalRecords = records.filter((r) => r.workGroupId == null);
  const folders = [
    ...groupList.map((g) => {
      const recs = records.filter((r) => r.workGroupId === g.id);
      const wage = recs.reduce((s, r) => s + Number(r.wageAmount ?? 0), 0);
      return {
        id: g.id as number | null,
        name: g.name,
        subtitle: recs.length === 0 ? "No records yet" : wage > 0 ? `${inr(wage)} wages` : `${recs.length} entries`,
        count: recs.length,
        emoji: "👥",
        iconBg: "bg-blue-50",
      };
    }),
    {
      id: null,
      name: "General Records",
      subtitle: generalRecords.length === 0 ? "Records without a group" : (() => {
        const wage = generalRecords.reduce((s, r) => s + Number(r.wageAmount ?? 0), 0);
        return wage > 0 ? `${inr(wage)} wages` : `${generalRecords.length} entries`;
      })(),
      count: generalRecords.length,
      emoji: "📋",
      iconBg: "bg-gray-100",
    },
  ];

  const folderRecords = openFolder
    ? records.filter((r) => (r.workGroupId ?? null) === openFolder.id)
    : records;

  // ── Settlement math (group folders only) ──────────────────────────────────
  const group = groupOpen ? workGroups.find((g) => g.id === openFolder!.id) : undefined;
  const isCleared = group?.clearedAt != null;
  const groupRate = Number(group?.rate ?? 0);
  const isPerDay = (group?.paymentType ?? "").toLowerCase().includes("day");

  // Advance structure: ₹X advance per worker per day, rest held for final settlement.
  const advPerDay = Number(group?.advancePerUnit ?? 0);
  const hasAdvanceStructure = advPerDay > 0;

  // A record earns its recorded wage; per-day groups fall back to the group rate.
  const earnOf = (r: AttendanceRecord) =>
    r.wageAmount != null && r.wageAmount !== "" ? Number(r.wageAmount) : isPerDay ? groupRate : 0;

  const totalEarned = folderRecords.reduce((s, r) => s + earnOf(r), 0);
  const totalWorks = folderRecords.length;
  const recordedAdvances = advances.reduce((s, a) => s + Number(a.totalAdvancePaid), 0);
  // Auto-calculated advance: every attendance (person-day) owes advPerDay in advance.
  const autoAdvances = totalWorks * advPerDay;
  const totalAdvances = hasAdvanceStructure ? autoAdvances : recordedAdvances;
  const loanTaken = groupLoans.reduce((s, l) => s + Number(l.amount), 0);
  const loanRepaid = groupLoans.reduce((s, l) => s + Number(l.repaidAmount), 0);
  const loanOutstanding = groupLoans.reduce((s, l) => s + Math.max(0, Number(l.totalDue) - Number(l.repaidAmount)), 0);
  // Direct payments already made (settlements/weekly payouts) reduce the balance.
  const finalPayable = totalEarned - totalAdvances - loanOutstanding - paymentsTotal;

  // ── "Payment due now" — owner pays on whichever day they choose (Sat, Wed…).
  // Everything earned after the last recorded payment is what's due now.
  const lastPaymentDate = [
    ...payments.map((pm) => pm.paymentDate),
    ...advances.map((a) => a.paymentDate),
  ].sort().pop() ?? null;
  // Business rule: a payment covers all work up to and including its date,
  // so only work AFTER the last payment date is "due now".
  const dueRecords = lastPaymentDate
    ? folderRecords.filter((r) => r.date > lastPaymentDate)
    : folderRecords;
  const dueDays = dueRecords.length;
  const dueEarned = dueRecords.reduce((s, r) => s + earnOf(r), 0);
  // Advance-structure groups pay only the advance-per-day now; the rest is
  // held for the Final Account. Other groups pay everything earned since.
  const dueAdvance = dueDays * advPerDay;
  const dueWages = hasAdvanceStructure ? dueAdvance : dueEarned;

  // ── Weekly / monthly / yearly rollups (wages, advances, loans by date) ────
  interface PeriodTotals { days: number; wages: number; advances: number; loans: number }
  const emptyPeriod = (): PeriodTotals => ({ days: 0, wages: 0, advances: 0, loans: 0 });
  const weekly = new Map<string, PeriodTotals>();
  const monthly = new Map<string, PeriodTotals>();
  const yearly = new Map<string, PeriodTotals>();
  const bump = (map: Map<string, PeriodTotals>, key: string, fn: (t: PeriodTotals) => void) => {
    const t = map.get(key) ?? emptyPeriod();
    fn(t);
    map.set(key, t);
  };
  for (const r of folderRecords) {
    const add = (t: PeriodTotals) => { t.days += 1; t.wages += earnOf(r); };
    bump(weekly, weekStart(r.date), add);
    bump(monthly, monthKey(r.date), add);
    bump(yearly, yearKey(r.date), add);
  }
  for (const a of advances) {
    const add = (t: PeriodTotals) => { t.advances += Number(a.totalAdvancePaid); };
    bump(weekly, weekStart(a.paymentDate), add);
    bump(monthly, monthKey(a.paymentDate), add);
    bump(yearly, yearKey(a.paymentDate), add);
  }
  for (const l of groupLoans) {
    if (!l.issuedDate) continue;
    const add = (t: PeriodTotals) => { t.loans += Number(l.amount); };
    bump(weekly, weekStart(l.issuedDate), add);
    bump(monthly, monthKey(l.issuedDate), add);
    bump(yearly, yearKey(l.issuedDate), add);
  }
  const weeklyRows = [...weekly.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const monthlyRows = [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const yearlyRows = [...yearly.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const byDate = folderRecords.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // Distinct employees in this folder (for the per-person money drill-down).
  const folderWorkers = (() => {
    const map = new Map<number, { id: number; name: string; days: number; earned: number }>();
    for (const r of folderRecords) {
      if (r.workerId == null) continue;
      const w = map.get(r.workerId) ?? { id: r.workerId, name: r.workerName, days: 0, earned: 0 };
      w.days += 1;
      w.earned += earnOf(r);
      map.set(r.workerId, w);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  // ── Per-employee money page (wages, loans, payments, net due) ────────────
  if (openWorker != null) {
    const m = workerMoney;
    return (
      <PageShell title={openWorker.name} onBack={() => setOpenWorker(null)}>
        <div className="p-4 space-y-4">
          {moneyLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {m && (
            <>
              {/* Net balance — the one number for settling with this person */}
              <div className={`rounded-2xl p-4 text-center ${m.netDue >= 0 ? "bg-primary/5 border border-primary/15" : "bg-red-50 border border-red-100"}`}>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  {m.netDue >= 0 ? "Balance to pay" : "Employee owes (advance/loan exceeds earnings)"}
                </p>
                <p className={`text-3xl font-bold mt-1 ${m.netDue >= 0 ? "text-primary" : "text-red-600"}`}>
                  {inr(Math.abs(m.netDue))}
                </p>
                {m.lastWorkedDate && (
                  <p className="text-[11px] text-gray-400 mt-1">Last worked {formatDate(m.lastWorkedDate)}</p>
                )}
              </div>

              {/* How the balance is built up */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Account summary</p>
                </div>
                <div className="divide-y divide-gray-50 text-sm">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" /> Days worked</span>
                    <span className="font-bold text-gray-800">{m.totalDays}</span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-primary" /> Wages earned</span>
                    <span className="font-bold text-gray-800">{inr(m.totalWage)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2"><CreditCard className="h-3.5 w-3.5 text-red-500" /> Loan pending</span>
                    <span className={`font-bold ${m.loanOutstanding > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {m.loanOutstanding > 0 ? `− ${inr(m.loanOutstanding)}` : inr(0)}
                    </span>
                  </div>
                  {m.loanTaken > 0 && (
                    <div className="px-4 py-2 text-xs text-gray-400">
                      Loans taken {inr(m.loanTaken)} · already repaid {inr(m.loanRepaid)}
                    </div>
                  )}
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2"><Send className="h-3.5 w-3.5 text-emerald-600" /> Payments received ({m.paymentsCount})</span>
                    <span className={`font-bold ${m.paymentsTotal > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                      {m.paymentsTotal > 0 ? `− ${inr(m.paymentsTotal)}` : inr(0)}
                    </span>
                  </div>
                  <div className={`px-4 py-3 flex items-center justify-between ${m.netDue >= 0 ? "bg-primary/5" : "bg-red-50"}`}>
                    <span className={`font-semibold ${m.netDue >= 0 ? "text-primary" : "text-red-700"}`}>Net due</span>
                    <span className={`font-bold text-base ${m.netDue >= 0 ? "text-primary" : "text-red-600"}`}>
                      {m.netDue >= 0 ? inr(m.netDue) : `− ${inr(Math.abs(m.netDue))}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pay this employee — amount prefilled with their net due */}
              <button
                onClick={() => setShowPaySheet(true)}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm shadow-sm active:scale-[0.99]"
              >
                <Send size={16} /> Pay {m.workerName.split(" ")[0]}{m.netDue > 0 ? ` ${inr(m.netDue)}` : ""}
              </button>

              {/* Loans */}
              {m.loans.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Loans</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {m.loans.map((l) => {
                      const left = Math.max(0, Number(l.totalDue) - Number(l.repaidAmount));
                      return (
                        <div key={l.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-gray-700">{inr(Number(l.amount))} loan</p>
                            <p className="text-xs text-gray-400">
                              {l.issuedDate ? formatDate(l.issuedDate) : ""} · repaid {inr(Number(l.repaidAmount))}
                            </p>
                          </div>
                          <span className={`font-bold ${left > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {left > 0 ? `${inr(left)} left` : "Cleared"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payments received */}
              {m.payments.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Payments received</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {m.payments.map((pm) => (
                      <div key={pm.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-700">{formatDate(pm.paymentDate)}</p>
                          <p className="text-xs text-gray-400 truncate">{pm.methodLabel || pm.method}{pm.note ? ` · ${pm.note}` : ""}</p>
                        </div>
                        <span className="font-bold text-emerald-600 shrink-0">{inr(Number(pm.amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showPaySheet && (
          <PaySheet
            groupId={openFolder?.id ?? null}
            groupName={openFolder?.name ?? ""}
            groupUpiId={group?.upiId ?? null}
            initialWorkerId={openWorker.id}
            suggestedAmount={m && m.netDue > 0 ? m.netDue : undefined}
            onClose={() => {
              setShowPaySheet(false);
              qc.invalidateQueries({ queryKey: ["worker-money"] });
            }}
          />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell
      title={openFolder ? openFolder.name : "Labour Payments & Records"}
      back={openFolder ? undefined : "/farm-accounts"}
      onBack={openFolder ? () => setOpenFolder(null) : undefined}
    >
      <div className="p-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && openFolder === null && (
          <>
            <GroupFolderList folders={folders} onOpen={(f) => { setView("weekly"); setOpenFolder({ id: f.id, name: f.name }); }} />

            {/* ── Accounts history — cleared (fully settled) groups ── */}
            {clearedGroups.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">✅ Accounts history</p>
                {clearedGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setView("final"); setOpenFolder({ id: g.id, name: g.name }); }}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{g.name}</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Account cleared{g.clearedAt ? ` · ${new Date(g.clearedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Period selector (group folders only) ── */}
        {!isLoading && groupOpen && (
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {([
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
              ["yearly", "Yearly"],
              ["final", "Final Account"],
            ] as [ViewMode, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  view === key
                    ? key === "final" ? "bg-primary text-primary-foreground shadow-sm" : "bg-white text-primary shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Payment due now (pay on any day you choose — Sat, Wed…) ── */}
        {!isLoading && groupOpen && !isCleared && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Payment due now</p>
                <p className="text-[11px] text-gray-400">
                  {lastPaymentDate ? `for work after ${formatDate(lastPaymentDate)}` : "no payment made yet"}
                </p>
              </div>
              <span className="font-bold text-lg text-primary">{inr(Math.max(0, dueWages))}</span>
            </div>
            <div className="divide-y divide-gray-50 text-sm">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-gray-600">
                  {hasAdvanceStructure
                    ? `Advance due (${dueDays} × ${inr(advPerDay)})`
                    : `Wages due (${dueDays} work${dueDays !== 1 ? "s" : ""}${isPerDay && groupRate > 0 ? ` · ${inr(groupRate)}/day` : ""})`}
                </span>
                <span className="font-bold text-primary">{inr(hasAdvanceStructure ? dueAdvance : dueEarned)}</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-gray-600">Loan pending</span>
                <span className={`font-bold ${loanOutstanding > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {loanOutstanding > 0 ? inr(loanOutstanding) : inr(0)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between bg-primary/5">
                <span className="font-semibold text-primary">To pay this time</span>
                <span className="font-bold text-base text-primary">{inr(Math.max(0, dueWages))}</span>
              </div>
              {loanOutstanding > 0 && dueWages > 0 && (
                <div className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-gray-500">If you cut the loan now</span>
                  <span className="font-semibold text-gray-700">
                    {inr(Math.max(0, dueWages - loanOutstanding))}
                    {loanOutstanding > dueWages && ` (loan ${inr(loanOutstanding - dueWages)} still left)`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pay workers (direct payment: cash / UPI / wallet / bank) ── */}
        {!isLoading && openFolder !== null && !isCleared && (
          <button
            onClick={() => setShowPaySheet(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm shadow-sm active:scale-[0.99]"
          >
            <Send size={16} /> Pay Workers
          </button>
        )}

        {/* ── Employees in this group — tap one to see their own money page ── */}
        {!isLoading && openFolder !== null && folderWorkers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase">Employees</p>
              <p className="text-[11px] text-gray-400">tap for wages, loans & payments</p>
            </div>
            <div className="divide-y divide-gray-50">
              {folderWorkers.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setOpenWorker({ id: w.id, name: w.name })}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                      {w.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{w.name}</p>
                      <p className="text-xs text-gray-400">{w.days} day{w.days !== 1 ? "s" : ""} worked</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-bold text-primary">{inr(w.earned)}</span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Final settlement (full report) ── */}
        {!isLoading && groupOpen && view === "final" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
              <Scale className="h-4 w-4 opacity-80" />
              <span className="font-semibold text-sm">Final Account</span>
            </div>
            <div className="divide-y divide-gray-50 text-sm">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-primary" /> Total earned ({folderRecords.length} days)</span>
                <span className="font-bold text-gray-800">{inr(totalEarned)}</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-amber-600" />
                  {hasAdvanceStructure ? `Advances paid (${totalWorks} × ${inr(advPerDay)})` : "Advances paid"}
                </span>
                <span className="font-bold text-amber-600">− {inr(totalAdvances)}</span>
              </div>
              {hasAdvanceStructure && recordedAdvances > 0 && recordedAdvances !== autoAdvances && (
                <div className="px-4 py-2 text-xs text-gray-400">
                  Advance entries recorded manually: {inr(recordedAdvances)}
                </div>
              )}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2"><CreditCard className="h-3.5 w-3.5 text-red-500" /> Loan cut (outstanding)</span>
                <span className="font-bold text-red-600">− {inr(loanOutstanding)}</span>
              </div>
              {loanTaken > 0 && (
                <div className="px-4 py-2 text-xs text-gray-400">
                  Loans taken {inr(loanTaken)} · already repaid {inr(loanRepaid)}
                </div>
              )}
              {paymentsTotal > 0 && (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2"><Send className="h-3.5 w-3.5 text-emerald-600" /> Paid directly ({payments.length})</span>
                  <span className="font-bold text-emerald-600">− {inr(paymentsTotal)}</span>
                </div>
              )}
              <div className={`px-4 py-3 flex items-center justify-between ${finalPayable >= 0 ? "bg-primary/5" : "bg-red-50"}`}>
                <span className={`font-semibold ${finalPayable >= 0 ? "text-primary" : "text-red-700"}`}>
                  {finalPayable >= 0 ? "Balance to pay after harvest" : "Workers owe (advance/loan exceeds earnings)"}
                </span>
                <span className={`font-bold text-base ${finalPayable >= 0 ? "text-primary" : "text-red-600"}`}>
                  {inr(Math.abs(finalPayable))}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Account cleared — archive a fully-settled group into history ── */}
        {!isLoading && groupOpen && view === "final" && (
          isCleared ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800 text-sm">Account cleared</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {group?.clearedAt
                    ? `Settled on ${new Date(group.clearedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — kept here in Accounts history.`
                    : "Kept here in Accounts history."}
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                if (finalPayable > 0) {
                  toast({
                    title: `${inr(finalPayable)} still to pay`,
                    description: "Record the payment first, then clear the account.",
                    variant: "destructive",
                  });
                  return;
                }
                if (!clearAccount.isPending) clearAccount.mutate(openFolder!.id as number);
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl py-3.5 font-semibold text-sm shadow-sm active:scale-[0.99]"
            >
              <CheckCircle2 size={16} />
              {clearAccount.isPending ? "Clearing…" : "Account cleared — everything is paid"}
            </button>
          )
        )}

        {/* ── Weekly / Monthly / Yearly breakdown ── */}
        {!isLoading && groupOpen && view !== "final" && (() => {
          const rows = view === "weekly" ? weeklyRows : view === "monthly" ? monthlyRows : yearlyRows;
          const labelOf = (key: string) =>
            view === "weekly" ? weekLabel(key) : view === "monthly" ? monthLabel(key) : key;
          const title = view === "weekly" ? "Weekly payments" : view === "monthly" ? "Monthly payments" : "Yearly payments";
          if (rows.length === 0) {
            return (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No records yet for this view</p>
              </div>
            );
          }
          return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase">{title}</p>
                <p className="text-xs text-gray-400">
                  {hasAdvanceStructure ? `Works × ${inr(advPerDay)} advance/day` : "Earned − Advance = To pay"}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {rows.map(([key, v]) => {
                  // Advance-structure groups: pay works × advance-per-day each period,
                  // rest is held for the Final Account. Others: earned minus recorded advances.
                  const advanceDue = v.days * advPerDay;
                  const held = v.wages - advanceDue;
                  const toPay = hasAdvanceStructure ? advanceDue : v.wages - v.advances;
                  return (
                    <div key={key} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-800">{labelOf(key)}</p>
                        <div className="text-right">
                          <span className={`font-bold ${toPay >= 0 ? "text-primary" : "text-red-600"}`}>
                            {toPay >= 0 ? inr(toPay) : `− ${inr(Math.abs(toPay))}`}
                          </span>
                          {hasAdvanceStructure && (
                            <p className="text-[10px] text-gray-400 leading-tight">
                              {v.days} × {inr(advPerDay)} advance
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>{v.days} work{v.days !== 1 ? "s" : ""} done</span>
                        <span className="text-primary">earned {inr(v.wages)}</span>
                        {hasAdvanceStructure ? (
                          held > 0 && <span className="text-amber-600">{inr(held)} held for final</span>
                        ) : (
                          v.advances > 0 && <span className="text-amber-600">advance − {inr(v.advances)}</span>
                        )}
                        {v.loans > 0 && <span className="text-red-500">loan given {inr(v.loans)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {loanOutstanding > 0 && (
                <div className="px-4 py-2.5 bg-red-50 text-xs text-red-600 border-t border-red-100">
                  Loan outstanding {inr(loanOutstanding)} will be cut in the Final Account
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Advance payment history (full report) ── */}
        {!isLoading && groupOpen && view === "final" && advances.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase">Advance payments</p>
            </div>
            <div className="divide-y divide-gray-50">
              {advances.map((a) => (
                <div key={a.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-700">{a.periodLabel || formatDate(a.paymentDate)}</p>
                    <p className="text-xs text-gray-400">{a.paymentDate} · {a.workerCount} workers × {a.daysCount} days</p>
                  </div>
                  <span className="font-bold text-amber-600">{inr(Number(a.totalAdvancePaid))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Direct payment history ── */}
        {!isLoading && openFolder !== null && view === "final" && payments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase">Payments made</p>
            </div>
            <div className="divide-y divide-gray-50">
              {payments.map((pm) => (
                <div key={pm.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-700 truncate">{pm.payeeName}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatDate(pm.paymentDate)} · {pm.methodLabel || pm.method}{pm.note ? ` · ${pm.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-emerald-600">{inr(Number(pm.amount))}</span>
                    <button
                      onClick={() => { if (window.confirm("Delete this payment record?")) deletePayment.mutate(pm.id); }}
                      className="text-gray-300 hover:text-red-500 p-1"
                      aria-label="Delete payment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && openFolder !== null && folderRecords.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-14 w-14 text-gray-200 mb-4" />
            <p className="text-gray-500 text-base font-medium">No labour records for {openFolder.name} yet</p>
            <p className="text-gray-400 text-sm mt-1">Records will appear here after attendance is marked</p>
          </div>
        )}

        {openFolder !== null && (!groupOpen || view === "final") && sortedDates.length > 0 && (
          <p className="text-xs font-semibold text-gray-500 uppercase px-1 pt-1">Daily records</p>
        )}

        {openFolder !== null && (!groupOpen || view === "final") && sortedDates.map((date) => {
          const entries = byDate[date];
          const totalWage = entries.reduce((s, e) => s + Number(e.wageAmount ?? 0), 0);
          const totalWorkers = entries.length;

          return (
            <div key={date} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Date header */}
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 opacity-80" />
                  <span className="font-semibold text-sm">{formatDate(date)}</span>
                </div>
                <div className="flex items-center gap-3 text-primary-foreground/80 text-xs">
                  <span>{totalWorkers} worker{totalWorkers !== 1 ? "s" : ""}</span>
                  {totalWage > 0 && (
                    <span className="bg-white/20 rounded-full px-2 py-0.5 text-white font-semibold">
                      {fmtMoney(totalWage)}
                    </span>
                  )}
                </div>
              </div>

              {/* Worker rows */}
              <div className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{entry.workerName}</p>
                      {entry.workGroupName && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.workGroupName}</p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-gray-500 mt-1 leading-snug">{entry.notes}</p>
                      )}
                      {entry.createdAt && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Recorded {fmtRecordedAt(entry.createdAt)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {entry.hoursWorked != null && (
                        <p className="text-xs text-gray-400">{entry.hoursWorked}h</p>
                      )}
                      {formatCurrency(entry.wageAmount) && (
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <span className="text-sm font-bold text-primary">
                            {fmtMoney(entry.wageAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showPaySheet && openFolder !== null && (
        <PaySheet
          groupId={openFolder.id}
          groupName={openFolder.name}
          groupUpiId={group?.upiId ?? null}
          suggestedAmount={groupOpen && finalPayable > 0 ? finalPayable : undefined}
          onClose={() => setShowPaySheet(false)}
        />
      )}
    </PageShell>
  );
}
