import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plus, X, Loader2, Sparkles, Trash2, Pencil, CheckCircle2, Circle,
  FlaskConical, SprayCan, Droplets, Scissors, Wheat, Wrench, Leaf,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

interface PlanTask {
  id: number;
  cropId: number | null;
  month: string; // YYYY-MM
  day: number | null; // scheduled day of month, null = whole month
  title: string;
  details: string | null;
  category: string;
  done: boolean;
  source: string;
}
interface Crop { id: number; name: string }

const CATEGORIES = ["fertilizer", "spray", "irrigation", "pruning", "harvest", "other"] as const;

const CAT_ICON: Record<string, typeof FlaskConical> = {
  fertilizer: FlaskConical,
  spray: SprayCan,
  irrigation: Droplets,
  pruning: Scissors,
  harvest: Wheat,
  other: Wrench,
};

const CAT_CHIP: Record<string, string> = {
  fertilizer: "bg-emerald-100 text-emerald-700",
  spray: "bg-sky-100 text-sky-700",
  irrigation: "bg-cyan-100 text-cyan-700",
  pruning: "bg-amber-100 text-amber-700",
  harvest: "bg-lime-100 text-lime-700",
  other: "bg-slate-100 text-slate-600",
};

/** The next 12 months starting this month, as YYYY-MM. */
function next12Months(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * A tappable month calendar: today is circled, days with scheduled work show a
 * dot (orange while pending, green once all done). Tapping a date selects it so
 * the farmer can see or add that day's work; tapping again clears the filter.
 */
function MonthGrid({ month, lang, todayLabel, pendingDays, doneDays, selectedDay, onSelectDay }: {
  month: string;
  lang: string;
  todayLabel: string;
  pendingDays: Set<number>;
  doneDays: Set<number>;
  selectedDay: number | null;
  onSelectDay: (d: number) => void;
}) {
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const daysInMonth = new Date(y, mo, 0).getDate();
  // Monday-first week, as farmers in India expect.
  const lead = (first.getDay() + 6) % 7;
  const today = new Date();
  const isThisMonth = today.getFullYear() === y && today.getMonth() === mo - 1;
  const locale = lang === "en" ? "en-IN" : lang;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i + 1).toLocaleDateString(locale, { weekday: "narrow" }), // 2024-01-01 was a Monday
  );
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <div className="p-3">
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground mb-1">
        {weekdays.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 text-center text-sm gap-y-1">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} className="h-10" />;
          const isToday = isThisMonth && d === today.getDate();
          const isSel = d === selectedDay;
          const hasPending = pendingDays.has(d);
          const hasDone = doneDays.has(d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDay(d)}
              className="h-10 flex flex-col items-center justify-center"
              aria-label={isToday ? todayLabel : String(d)}
            >
              <span
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full",
                  isSel
                    ? "ring-2 ring-primary bg-primary/10 text-primary font-bold"
                    : isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-foreground/80",
                )}
              >
                {d}
              </span>
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full -mt-1",
                  hasPending ? "bg-orange-500" : hasDone ? "bg-emerald-500" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TaskForm {
  id: number | null;
  month: string;
  day: string; // "" = whole month, else "1".."31"
  title: string;
  details: string;
  category: string;
  cropId: string; // "" = whole farm
}

/** How many days the given "YYYY-MM" month has. */
function daysIn(month: string): number {
  const [y, mo] = month.split("-").map(Number);
  return new Date(y, mo, 0).getDate();
}

