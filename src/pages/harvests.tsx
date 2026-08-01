import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Leaf, Trash2, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectOrType } from "@/components/select-or-type";
import { GroupFolderList, buildGroupIds } from "@/components/group-folders";
import { apiFetch, apiMutate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface Harvest {
  id: number; date: string; cropId: number; cropName?: string; blockName?: string;
  workGroupId?: number | null; workGroupName?: string | null;
  weightKg: number; grade?: string; pricePerKg: number; totalIncome: number;
  buyer?: string; paymentStatus: string;
}
interface Crop { id: number; name: string; variety?: string }

// Two crops can share a name (e.g. "Coffee" in different blocks/varieties) —
// append the variety so the dropdown never shows indistinguishable duplicates.
function cropLabel(c: Crop): string {
  return c.variety ? `${c.name} (${c.variety})` : c.name;
}
interface WorkGroup { id: number; name: string; isActive?: boolean }

const GRADES = ["A Grade", "B Grade", "C Grade", "Mixed", "Cherry", "Parchment", "Dry"];
const PAYMENT_STATUS = ["pending", "partial", "paid"];

interface HarvestForm {
  date: string; cropId: string; blockName: string; weightKg: string;
  grade: string; pricePerKg: string; buyer: string; paymentStatus: string;
}

function fmt(n: number) {
  return fmtMoney(n, 0);
}

export default function Harvests() {
  const [showForm, setShowForm] = useState(false);
  const [quickAdd, setQuickAdd] = useState<"general" | "sold" | null>(null);
  const [openFolder, setOpenFolder] = useState<{ id: number | null; name: string } | null>(null);
  useSubScreenHistory(openFolder ? 1 : 0, () => setOpenFolder(null));
  const [cropSel, setCropSel] = useState("");
  const [newCropName, setNewCropName] = useState("");
  const [grade, setGrade] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: harvests = [], isLoading } = useQuery<Harvest[]>({
    queryKey: ["harvests"],
    queryFn: () => apiFetch("/harvests"),
  });
  const { data: crops = [] } = useQuery<Crop[]>({
    queryKey: ["crops"],
    queryFn: () => apiFetch("/crops"),
  });
  const { data: workGroups = [] } = useQuery<WorkGroup[]>({
    queryKey: ["work-groups"],
    queryFn: () => apiFetch("/work-groups"),
  });

  const { register, handleSubmit, setValue, watch, reset } = useForm<HarvestForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), paymentStatus: "pending" }
  });
  const watchWeight = watch("weightKg");
  const watchPrice = watch("pricePerKg");
  const estimatedIncome = (parseFloat(watchWeight) || 0) * (parseFloat(watchPrice) || 0);

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiMutate("POST", "/harvests", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["harvests"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
      setQuickAdd(null);
      reset({ date: new Date().toISOString().slice(0, 10), paymentStatus: "pending" });
      setCropSel(""); setNewCropName(""); setGrade(""); setPaymentStatus("pending");
      toast({ title: "Harvest recorded" });
    },
    onError: () => toast({ title: "Error saving harvest", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/harvests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["harvests"] }),
  });

  async function onSubmit(data: HarvestForm) {
    const wt = parseFloat(data.weightKg);
    const price = quickAdd === "general" ? 0 : parseFloat(data.pricePerKg);
    if (quickAdd === "sold" && !(price > 0)) {
      toast({ title: "Please enter the selling price per kg", variant: "destructive" });
      return;
    }
    let cropId: number;
    if (cropSel === "__new__") {
      const name = newCropName.trim();
      if (!name) {
        toast({ title: "Please type the crop name", variant: "destructive" });
        return;
      }
      try {
        const crop = await apiMutate<Crop>("POST", "/crops", { name });
        if (!crop) throw new Error("no response");
        qc.invalidateQueries({ queryKey: ["crops"] });
        cropId = crop.id;
      } catch {
        toast({ title: "Could not create crop", variant: "destructive" });
        return;
      }
    } else {
      cropId = parseInt(cropSel);
      if (!Number.isFinite(cropId)) {
        toast({ title: "Please select a crop", variant: "destructive" });
        return;
      }
    }
    create.mutate({
      date: data.date,
      cropId,
      workGroupId: quickAdd ? undefined : (openFolder?.id ?? undefined),
      blockName: data.blockName || undefined,
      weightKg: wt,
      grade: grade || undefined,
      pricePerKg: price,
      totalIncome: wt * price,
      buyer: quickAdd === "general" ? undefined : (data.buyer || undefined),
      paymentStatus: quickAdd === "general" ? "pending" : (quickAdd === "sold" ? "paid" : (paymentStatus || "pending")),
    });
  }

  const totalIncome = harvests.reduce((s, h) => s + Number(h.totalIncome), 0);
  const totalKg = harvests.reduce((s, h) => s + Number(h.weightKg), 0);

  // Folder list built automatically from Work Attendance groups (+ orphans).
  const groupList = buildGroupIds(workGroups, harvests);
  const generalHarvests = harvests.filter((h) => h.workGroupId == null);
  const folders = [
    ...groupList.map((g) => {
      const recs = harvests.filter((h) => h.workGroupId === g.id);
      const kg = recs.reduce((s, h) => s + Number(h.weightKg), 0);
      return {
        id: g.id as number | null,
        name: g.name,
        subtitle: recs.length === 0 ? "No harvests yet" : `${kg.toLocaleString("en-IN")} kg harvested`,
        count: recs.length,
        emoji: "👥",
        iconBg: "bg-blue-50",
      };
    }),
    {
      id: null,
      name: "General Harvests",
      subtitle: generalHarvests.length === 0 ? "Harvests without a group" : `${generalHarvests.reduce((s, h) => s + Number(h.weightKg), 0).toLocaleString("en-IN")} kg harvested`,
      count: generalHarvests.length,
      emoji: "🌾",
      iconBg: "bg-gray-100",
    },
  ];

  const folderHarvests = openFolder
    ? harvests.filter((h) => (h.workGroupId ?? null) === openFolder.id)
    : harvests;
  const folderKg = folderHarvests.reduce((s, h) => s + Number(h.weightKg), 0);
  const folderIncome = folderHarvests.reduce((s, h) => s + Number(h.totalIncome), 0);

  function goToFolder(f: { id: number | null; name: string } | null) {
    setShowForm(false);
    setOpenFolder(f);
  }

  return (
    <PageShell
      title={openFolder ? openFolder.name : "Harvest Records"}
      back={openFolder ? undefined : "/farm-accounts"}
      onBack={openFolder ? () => goToFolder(null) : undefined}
      action={
        openFolder ? (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-white text-primary rounded-full pl-2 pr-3 h-8 text-xs font-semibold">
            <Plus className="h-4 w-4" /> Add Harvest
          </button>
        ) : undefined
      }
    >
      <div className="p-4 space-y-4">
        {openFolder === null ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
                <p className="text-xs text-yellow-600 font-medium">Total income</p>
                <p className="text-xl font-bold text-yellow-700 mt-0.5">{fmt(totalIncome)}</p>
                <button
                  onClick={() => { setQuickAdd("sold"); setShowForm(true); }}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-full pl-1.5 pr-2.5 py-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Sold Harvest
                </button>
              </div>
              <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                <p className="text-xs text-primary font-medium">Total yield</p>
                <p className="text-xl font-bold text-primary mt-0.5">{totalKg.toLocaleString("en-IN")} kg</p>
                <button
                  onClick={() => { setQuickAdd("general"); setShowForm(true); }}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 rounded-full pl-1.5 pr-2.5 py-1"
                >
                  <Plus className="h-3.5 w-3.5" /> General Harvest
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <GroupFolderList folders={folders} onOpen={(f) => goToFolder({ id: f.id, name: f.name })} />
            )}
          </>
        ) : (
          <>
            {folderHarvests.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
                  <p className="text-xs text-yellow-600 font-medium">Income</p>
                  <p className="text-xl font-bold text-yellow-700 mt-0.5">{fmt(folderIncome)}</p>
                </div>
                <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                  <p className="text-xs text-primary font-medium">Yield</p>
                  <p className="text-xl font-bold text-primary mt-0.5">{folderKg.toLocaleString("en-IN")} kg</p>
                </div>
              </div>
            )}

            {folderHarvests.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Leaf className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No harvests for {openFolder.name} yet</p>
                <Button onClick={() => setShowForm(true)} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-1" /> Record harvest
                </Button>
              </div>
            ) : (
          <div className="space-y-3">
            {folderHarvests.map((h) => (
              <div key={h.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{h.cropName ?? "—"}</span>
                      {h.grade && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{h.grade}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        h.paymentStatus === "paid" ? "bg-primary/10 text-primary" :
                        h.paymentStatus === "partial" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{h.paymentStatus}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {h.date}{h.blockName ? ` · ${h.blockName}` : ""}{h.buyer ? ` · ${h.buyer}` : ""}
                    </p>
                    {h.workGroupName && (
                      <p className="text-xs text-blue-600 mt-0.5">👥 {h.workGroupName}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      {Number(h.weightKg).toLocaleString("en-IN")} kg × {fmtMoney(Number(h.pricePerKg))}/kg
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-bold text-primary flex items-center gap-0.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {fmt(Number(h.totalIncome))}
                      </p>
                    </div>
                    <button onClick={() => remove.mutate(h.id)} className="text-gray-200 hover:text-red-400 ml-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
            )}
          </>
        )}
      </div>

      {showForm && (openFolder || quickAdd) && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {quickAdd === "sold" ? "Record Sold Harvest" : quickAdd === "general" ? "Record General Harvest" : "Record Harvest"}
                </h2>
                <p className="text-xs text-blue-600 font-semibold">
                  {quickAdd
                    ? (quickAdd === "sold" ? "💰 Sold — adds to Total income" : "🌾 General — adds to Total yield")
                    : openFolder!.id != null ? `👥 ${openFolder!.name}` : "🌾 General"}
                </p>
              </div>
              <button onClick={() => { setShowForm(false); setQuickAdd(null); setNewCropName(""); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Date</Label>
                <Input {...register("date")} type="date" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Crop *</Label>
                <Select value={cropSel || undefined} onValueChange={setCropSel}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select crop" /></SelectTrigger>
                  <SelectContent>
                    {crops.map((c) => <SelectItem key={c.id} value={String(c.id)}>{cropLabel(c)}</SelectItem>)}
                    <SelectItem value="__new__">
                      <span className="text-primary font-medium">✏️ Type new crop</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {cropSel === "__new__" && (
                  <Input
                    value={newCropName}
                    onChange={(e) => setNewCropName(e.target.value)}
                    placeholder="Type crop name, e.g. Pepper"
                    className="mt-2"
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Weight (kg) *</Label>
                <Input {...register("weightKg", { required: true })} type="number" step="0.1" placeholder="500" className="mt-1" />
              </div>
              {quickAdd !== "general" && (
                <div>
                  <Label className="text-xs text-gray-500">Price/kg ({curSymbol()}) *</Label>
                  <Input {...register("pricePerKg", { required: quickAdd === null })} type="number" step="0.01" placeholder="180" className="mt-1" />
                </div>
              )}
            </div>

            {quickAdd !== "general" && estimatedIncome > 0 && (
              <div className="bg-primary/5 rounded-xl p-3 text-center">
                <p className="text-sm text-primary">Expected income: <strong>{fmt(estimatedIncome)}</strong></p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Grade</Label>
                <SelectOrType
                  options={GRADES}
                  value={grade}
                  onChange={setGrade}
                  placeholder="Grade"
                  typePlaceholder="Type grade…"
                />
              </div>
              {quickAdd !== "general" && quickAdd !== "sold" && (
                <div>
                  <Label className="text-xs text-gray-500">Payment status</Label>
                  <SelectOrType
                    options={PAYMENT_STATUS}
                    value={paymentStatus}
                    onChange={setPaymentStatus}
                    typePlaceholder="Type status…"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Block / Area</Label>
                <Input {...register("blockName")} placeholder="e.g. Block A" className="mt-1" />
              </div>
              {quickAdd !== "general" && (
                <div>
                  <Label className="text-xs text-gray-500">Buyer</Label>
                  <Input {...register("buyer")} placeholder="Buyer name" className="mt-1" />
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={create.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Harvest"}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
