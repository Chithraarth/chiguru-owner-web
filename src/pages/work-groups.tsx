import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plus, FolderOpen, X, Loader2, ChevronRight, Banknote, TrendingDown, Camera, Users, CreditCard, Trash2
} from "lucide-react";
import { useForm } from "react-hook-form";
import { SelectOrType } from "@/components/select-or-type";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, apiMutate, apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface WorkGroup {
  id: number; name: string;
  blockName?: string; category: string; labourType: string;
  paymentType: string; rate: number; isActive: boolean; totalCostToDate: number;
  advancePerUnit?: number; payFrequency?: string; seasonClosed?: boolean;
  expectedWorkers?: number; loanTaken?: number; loanNotes?: string;
}

const CATEGORIES = [
  "Harvest / Cutting", "Pruning", "Manuring", "Drone spraying",
  "Fertilizer application", "Weeding", "Irrigation", "Planting", "Custom"
];
const LABOUR_TYPES = ["General labour", "Skilled labour", "Machine operator", "Drone operator", "Contractor"];
const PAYMENT_TYPES = ["Per day", "Per hour", "Per acre", "Per kg"];
const PAY_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly-5", label: "Every 5 days" },
  { value: "weekly-6", label: "Every 6 days" },
  { value: "weekly-7", label: "Every 7 days" },
  { value: "monthly", label: "Monthly" },
];

interface WGForm {
  name: string; blockName: string; expectedWorkers: string;
  category: string; labourType: string; paymentType: string; rate: string;
  advancePerUnit: string; payFrequency: string;
  loanTaken: string; loanNotes: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Harvest / Cutting": "bg-yellow-100 text-yellow-700",
  "Pruning": "bg-primary/5 text-primary",
  "Manuring": "bg-amber-50 text-amber-700",
  "Drone spraying": "bg-blue-50 text-blue-700",
  "Fertilizer application": "bg-accent/5 text-accent",
  "Weeding": "bg-primary/5 text-primary",
  "Irrigation": "bg-cyan-50 text-cyan-700",
  "Planting": "bg-primary/10 text-primary",
  "Custom": "bg-gray-100 text-gray-700",
};

