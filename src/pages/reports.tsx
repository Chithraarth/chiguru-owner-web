import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/api";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface SeasonReport {
  startDate: string; endDate: string;
  totalIncome: number; totalExpenses: number; netProfit: number;
  crops: Array<{
    cropId: number; cropName: string; acres: number; totalYieldKg: number;
    totalIncome: number; labourCost: number; fertilizerCost: number;
    sprayCost: number; otherCost: number; totalExpenses: number;
    netProfit: number; profitPerAcre: number;
  }>;
}

interface MonthlyReport {
  month: string; totalExpenses: number; totalIncome: number; netProfit: number;
  breakdown: Array<{ category: string; amount: number; percentage: number }>;
}

interface WeeklyReport {
  weekStart: string; weekEnd: string;
  totalIncome: number; totalExpenses: number; netProfit: number;
  days: Array<{ date: string; income: number; expenses: number }>;
}

const COLORS = ["#2d6a2d", "#4caf50", "#8bc34a", "#cddc39", "#ffc107", "#ff9800", "#ff5722", "#9c27b0", "#3f51b5"];

function fmt(n: number) {
  return fmtMoney(n, 0);
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [activeTab, setActiveTab] = useState<"season" | "monthly" | "weekly">("season");
  const [month, setMonth] = useState(currentMonth);
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));
  const [seasonStart, setSeasonStart] = useState(`${currentYear}-01-01`);
  const [seasonEnd, setSeasonEnd] = useState(`${currentYear}-12-31`);

  const { data: season, isLoading: seasonLoading } = useQuery<SeasonReport>({
    queryKey: ["season-report", seasonStart, seasonEnd],
    queryFn: () => apiFetch(`/reports/season?startDate=${seasonStart}&endDate=${seasonEnd}`),
  });

  const { data: monthly, isLoading: monthlyLoading } = useQuery<MonthlyReport>({
    queryKey: ["monthly-report", month],
    queryFn: () => apiFetch(`/reports/monthly?month=${month}`),
  });

  const { data: weekly, isLoading: weeklyLoading } = useQuery<WeeklyReport>({
    queryKey: ["weekly-report", weekStart],
    queryFn: () => apiFetch(`/reports/weekly?weekStart=${weekStart}`),
    enabled: activeTab === "weekly",
  });

  function prevWeek() { setWeekStart((w) => addDays(w, -7)); }
  function nextWeek() {
    const next = addDays(weekStart, 7);
    if (next <= new Date().toISOString().slice(0, 10)) setWeekStart(next);
  }

  return (
    <PageShell title="Reports" back="/farm-accounts">
      <div className="p-4 space-y-4">
        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(["season", "monthly", "weekly"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
                activeTab === tab ? "bg-white text-primary shadow-sm" : "text-gray-500"
              }`}
            >
              {tab === "season" ? "Season P&L" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Season P&L ── */}
        {activeTab === "season" && (
          <div className="space-y-4">
            {/* Date range filter */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Date range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">From</label>
                  <input
                    type="date"
                    value={seasonStart}
                    onChange={(e) => setSeasonStart(e.target.value)}
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm text-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">To</label>
                  <input
                    type="date"
                    value={seasonEnd}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setSeasonEnd(e.target.value)}
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm text-gray-700"
                  />
                </div>
              </div>
            </div>

            {seasonLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !season ? (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No data for this period</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                    <p className="text-xs text-primary">Income</p>
                    <p className="text-base font-bold text-primary mt-0.5">{fmt(season.totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <p className="text-xs text-red-600">Expenses</p>
                    <p className="text-base font-bold text-red-700 mt-0.5">{fmt(season.totalExpenses)}</p>
                  </div>
                  <div className={`rounded-xl p-3 border ${season.netProfit >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
                    <p className={`text-xs ${season.netProfit >= 0 ? "text-blue-600" : "text-orange-600"}`}>Net P&L</p>
                    <p className={`text-base font-bold mt-0.5 ${season.netProfit >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                      {fmt(season.netProfit)}
                    </p>
                  </div>
                </div>

                {season.crops.length > 0 && (
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Income vs Expenses by Crop</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={season.crops} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <XAxis dataKey="cropName" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${fmtMoney((v / 1000).toFixed(0))}k`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="totalIncome" name="Income" fill="#2d6a2d" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalExpenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ── Monthly ── */}
        {activeTab === "monthly" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100">
              <input
                type="month"
                value={month}
                max={currentMonth}
                onChange={(e) => setMonth(e.target.value)}
                className="flex-1 text-sm font-medium text-gray-700 border-none outline-none bg-transparent"
              />
            </div>

            {monthlyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !monthly ? null : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                    <p className="text-xs text-primary">Income</p>
                    <p className="text-base font-bold text-primary mt-0.5">{fmt(monthly.totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <p className="text-xs text-red-600">Expenses</p>
                    <p className="text-base font-bold text-red-700 mt-0.5">{fmt(monthly.totalExpenses)}</p>
                  </div>
                  <div className={`rounded-xl p-3 border ${monthly.netProfit >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
                    <p className={`text-xs ${monthly.netProfit >= 0 ? "text-blue-600" : "text-orange-600"}`}>Net</p>
                    <p className={`text-base font-bold mt-0.5 ${monthly.netProfit >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                      {fmt(monthly.netProfit)}
                    </p>
                  </div>
                </div>

                {monthly.breakdown.length > 0 && (
                  <>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Expenses by Category</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={monthly.breakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80}
                            label={({ category, percentage }: { category: string; percentage: number }) => `${category} ${percentage.toFixed(0)}%`}
                            labelLine={false}>
                            {monthly.breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {monthly.breakdown.sort((a, b) => b.amount - a.amount).map((item, i) => (
                        <div key={item.category} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm border border-gray-100">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <p className="flex-1 text-sm text-gray-700">{item.category}</p>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">{fmt(item.amount)}</p>
                            <p className="text-xs text-gray-400">{item.percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Weekly ── */}
        {activeTab === "weekly" && (
          <div className="space-y-4">
            {/* Week navigation */}
            <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100">
              <button onClick={prevWeek} className="p-1 text-gray-500 hover:text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-medium text-gray-700">
                {new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
                {new Date(addDays(weekStart, 6)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <button onClick={nextWeek} disabled={addDays(weekStart, 7) > new Date().toISOString().slice(0, 10)} className="p-1 text-gray-500 hover:text-primary disabled:opacity-30">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {weeklyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !weekly ? null : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                    <p className="text-xs text-primary">Income</p>
                    <p className="text-base font-bold text-primary mt-0.5">{fmt(weekly.totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <p className="text-xs text-red-600">Expenses</p>
                    <p className="text-base font-bold text-red-700 mt-0.5">{fmt(weekly.totalExpenses)}</p>
                  </div>
                  <div className={`rounded-xl p-3 border ${weekly.netProfit >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
                    <p className={`text-xs ${weekly.netProfit >= 0 ? "text-blue-600" : "text-orange-600"}`}>Net</p>
                    <p className={`text-base font-bold mt-0.5 ${weekly.netProfit >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                      {fmt(weekly.netProfit)}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Daily Breakdown</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={weekly.days} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${fmtMoney((v / 1000).toFixed(0))}k`} />
                      <Tooltip labelFormatter={dayLabel} formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="income" name="Income" fill="#2d6a2d" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1">
                  {weekly.days.map((d) => (
                    <div key={d.date} className="bg-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-600 w-24">{dayLabel(d.date)}</p>
                      <div className="flex gap-4 text-xs">
                        <span className="text-primary font-medium">{fmt(d.income)}</span>
                        <span className="text-red-600 font-medium">{fmt(d.expenses)}</span>
                        <span className={`font-semibold ${d.income - d.expenses >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                          {fmt(d.income - d.expenses)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