export default function YearPlan() {
  const { t, lang } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const months = useMemo(next12Months, []);
  const thisMonth = months[0];
  const [form, setForm] = useState<TaskForm | null>(null);
  useSubScreenHistory(form ? 1 : 0, () => setForm(null));

  const { data: tasks = [], isLoading } = useQuery<PlanTask[]>({
    queryKey: ["plan-tasks"],
    queryFn: () => apiFetch("/plan-tasks"),
  });
  const { data: crops = [] } = useQuery<Crop[]>({
    queryKey: ["crops"],
    queryFn: () => apiFetch("/crops"),
  });
  const cropName = (id: number | null) => crops.find((c) => c.id === id)?.name;

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(lang === "en" ? "en-IN" : lang, {
      month: "long",
      year: "numeric",
    });
  };

  const generate = useMutation({
    mutationFn: () => apiFetch<PlanTask[]>("/plan-tasks/generate", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-tasks"] });
      toast({ title: t("yp.genDone") });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400 && err.message.includes("no_crops")) {
        toast({ title: t("yp.noCrops"), variant: "destructive" });
      } else {
        toast({ title: t("yp.genFailed"), variant: "destructive" });
      }
    },
  });

  const toggleDone = useMutation({
    mutationFn: (task: PlanTask) => apiMutate("PATCH", `/plan-tasks/${task.id}`, { done: !task.done }),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: ["plan-tasks"] });
      qc.setQueryData<PlanTask[]>(["plan-tasks"], (old = []) =>
        old.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["plan-tasks"] }),
  });

  const saveTask = useMutation({
    mutationFn: (f: TaskForm) => {
      const body = {
        month: f.month,
        day: f.day ? Number(f.day) : null,
        title: f.title.trim(),
        details: f.details.trim() || null,
        category: f.category,
        cropId: f.cropId ? Number(f.cropId) : null,
      };
      return f.id != null
        ? apiMutate("PATCH", `/plan-tasks/${f.id}`, body)
        : // clientId makes an offline-queued replay of this create idempotent.
          apiMutate("POST", "/plan-tasks", { ...body, clientId: crypto.randomUUID() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-tasks"] });
      setForm(null);
    },
    onError: () => toast({ title: t("yp.genFailed"), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/plan-tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-tasks"] }),
  });

  const byMonth = useMemo(() => {
    const map = new Map<string, PlanTask[]>();
    for (const task of tasks) {
      const list = map.get(task.month) ?? [];
      list.push(task);
      map.set(task.month, list);
    }
    return map;
  }, [tasks]);

  // Show the rolling 12 months plus any other months that still hold tasks.
  const shownMonths = useMemo(() => {
    const extra = [...byMonth.keys()].filter((m) => !months.includes(m));
    return [...extra.filter((m) => m < thisMonth), ...months, ...extra.filter((m) => m > months[11])].sort();
  }, [byMonth, months, thisMonth]);

  const hasTasks = tasks.length > 0;
  const hasCrops = crops.length > 0;

  // Calendar pager: one month visible at a time; arrows flip through the year.
  const [selMonth, setSelMonth] = useState(thisMonth);

  // Arriving from the home-screen reminder (?focus=now): make sure the pager
  // shows the current month and its pending tasks are in view.
  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current || isLoading) return;
    if (!window.location.search.includes("focus=now")) return;
    focusedRef.current = true;
    setSelMonth(thisMonth);
  }, [isLoading, thisMonth]);
  const selIdx = shownMonths.indexOf(selMonth);
  const canPrev = selIdx > 0;
  const canNext = selIdx >= 0 && selIdx < shownMonths.length - 1;

  // Tapping a calendar date filters the lists to that day and lets the farmer
  // write their own schedule for it. Cleared when the month is flipped.
  const [selDay, setSelDay] = useState<number | null>(null);
  useEffect(() => setSelDay(null), [selMonth]);

  const selTasks = byMonth.get(selMonth) ?? [];
  // Day-scheduled tasks first (in date order), whole-month tasks after.
  const byDay = (a: PlanTask, b: PlanTask) => (a.day ?? 99) - (b.day ?? 99);
  const dayFilter = (x: PlanTask) => selDay == null || x.day === selDay;
  const pending = selTasks.filter((x) => !x.done && dayFilter(x)).sort(byDay);
  const completed = selTasks.filter((x) => x.done && dayFilter(x)).sort(byDay);
  const pendingDays = useMemo(
    () => new Set(selTasks.filter((x) => !x.done && x.day != null).map((x) => x.day!)),
    [selTasks],
  );
  const doneDays = useMemo(
    () => new Set(selTasks.filter((x) => x.done && x.day != null).map((x) => x.day!)),
    [selTasks],
  );
  // Work left unfinished in earlier months follows you into the current month
  // as "pending works" — old months don't clutter the view otherwise.
  const overdue = useMemo(
    () => (selMonth === thisMonth ? tasks.filter((x) => !x.done && x.month < thisMonth) : []),
    [selMonth, thisMonth, tasks],
  );

  const openAdd = (month: string, day?: number | null) =>
    setForm({ id: null, month, day: day != null ? String(day) : "", title: "", details: "", category: "other", cropId: "" });
  const openEdit = (task: PlanTask) =>
    setForm({
      id: task.id,
      month: task.month,
      day: task.day != null ? String(task.day) : "",
      title: task.title,
      details: task.details ?? "",
      category: CATEGORIES.includes(task.category as never) ? task.category : "other",
      cropId: task.cropId != null ? String(task.cropId) : "",
    });

  // One task card; monthTag marks leftover work carried in from an earlier month.
  const renderTask = (task: PlanTask, monthTag?: string) => {
    const Icon = CAT_ICON[task.category] ?? Wrench;
    return (
      <div
        key={task.id}
        className={cn("rounded-xl border bg-card p-3 flex gap-3 items-start", task.done && "opacity-60")}
      >
        <button type="button" className="mt-0.5 shrink-0" onClick={() => toggleDone.mutate(task)} aria-label={task.title}>
          {task.done
            ? <CheckCircle2 className="w-6 h-6 text-primary" />
            : <Circle className="w-6 h-6 text-muted-foreground/50" />}
        </button>
        <div className="min-w-0 flex-1">
          {monthTag && (
            <span className="inline-block text-[11px] font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full mb-1">
              {t("yp.overdue")} {monthTag}
            </span>
          )}
          <div className={cn("font-medium leading-snug", task.done && "line-through")}>
            {task.day != null && (
              <span className="inline-flex items-center justify-center min-w-6 h-6 px-1 mr-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold align-middle">
                {task.day}
              </span>
            )}
            {task.title}
          </div>
          {task.details && (
            <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{task.details}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", CAT_CHIP[task.category] ?? CAT_CHIP.other)}>
              <Icon className="w-3 h-3" />
              {t(`yp.cat.${CATEGORIES.includes(task.category as never) ? task.category : "other"}`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {task.cropId != null ? cropName(task.cropId) ?? "" : t("yp.wholeFarm")}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button" className="p-1 text-muted-foreground" onClick={() => openEdit(task)} aria-label={t("yp.editTask")}>
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 text-muted-foreground"
            onClick={() => { if (confirm(t("yp.deleteConfirm"))) remove.mutate(task.id); }}
            aria-label={t("yp.deleteConfirm")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <PageShell title={t("more.yearPlan")} back="/">
      <div className="p-4 space-y-4 pb-24">
        <p className="text-sm text-muted-foreground -mt-1">{t("yp.subtitle")}</p>
        {/* Generate / regenerate */}
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <Button
            className="w-full"
            disabled={generate.isPending || !hasCrops}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("yp.generating")}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />{hasTasks ? t("yp.regenerate") : t("yp.generate")}</>
            )}
          </Button>
          {!hasCrops ? (
            <div className="text-sm text-muted-foreground">
              {t("yp.noCrops")}{" "}
              <Link href="/crops" className="text-primary font-medium underline underline-offset-2">
                {t("yp.goCrops")}
              </Link>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {hasTasks ? t("yp.regenNote") : t("yp.emptyHint")}
            </p>
          )}
          {hasTasks && <p className="text-xs text-muted-foreground">{t("yp.aiNote")}</p>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasTasks ? (
          <div className="text-center py-8 text-muted-foreground">
            <Leaf className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium text-foreground">{t("yp.empty")}</p>
          </div>
        ) : (
          <>
            {/* Calendar: flip month by month */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-2 py-2 bg-primary/5">
                <button
                  type="button"
                  onClick={() => canPrev && setSelMonth(shownMonths[selIdx - 1])}
                  disabled={!canPrev}
                  className="p-2 rounded-full text-primary disabled:opacity-25"
                  aria-label="previous month"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                  <div className="font-bold text-lg leading-tight">{monthLabel(selMonth)}</div>
                  {pending.length + (selDay == null ? overdue.length : 0) > 0 ? (
                    <div className="text-xs text-primary font-medium">
                      {t("yp.pending")}: {pending.length + (selDay == null ? overdue.length : 0)}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{completed.length > 0 ? `${t("yp.completed")}: ${completed.length}` : t("yp.noneThisMonth")}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => canNext && setSelMonth(shownMonths[selIdx + 1])}
                  disabled={!canNext}
                  className="p-2 rounded-full text-primary disabled:opacity-25"
                  aria-label="next month"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              <MonthGrid
                month={selMonth}
                lang={lang}
                todayLabel={t("yp.today")}
                pendingDays={pendingDays}
                doneDays={doneDays}
                selectedDay={selDay}
                onSelectDay={(d) => setSelDay((cur) => (cur === d ? null : d))}
              />
              {selDay != null && (
                <div className="flex items-center justify-between gap-2 px-3 pb-3 -mt-1">
                  <span className="text-sm font-medium text-primary">
                    {new Date(Number(selMonth.slice(0, 4)), Number(selMonth.slice(5)) - 1, selDay)
                      .toLocaleDateString(lang === "en" ? "en-IN" : lang, { day: "numeric", month: "long", weekday: "long" })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAdd(selMonth, selDay)}
                      className="inline-flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground rounded-full px-3 py-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />{t("yp.addTask")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelDay(null)}
                      className="p-1.5 rounded-full bg-muted text-muted-foreground"
                      aria-label="clear day"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pending works for the flipped month */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">{t("yp.pending")}</h3>
                <button
                  type="button"
                  onClick={() => openAdd(selMonth, selDay)}
                  className="p-1.5 rounded-full bg-primary/10 text-primary"
                  aria-label={t("yp.addTask")}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {pending.length === 0 && (selDay != null || overdue.length === 0) ? (
                <p className="text-sm text-muted-foreground py-2">{t("yp.noneThisMonth")}</p>
              ) : (
                <div className="space-y-2">
                  {selDay == null && overdue.map((task) => renderTask(task, monthLabel(task.month)))}
                  {pending.map((task) => renderTask(task))}
                </div>
              )}
            </section>

            {/* Finished work stays out of the way */}
            {completed.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {t("yp.completed")} ({completed.length})
                </h3>
                <div className="space-y-2">{completed.map((task) => renderTask(task))}</div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Add / edit sheet */}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="bg-background w-full rounded-t-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{form.id != null ? t("yp.editTask") : t("yp.addTask")}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="close"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-1">
              <Label>{t("yp.taskTitle")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t("yp.detailsLbl")}</Label>
              <Textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("yp.monthLbl")}</Label>
                <Select
                  value={form.month}
                  onValueChange={(v) => {
                    // Keep the day valid when moving to a shorter month.
                    const d = form.day && Number(form.day) > daysIn(v) ? "" : form.day;
                    setForm({ ...form, month: v, day: d });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(months.includes(form.month) ? months : [form.month, ...months]).map((m) => (
                      <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("yp.dayLbl")}</Label>
                <Select value={form.day || "any"} onValueChange={(v) => setForm({ ...form, day: v === "any" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("yp.wholeMonth")}</SelectItem>
                    {Array.from({ length: daysIn(form.month) }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("yp.category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`yp.cat.${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("yp.cropLbl")}</Label>
                <Select value={form.cropId || "all"} onValueChange={(v) => setForm({ ...form, cropId: v === "all" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("yp.wholeFarm")}</SelectItem>
                    {crops.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.title.trim() || saveTask.isPending}
              onClick={() => saveTask.mutate(form)}
            >
              {saveTask.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("yp.save")}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
