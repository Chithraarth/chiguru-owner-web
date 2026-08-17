import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Leaf, UserCheck, Camera,
  MapPin, Plus, BotMessageSquare, ScanLine, ShoppingCart,
  Stethoscope, Handshake, LineChart, ArrowUpRight,
  RefreshCw, ChevronDown, ChevronUp, BookOpen, Store,
  Tractor, Wrench, Users, ChevronRight, Check,
  CalendarCheck, Circle, CheckCircle2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GuidedTour } from "@/components/guided-tour";
import { shouldShowTour, markTourShown } from "@/lib/tour-utils";
import { apiFetch, apiMutate } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useEstate } from "@/lib/use-estate";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface DashboardSummary {
  totalCrops: number;
  totalExpensesThisMonth: number;
  totalIncomeThisMonth: number;
  todayLabourCost: number;
  recentActivities: Array<{ type: string; description: string; date: string; amount: number }>;
}

interface FarmProfile {
  farmName: string;
  village: string;
  district: string;
  totalAcres: number;
}

interface RecentAd {
  id: string;
  board: "hire_job" | "hire_rental" | "equipment" | "produce";
  title: string;
  place: string;
  createdAt: string;
  href: string;
}

interface PlanTask {
  id: number;
  month: string; // YYYY-MM
  title: string;
  done: boolean;
}

