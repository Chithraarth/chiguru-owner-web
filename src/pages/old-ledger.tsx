import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Banknote, Leaf, Users, Wallet, Send, CreditCard, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/api";
import { fmtMoney } from "@/lib/currency";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { useT, loanStatusLabel } from "@/lib/i18n";
import { LOCALE } from "@/lib/i18n-data";

interface LedgerYearSummary {
  year: number;
  totals: {
    expenses: number; income: number; wages: number; attendanceDays: number; workerCount: number;
    payments: number; advances: number; loansGiven: number;
  };
}

interface LedgerYearDetail {
  year: number;
  expenses: { date: string; category: string; amount: string; description: string | null }[];
  expenseCategories: { category: string; total: number; count: number }[];
  workTypes: { name: string; category: string | null; rate: number | null; paymentType: string | null; days: number; workers: number; wages: number }[];
  harvests: { date: string; cropName: string | null; weightKg: string; totalIncome: string; buyer: string | null }[];
  workers: { name: string; days: number; earned: number }[];
  payments: { date: string; payeeName: string; amount: string; method: string }[];
  advances: { date: string; groupName: string | null; amount: string; method: string | null }[];
  loans: { date: string; workerName: string | null; amount: string; totalDue: string; repaidAmount: string; status: string }[];
}

const EMPTY_DETAIL: Omit<LedgerYearDetail, "year"> = {
  expenses: [], expenseCategories: [], workTypes: [], harvests: [], workers: [], payments: [], advances: [], loans: [],
};

function inr(n: number) {
  return fmtMoney(n, 0);
}