export default function WorkGroups() {
  // "?new=1" (from the dashboard's "Create a group" shortcut) opens the form right away.
  const [showForm, setShowForm] = useState(
    () => new URLSearchParams(window.location.search).get("new") === "1"
  );
  const [confirmDelete, setConfirmDelete] = useState<WorkGroup | null>(null);
  const [aiScanning, setAiScanning] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useQuery<WorkGroup[]>({
    queryKey: ["work-groups"],
    queryFn: () => apiFetch("/work-groups"),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<WGForm>({
    defaultValues: { labourType: "General labour", paymentType: "Per day", category: "Weeding", payFrequency: "daily" }
  });

  const rateVal = parseFloat(watch("rate") || "0");
  const advanceVal = parseFloat(watch("advancePerUnit") || "0");
  const remainingVal = isNaN(rateVal - advanceVal) ? 0 : Math.max(0, rateVal - advanceVal);
  const workerCountVal = watch("expectedWorkers");

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/work-groups", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-groups"] });
      setShowForm(false);
      reset();
      toast({ title: "Work group created" });
    },
    onError: () => toast({ title: "Error creating work group", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/work-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-groups"] });
      setConfirmDelete(null);
      toast({ title: "Group deleted" });
    },
    onError: () => toast({ title: "Could not delete group", variant: "destructive" }),
  });

  function onSubmit(data: WGForm) {
    create.mutate({
      name: data.name,
      blockName: data.blockName || undefined,
      category: data.category,
      labourType: data.labourType,
      paymentType: data.paymentType,
      rate: parseFloat(data.rate),
      advancePerUnit: data.advancePerUnit ? parseFloat(data.advancePerUnit) : undefined,
      payFrequency: data.payFrequency || "daily",
      expectedWorkers: data.expectedWorkers ? parseInt(data.expectedWorkers) : undefined,
      loanTaken: data.loanTaken ? parseFloat(data.loanTaken) : undefined,
      loanNotes: data.loanNotes || undefined,
    });
  }

  async function handleCameraScan(file: File) {
    setAiScanning(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      try {
        const res = await fetch(apiUrl("/ai/count-workers"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI failed");
        const count: number = data.count ?? 0;
        setValue("expectedWorkers", String(count));
        toast({ title: `AI counted ${count} worker${count !== 1 ? "s" : ""} in the photo` });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "AI scan failed";
        toast({ title: msg, variant: "destructive" });
      } finally {
        setAiScanning(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <PageShell
      title="Work Groups"
      back="/"
      action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-white text-primary rounded-full pl-2 pr-3 h-8 text-xs font-semibold">
          <Plus className="h-4 w-4" /> Add Group
        </button>
      }
    >
      <div className="p-4 space-y-3">

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No attendance groups yet</p>
            <p className="text-xs mt-1 max-w-[200px] mx-auto text-gray-300">
              Attendance groups track workers for each activity (pruning, weeding, spraying…)
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Create group
            </Button>
          </div>
        ) : (
          groups.map((g) => {
            const advance = g.advancePerUnit ? Number(g.advancePerUnit) : 0;
            const remaining = advance > 0 ? Number(g.rate) - advance : 0;
            return (
              <Link key={g.id} href={`/work-groups/${g.id}/attendance`} className="block">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.99] transition-transform">
                  <div className={`rounded-xl p-2.5 flex-shrink-0 ${CATEGORY_COLORS[g.category] ?? "bg-gray-100 text-gray-700"}`}>
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{g.name}</p>
                      {g.seasonClosed && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Closed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {g.expectedWorkers != null && (
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
                          <Users className="h-3 w-3" />{g.expectedWorkers} workers
                        </span>
                      )}
                      {g.loanTaken != null && Number(g.loanTaken) > 0 && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">
                          <CreditCard className="h-3 w-3" />Loan {fmtMoney(Number(g.loanTaken))}
                        </span>
                      )}
                      {g.blockName && <span className="text-xs text-gray-400">· {g.blockName}</span>}
                      <span className="text-xs text-gray-400">· {g.labourType}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-primary font-medium">
                        {fmtMoney(g.rate)} {g.paymentType.toLowerCase()}
                      </span>
                      {advance > 0 && (
                        <span className="text-xs text-amber-700 font-medium flex items-center gap-0.5">
                          <TrendingDown className="h-3 w-3" />
                          {fmtMoney(advance)} adv + {fmtMoney(remaining)} held
                        </span>
                      )}
                      {g.totalCostToDate > 0 && (
                        <span className="text-xs text-gray-400">
                          Total: {fmtMoney(Number(g.totalCostToDate))}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    aria-label={`Delete ${g.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(g);
                    }}
                    className="flex-shrink-0 p-2 -mr-1 text-gray-300 active:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">➕ New Work Group</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Work name *</Label>
              <Input {...register("name", { required: true })} placeholder="e.g. Coffee pruning – Block A" className="mt-1" />
              {errors.name && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>

            {/* Workers count with AI */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Workers in this group
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">Number of workers</Label>
                  <Input
                    {...register("expectedWorkers")}
                    type="number"
                    placeholder="e.g. 10, 20, 30…"
                    className="mt-1"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={aiScanning}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium h-9 disabled:opacity-60"
                >
                  {aiScanning
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />}
                  {aiScanning ? "Counting…" : "AI Count"}
                </button>
              </div>
              {workerCountVal && !aiScanning && (
                <p className="text-xs text-blue-600">
                  {workerCountVal} workers will be tracked in this group
                </p>
              )}
              <p className="text-xs text-gray-400">
                Take a photo of workers — AI will count heads automatically
              </p>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCameraScan(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Block/Area</Label>
                <Input {...register("blockName")} placeholder="e.g. Block A" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Work category</Label>
                <SelectOrType
                  options={CATEGORIES}
                  value={watch("category") || ""}
                  onChange={(v) => setValue("category", v)}
                  typePlaceholder="Type work category…"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Labour type</Label>
              <SelectOrType
                options={LABOUR_TYPES}
                value={watch("labourType") || ""}
                onChange={(v) => setValue("labourType", v)}
                typePlaceholder="Type labour type…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Payment type</Label>
                <SelectOrType
                  options={PAYMENT_TYPES}
                  value={watch("paymentType") || ""}
                  onChange={(v) => setValue("paymentType", v)}
                  typePlaceholder="Type payment type…"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Total rate ({curSymbol()}) *</Label>
                <Input {...register("rate", { required: true })} type="number" placeholder="450" className="mt-1" />
              </div>
            </div>

            {/* Advance payment section */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-amber-700">💰 Advance Payment Setup</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Advance per day ({curSymbol()})</Label>
                  <Input
                    {...register("advancePerUnit")}
                    type="number"
                    placeholder="e.g. 200"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Amount held ({curSymbol()})</Label>
                  <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-gray-50 px-3 text-sm text-gray-500">
                    {remainingVal > 0 ? `${fmtMoney(remainingVal)}` : "—"}
                  </div>
                </div>
              </div>
              {advanceVal > 0 && rateVal > 0 && (
                <p className="text-xs text-amber-600">
                  Workers get {fmtMoney(advanceVal)} now · {fmtMoney(remainingVal)} paid at season end
                </p>
              )}
              <div>
                <Label className="text-xs text-gray-500">Pay advance every</Label>
                <SelectOrType
                  options={PAY_FREQUENCIES.map((f) => f.value)}
                  labels={Object.fromEntries(PAY_FREQUENCIES.map((f) => [f.value, f.label]))}
                  value={watch("payFrequency") || ""}
                  onChange={(v) => setValue("payFrequency", v)}
                  typePlaceholder="Type frequency…"
                />
              </div>
            </div>

            {/* Loan taken section */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                💳 Loan Taken (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Loan amount ({curSymbol()})</Label>
                  <Input
                    {...register("loanTaken")}
                    type="number"
                    placeholder="e.g. 5000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Reason / Notes</Label>
                  <Input
                    {...register("loanNotes")}
                    placeholder="e.g. medical, personal"
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Record any loan workers in this group have taken upfront
              </p>
            </div>

            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={create.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Work Group"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Confirm delete group ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2.5 bg-red-100 text-red-600 flex-shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">Delete this group?</h2>
                <p className="text-sm text-gray-500 truncate">{confirmDelete.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              The group moves to the Recycle Bin with all its attendance days, advance
              payments and work photos. You can restore it from the bin (in the menu)
              within 30 days.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={() => del.mutate(confirmDelete.id)}
                disabled={del.isPending}
                className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700 text-white"
              >
                {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete group"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