const AD_STYLE: Record<RecentAd["board"], { icon: typeof Tractor; bg: string; fg: string }> = {
  hire_job: { icon: Users, bg: "bg-primary/10", fg: "text-primary" },
  hire_rental: { icon: Tractor, bg: "bg-primary/10", fg: "text-primary" },
  equipment: { icon: Wrench, bg: "bg-primary/10", fg: "text-primary" },
  produce: { icon: ShoppingCart, bg: "bg-primary/10", fg: "text-primary" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

function fmt(n: number) {
  return fmtMoney(n, 0);
}

const DAILY_WORK = [
  { href: "/work-groups", icon: UserCheck, chip: "bg-[#E9E6FB] text-[#6C5DD3]", title: "Work Attendance", desc: "Attendance & wages" },
  { href: "/daily-update", icon: Camera, chip: "bg-[#D5F1EE] text-[#1F9E92]", title: "Work Updates", desc: "Field photo log" },
  { href: "/farm-accounts", icon: BookOpen, chip: "bg-[#F3DBF5] text-[#B45BC7]", title: "Farm Accounts", desc: "Income & expenses" },
  { href: "/crops", icon: Leaf, chip: "bg-primary/10 text-primary", title: "My Farms", desc: "Estates & plots" },
];

const ADVISORY = [
  { href: "/agri-doctor", icon: Stethoscope, chip: "bg-[#E4E7FB] text-[#5B6ED6]", title: "Agri Doctor", desc: "Ask a specialist" },
  { href: "/disease", icon: ScanLine, chip: "bg-[#FBE4E4] text-[#D66B6B]", title: "Disease Check", desc: "Scan a leaf" },
  { href: "/agri-ai", icon: BotMessageSquare, chip: "bg-[#EDE4FB] text-[#8B5BD6]", title: "Agri Advisor", desc: "Daily guidance" },
  { href: "/year-plan", icon: CalendarCheck, chip: "bg-primary/10 text-primary", title: "Year Plan", desc: "12-month task calendar" },
  { href: "/reports", icon: LineChart, chip: "bg-[#E4EEFB] text-[#5B8CD6]", title: "Reports", desc: "Season summaries" },
];

const MARKET_SETUP = [
  { href: "/workers", icon: Handshake, chip: "bg-[#E4F2FB] text-[#4FA8D8]", title: "Hire", desc: "Labour & machines" },
  { href: "/shop", icon: ShoppingCart, chip: "bg-[#FBEEDD] text-[#D69A4F]", title: "Shop", desc: "Inputs & tools" },
  { href: "/marketplace", icon: Store, chip: "bg-[#E0F5E9] text-[#4FAE72]", title: "Market", desc: "Ads & mandi rates" },
  { href: "/sync-log", icon: RefreshCw, chip: "bg-[#EAEAEA] text-[#6B6B6B]", title: "Sync & Settings", desc: "Data & account" },
];

interface ToolItem {
  href: string;
  icon: typeof Leaf;
  chip: string;
  title: string;
  desc: string;
}

function ToolSection({ title, items }: { title: string; items: ToolItem[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(({ href, icon: Icon, chip, title: itemTitle, desc }) => (
          <Link key={href} href={href}>
            <div className="relative bg-card rounded-2xl p-4 h-full shadow-sm border border-border/60 flex flex-col gap-3 active:scale-95 transition-transform">
              <ArrowUpRight className="absolute top-3 right-3 h-4 w-4 text-muted-foreground/50" />
              <div className={`h-11 w-11 rounded-full flex items-center justify-center ${chip}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-bold leading-tight block text-foreground">{itemTitle}</span>
                <span className="text-sm text-muted-foreground leading-snug block mt-1">{desc}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useT();
  const qc = useQueryClient();
  const { estates, activeEstateId, activeEstate, setActiveEstate } = useEstate();
  const [showTour, setShowTour] = useState(false);
  const [showEstates, setShowEstates] = useState(false);

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch("/dashboard/summary"),
    refetchOnWindowFocus: true,
  });

  const { data: profile } = useQuery<FarmProfile>({
    queryKey: ["farm-profile"],
    queryFn: () => apiFetch("/farm/profile"),
    retry: false,
  });

  const { data: planTasks } = useQuery<PlanTask[]>({
    queryKey: ["plan-tasks"],
    queryFn: () => apiFetch("/plan-tasks"),
  });

  // Current month's undone Year Plan tasks — surfaced only when a plan exists.
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthPending = (planTasks ?? []).filter((x) => x.month === thisMonth && !x.done);

  // Mark a plan task done right from the card — same optimistic pattern as year-plan.
  const togglePlanDone = useMutation({
    mutationFn: (task: PlanTask) => apiMutate("PATCH", `/plan-tasks/${task.id}`, { done: !task.done }),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: ["plan-tasks"] });
      qc.setQueryData<PlanTask[]>(["plan-tasks"], (old = []) =>
        old.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["plan-tasks"] }),
  });

  const { data: recentAds, isLoading: adsLoading } = useQuery<RecentAd[]>({
    queryKey: ["recent-ads"],
    queryFn: () => apiFetch("/ads/recent?limit=6"),
    refetchOnWindowFocus: true,
  });

  // Setup-progress checklist — only fetched while there's no estate yet, since
  // that's the only state this widget is shown in.
  const { data: workGroups } = useQuery<unknown[]>({
    queryKey: ["work-groups", "setup-check"],
    queryFn: () => apiFetch("/work-groups"),
    enabled: !profile,
    retry: false,
  });
  const { data: subscriptionMe } = useQuery<{ subscription: { status: string } | null }>({
    queryKey: ["subscription-me", "setup-check"],
    queryFn: () => apiFetch("/subscriptions/me"),
    enabled: !profile,
    retry: false,
  });

  const setupSteps = [
    { label: "Create estate", done: !!profile },
    { label: "Add work group", done: (workGroups?.length ?? 0) > 0 },
    { label: "Choose a plan", done: subscriptionMe?.subscription?.status === "ACTIVE" },
  ];
  const setupDoneCount = setupSteps.filter((s) => s.done).length;

  // Training tour: full-screen, shown only on the first app open (after a farm profile exists).
  useEffect(() => {
    if (profile && shouldShowTour()) {
      markTourShown();
      setShowTour(true);
    }
  }, [profile]);

  return (
    <PageShell
      title={t("app.name")}
      centerTitle
      rightAction={
        <Link href="/mandi">
          <button
            aria-label="Market Prices"
            className="flex flex-col items-center justify-center px-1.5 py-0.5 rounded-lg hover:bg-foreground/5 active:bg-foreground/5 transition-colors"
          >
            <Store className="h-5 w-5" />
            <span className="text-[9px] font-semibold leading-none mt-0.5">Market</span>
          </button>
        </Link>
      }
    >
      <div className="p-4 lg:p-6 grid gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
        {/* Left column: farm identity/setup + recent ads */}
        <div className="space-y-4 min-w-0">
          {/* Farm identity / setup */}
          {profile ? (
            <div className="relative">
              <div className="bg-card rounded-3xl p-4 text-foreground shadow-sm border border-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold truncate capitalize">{profile.farmName}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground text-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{profile.village}, {profile.district}</span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">{profile.totalAcres} {t("onb.acres")} · {summary?.totalCrops ?? 0} {t("more.crops")}</p>
                  </div>
                  {estates.length > 0 && (
                    <button
                      onClick={() => setShowEstates((s) => !s)}
                      className="shrink-0 flex items-center gap-1 bg-[#E9E6FB] hover:bg-[#DDD8F7] active:bg-[#DDD8F7] rounded-xl px-3 py-2 text-sm font-medium text-[#6C5DD3]"
                    >
                      <span>{t("estate.switch")}</span>
                      {showEstates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {showEstates && estates.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  {estates.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setActiveEstate(e.id);
                        setShowEstates(false);
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-0 ${
                        e.id === activeEstateId ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-800 truncate capitalize">{e.farmName}</span>
                        {(e.village || e.district) && (
                          <span className="block text-xs text-gray-400 truncate">
                            {[e.village, e.district].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </span>
                      {e.id === activeEstateId && (
                        <span className="text-primary text-sm font-semibold shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                  <Link href="/crops?new=1">
                    <div
                      onClick={() => setShowEstates(false)}
                      className="px-4 py-3 flex items-center gap-2 text-primary font-medium bg-primary/10"
                    >
                      <Plus className="h-4 w-4" /> {t("estate.add")}
                    </div>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl p-5 space-y-3">
                <div>
                  <Plus className="h-8 w-8 text-primary mb-2" />
                  <p className="font-semibold text-primary">{t("home.setupFarm")}</p>
                  <p className="text-sm text-primary/80 mt-0.5">{t("home.setupFarmSub")}</p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Link href="/onboarding">
                    <div className="w-full bg-primary text-primary-foreground rounded-xl h-11 flex items-center justify-center gap-2 font-semibold text-sm">
                      <Plus className="h-4 w-4" /> Create New Estate
                    </div>
                  </Link>
                  <Link href="/subscription">
                    <div className="w-full bg-white border border-primary/20 text-primary rounded-xl h-11 flex items-center justify-center font-semibold text-sm">
                      View Subscription Plans
                    </div>
                  </Link>
                  <Link href="/help">
                    <div className="w-full text-primary/70 rounded-xl h-9 flex items-center justify-center font-medium text-sm">
                      Learn More
                    </div>
                  </Link>
                </div>
              </div>

              {/* Setup progress checklist */}
              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">Setup progress</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{setupDoneCount} / 3</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(setupDoneCount / 3) * 100}%` }}
                  />
                </div>
                <div className="space-y-3">
                  {setupSteps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                          step.done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                        }`}
                      >
                        {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className={`text-sm ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* This month's Year Plan tasks — hidden until a plan exists */}
          {monthPending.length > 0 && (
            <Link href="/year-plan" className="block">
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 active:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-primary/10">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground leading-tight">{t("home.planTitle")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("home.planPending", { n: monthPending.length })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </div>
                <ul className="mt-3 space-y-1.5">
                  {monthPending.slice(0, 3).map((task) => (
                    <li key={task.id} className="flex items-center gap-2 text-sm text-foreground/80 min-w-0">
                      <button
                        type="button"
                        className="shrink-0 -m-1 p-1"
                        aria-label={task.title}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePlanDone.mutate(task);
                        }}
                      >
                        {task.done
                          ? <CheckCircle2 className="w-5 h-5 text-primary" />
                          : <Circle className="w-5 h-5 text-muted-foreground/50" />}
                      </button>
                      <span className="truncate">{task.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          )}

          {/* Recent ads posted by people across the community boards */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("home.recentAds")}</h3>
              <Link href="/marketplace" className="text-xs font-semibold text-primary">Market</Link>
            </div>
            {recentAds && recentAds.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentAds.map((ad) => {
                  const style = AD_STYLE[ad.board] ?? AD_STYLE.produce;
                  const Icon = style.icon;
                  return (
                    <Link key={ad.id} href={ad.href}>
                      <div className="flex items-center gap-3 active:bg-gray-50 transition-colors rounded-xl -mx-1 px-1 py-1">
                        <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${style.bg}`}>
                          <Icon className={`h-5 w-5 ${style.fg}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{ad.title}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{ad.place}</span>
                            <span className="text-gray-300">·</span>
                            <span className="shrink-0">{timeAgo(ad.createdAt)}</span>
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : adsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100 animate-pulse" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
                      <div className="h-2.5 w-1/3 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-gray-400 py-4">
                {t("home.noAdsYet")}
              </div>
            )}
            <Link href="/my-ads">
              <div className="w-full mt-3 border border-border/60 rounded-xl h-10 flex items-center justify-center text-sm font-semibold text-foreground">
                Post an ad
              </div>
            </Link>
          </div>
        </div>

        {/* Right column: grouped tool sections */}
        <div className="space-y-5 min-w-0">
          <ToolSection title="Daily Work" items={DAILY_WORK} />
          <ToolSection title="Advisory" items={ADVISORY} />
          <ToolSection title="Market & Setup" items={MARKET_SETUP} />
        </div>
      </div>

      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </PageShell>
  );
}