export default function OldLedger() {
  const { t, lang } = useT();
  const [openYear, setOpenYear] = useState<number | null>(null);
  useSubScreenHistory(openYear != null ? 1 : 0, () => setOpenYear(null));

  const fmtDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });

  const loanStatus = (status: string) => loanStatusLabel(t, status);

  const { data, isLoading, isError, refetch } = useQuery<{ currentYear: number; years: LedgerYearSummary[] }>({
    queryKey: ["ledger-old-years"],
    queryFn: () => apiFetch("/ledger/old-years"),
  });

  // Detail rows are fetched lazily, only when the farmer opens a year.
  const detailQuery = useQuery<LedgerYearDetail>({
    queryKey: ["ledger-old-year", openYear],
    queryFn: () => apiFetch(`/ledger/old-years/${openYear}`),
    enabled: openYear != null,
  });

  const years = data?.years ?? [];
  const summary = openYear != null ? years.find((yy) => yy.year === openYear) : undefined;

  // ── Single year: everything that happened that year ──
  if (openYear != null && summary) {
    const y = { ...summary, ...(detailQuery.data ?? EMPTY_DETAIL) };
    const sections: { title: string; icon: React.ReactNode; total: string; rows: { left: string; sub?: string; right: string }[] }[] = [
      {
        title: t("ledger.harvestIncome"), icon: <Leaf className="h-4 w-4 text-emerald-600" />, total: inr(y.totals.income),
        rows: y.harvests.map((h) => ({
          left: h.cropName ?? t("ledger.harvest"), sub: `${fmtDate(h.date)} · ${Number(h.weightKg)} kg${h.buyer ? ` · ${h.buyer}` : ""}`,
          right: inr(Number(h.totalIncome)),
        })),
      },
      {
        title: t("ledger.expensesByType"), icon: <Banknote className="h-4 w-4 text-red-500" />, total: inr(y.totals.expenses),
        rows: (y.expenseCategories ?? []).map((c) => ({
          left: c.category, sub: t("ledger.entriesCount", { count: c.count }),
          right: inr(c.total),
        })),
      },
      {
        title: t("ledger.allExpenses"), icon: <Banknote className="h-4 w-4 text-red-400" />, total: inr(y.totals.expenses),
        rows: y.expenses.map((e) => ({
          left: e.category, sub: `${fmtDate(e.date)}${e.description ? ` · ${e.description}` : ""}`,
          right: inr(Number(e.amount)),
        })),
      },
      {
        title: t("ledger.wagesByWorkType"), icon: <Users className="h-4 w-4 text-amber-600" />, total: inr(y.totals.wages),
        rows: (y.workTypes ?? []).map((g) => ({
          left: g.category ? `${g.name} · ${g.category}` : g.name,
          sub: `${t("ledger.workTypeSub", { workers: g.workers, days: g.days })}${g.rate ? ` · ${inr(g.rate)} ${(g.paymentType ?? "per day").toLowerCase()}` : ""}`,
          right: inr(g.wages),
        })),
      },
      {
        title: t("ledger.wagesTitle", { workers: y.totals.workerCount ?? y.workers.length, days: y.totals.attendanceDays }), icon: <Users className="h-4 w-4 text-primary" />, total: inr(y.totals.wages),
        rows: y.workers.map((w) => ({
          left: w.name, sub: t("ledger.worksDone", { days: w.days }),
          right: inr(w.earned),
        })),
      },
      {
        title: t("ledger.paymentsMade"), icon: <Send className="h-4 w-4 text-emerald-600" />, total: inr(y.totals.payments),
        rows: y.payments.map((p) => ({
          left: p.payeeName, sub: `${fmtDate(p.date)} · ${p.method === "cash" ? t("ledger.cash") : t("ledger.account")}`,
          right: inr(Number(p.amount)),
        })),
      },
      {
        title: t("ledger.advancesPaid"), icon: <Wallet className="h-4 w-4 text-amber-600" />, total: inr(y.totals.advances),
        rows: y.advances.map((a) => ({
          left: a.groupName ?? t("ledger.groupAdvance"), sub: `${fmtDate(a.date)} · ${(a.method ?? "cash") === "cash" ? t("ledger.cash") : t("ledger.account")}`,
          right: inr(Number(a.amount)),
        })),
      },
      {
        title: t("ledger.loansGiven"), icon: <CreditCard className="h-4 w-4 text-red-500" />, total: inr(y.totals.loansGiven),
        rows: y.loans.map((l) => ({
          left: l.workerName ?? t("ledger.loan"), sub: `${fmtDate(l.date)} · ${t("ledger.repaid", { amount: inr(Number(l.repaidAmount)) })} · ${loanStatus(l.status)}`,
          right: inr(Number(l.amount)),
        })),
      },
    ];

    const profit = y.totals.income - y.totals.expenses - y.totals.wages;

    return (
      <PageShell title={t("ledger.yearTitle", { year: y.year })} onBack={() => setOpenYear(null)}>
        <div className="p-4 space-y-4">
          {/* Year summary */}
          <div className={`rounded-2xl p-4 text-center border ${profit >= 0 ? "bg-primary/5 border-primary/15" : "bg-red-50 border-red-100"}`}>
            <p className="text-xs font-semibold uppercase text-gray-500">
              {profit >= 0 ? t("ledger.profitTitle", { year: y.year }) : t("ledger.lossTitle", { year: y.year })}
            </p>
            <p className={`text-3xl font-bold mt-1 ${profit >= 0 ? "text-primary" : "text-red-600"}`}>{inr(Math.abs(profit))}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t("ledger.summaryLine", { earned: inr(y.totals.income), expenses: inr(y.totals.expenses), wages: inr(y.totals.wages) })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t("ledger.summaryWorkers", { workers: y.totals.workerCount ?? y.workers.length, days: y.totals.attendanceDays, paid: inr(y.totals.payments + y.totals.advances) })}
            </p>
          </div>

          {detailQuery.isLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!detailQuery.isLoading && detailQuery.isError && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">{t("ledger.yearLoadError")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("ledger.loadErrorSub")}</p>
              <button
                onClick={() => detailQuery.refetch()}
                className="mt-4 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold active:scale-95"
              >
                {t("ledger.tryAgain")}
              </button>
            </div>
          )}

          {!detailQuery.isLoading && !detailQuery.isError && sections.map((s) => (
            <div key={s.title} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">{s.icon} {s.title}</p>
                <p className="text-sm font-bold text-gray-700">{s.total}</p>
              </div>
              {s.rows.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400">{t("ledger.nothing")}</p>
              ) : (
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {s.rows.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{r.left}</p>
                        {r.sub && <p className="text-xs text-gray-400 truncate">{r.sub}</p>}
                      </div>
                      <span className="font-bold text-gray-700 shrink-0">{r.right}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  // ── Year list ──
  return (
    <PageShell title={t("farmAcct.oldLedger")} back="/farm-accounts">
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500">
          {t("ledger.intro")}
          {data ? ` ${t("ledger.currentYearNote", { year: data.currentYear })}` : ""}
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="text-center py-14">
            <p className="text-sm text-gray-500">{t("ledger.loadError")}</p>
            <p className="text-xs text-gray-400 mt-1">{t("ledger.loadErrorSub")}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold active:scale-95"
            >
              {t("ledger.tryAgain")}
            </button>
          </div>
        )}

        {!isLoading && !isError && years.length === 0 && (
          <div className="text-center py-14 text-gray-400">
            <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t("ledger.empty")}</p>
            <p className="text-xs mt-1 max-w-[240px] mx-auto text-gray-300">
              {t("ledger.emptySub")}
            </p>
          </div>
        )}

        {years.map((yy) => (
          <button
            key={yy.year}
            onClick={() => setOpenYear(yy.year)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Archive className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{yy.year}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {t("ledger.earnedSpent", { earned: inr(yy.totals.income), spent: inr(yy.totals.expenses + yy.totals.wages) })}
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>
    </PageShell>
  );
}
