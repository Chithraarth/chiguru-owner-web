import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Banknote, Trash2, Camera, Image as ImageIcon, Filter, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, apiMutate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface Expense {
  id: number; date: string; cropId?: number; cropName?: string;
  category: string; amount: number; description?: string; vendor?: string;
  hasReceipt?: boolean; addedBy?: string | null;
}

type PeriodFilter = "all" | "week" | "month" | "6months" | "year";

const PERIODS: Array<{ value: PeriodFilter; label: string }> = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "6months", label: "Last 6 months" },
  { value: "year", label: "Last 1 year" },
];

function toDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns the earliest date (YYYY-MM-DD, inclusive) for the period, or null for "all".
function periodStart(p: PeriodFilter): string | null {
  const d = new Date();
  switch (p) {
    case "week":
      d.setDate(d.getDate() - 7);
      break;
    case "month":
      d.setMonth(d.getMonth() - 1);
      break;
    case "6months":
      d.setMonth(d.getMonth() - 6);
      break;
    case "year":
      d.setFullYear(d.getFullYear() - 1);
      break;
    default:
      return null;
  }
  return toDayString(d);
}
interface Crop { id: number; name: string; variety?: string }

// Two crops can share a name (e.g. "Coffee" in different blocks/varieties) —
// append the variety so the dropdown never shows indistinguishable duplicates.
function cropLabel(c: Crop): string {
  return c.variety ? `${c.name} (${c.variety})` : c.name;
}

const CATEGORIES = [
  "Fertilizer", "Pesticide", "Fungicide", "Seeds / Seedlings",
  "Labour", "Equipment", "Fuel", "Water / Irrigation",
  "Transport", "Storage", "Electricity", "Other"
];

interface ExpForm {
  date: string; cropId: string; category: string;
  amount: string; description: string; vendor: string;
}

function fmt(n: number) {
  return fmtMoney(n, 0);
}

interface HeaderFilterProps {
  active: boolean;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  align?: "left" | "right";
  ariaLabel: string;
}

function HeaderFilter({ active, options, value, onChange, align = "left", ariaLabel }: HeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(ev: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={toggle}
        className={`ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md align-middle ${
          active ? "bg-primary/15 text-primary" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Filter className="h-3.5 w-3.5" fill={active ? "currentColor" : "none"} />
      </button>
      {open && pos && (
        <div
          className="fixed z-50 min-w-[170px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg normal-case"
          style={align === "right" ? { top: pos.top, right: pos.right } : { top: pos.top, left: pos.left }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm font-normal tracking-normal ${
                o.value === value ? "text-primary font-medium bg-primary/5" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="h-4 w-4 shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReceiptThumb({ expenseId, onView }: { expenseId: number; onView: (img: string) => void }) {
  const { data, isLoading, isError } = useQuery<{ receiptUrl: string }>({
    queryKey: ["expense-receipt", expenseId],
    queryFn: () => apiFetch(`/expenses/${expenseId}/receipt`),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }
  if (isError || !data?.receiptUrl) {
    return (
      <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-300">
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onView(data.receiptUrl)}
      className="block h-10 w-10 rounded-lg overflow-hidden border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
      aria-label="View bill photo"
    >
      <img src={data.receiptUrl} alt="Bill" className="h-full w-full object-cover" loading="lazy" />
    </button>
  );
}

function compressImage(file: File, maxSize = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        let out = canvas.toDataURL("image/jpeg", quality);
        if (out.length > 650_000) out = canvas.toDataURL("image/jpeg", 0.5);
        if (out.length > 650_000) { reject(new Error("too-large")); return; }
        resolve(out);
      };
      img.onerror = () => reject(new Error("image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

export default function Expenses() {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Fertilizer");
  const [customCategory, setCustomCategory] = useState("");
  const [cropSel, setCropSel] = useState("");
  const [newCropName, setNewCropName] = useState("");
  const [billImage, setBillImage] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const billCameraRef = useRef<HTMLInputElement>(null);
  const billGalleryRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
  });
  const { data: crops = [] } = useQuery<Crop[]>({
    queryKey: ["crops"],
    queryFn: () => apiFetch("/crops"),
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ExpForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), category: "Fertilizer" }
  });

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiMutate("POST", "/expenses", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
      reset({ date: new Date().toISOString().slice(0, 10), category: "Fertilizer" });
      setCategory("Fertilizer");
      setCustomCategory("");
      setCropSel("");
      setNewCropName("");
      setBillImage(null);
      toast({ title: "Expense saved" });
    },
    onError: () => toast({ title: "Error saving expense", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  async function onBillFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setBillImage(dataUrl);
    } catch (err) {
      toast({
        title: err instanceof Error && err.message === "too-large"
          ? "Photo is too large, try again"
          : "Could not read the photo",
        variant: "destructive",
      });
    }
  }

  async function onSubmit(data: ExpForm) {
    if (!billImage) {
      toast({ title: "Bill photo required", description: "Please add a photo of the bill as proof of expense", variant: "destructive" });
      return;
    }
    const finalCategory = category === "Other"
      ? (customCategory.trim() || "Other")
      : category;
    let cropId: number | undefined;
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
    } else if (cropSel) {
      cropId = parseInt(cropSel);
    }
    create.mutate({
      date: data.date,
      cropId,
      category: finalCategory,
      amount: parseFloat(data.amount),
      description: data.description || undefined,
      vendor: data.vendor || undefined,
      receiptUrl: billImage,
      addedBy: "Owner",
    });
  }

  // People who have added expenses (for the "Added by" filter)
  const people = Array.from(
    new Set(expenses.map((e) => e.addedBy).filter((n): n is string => !!n))
  ).sort();

  const start = periodStart(period);
  const filtered = expenses.filter((e) => {
    if (start && e.date.slice(0, 10) < start) return false;
    if (personFilter !== "all" && (e.addedBy ?? "") !== personFilter) return false;
    return true;
  });

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <PageShell
      title="Expenses"
      back="/farm-accounts"
    >
      <div className="p-4 space-y-4">
        {expenses.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <p className="text-xs text-primary font-medium">
                {period === "all" && personFilter === "all" ? "Total expenses" : "Total (filtered)"}
              </p>
              <p className="text-2xl font-bold text-primary mt-0.5">{fmt(total)}</p>
            </div>
            <Button
              onClick={() => { setCustomCategory(""); setShowForm(true); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add expense
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No expenses yet</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Add expense
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No expenses match these filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px] table-fixed">
              <thead>
                <tr className="border-b border-gray-100 text-center text-xs text-gray-500 uppercase">
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">
                    Date
                    <HeaderFilter
                      active={period !== "all"}
                      options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
                      value={period}
                      onChange={(v) => setPeriod(v as PeriodFilter)}
                      ariaLabel="Filter by period"
                    />
                  </th>
                  <th className="px-2 py-3 font-semibold">Category</th>
                  <th className="px-2 py-3 font-semibold">Details</th>
                  <th className="px-2 py-3 font-semibold whitespace-nowrap">
                    Added by
                    <HeaderFilter
                      active={personFilter !== "all"}
                      options={[{ value: "all", label: "Everyone" }, ...people.map((p) => ({ value: p, label: p }))]}
                      value={personFilter}
                      onChange={setPersonFilter}
                      ariaLabel="Filter by person"
                    />
                  </th>
                  <th className="px-2 py-3 font-semibold">Amount</th>
                  <th className="px-2 py-3 font-semibold">Bill</th>
                  <th className="px-2 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0 text-center">
                    <td className="px-2 py-3 text-gray-600 whitespace-nowrap">{e.date}</td>
                    <td className="px-2 py-3">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{e.category}</span>
                    </td>
                    <td className="px-2 py-3 text-gray-700">
                      <p className="truncate">{e.description || e.category}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {[e.cropName, e.vendor].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-gray-600 truncate">{e.addedBy || "—"}</td>
                    <td className="px-2 py-3 font-bold text-gray-800 whitespace-nowrap">{fmt(Number(e.amount))}</td>
                    <td className="px-2 py-3">
                      {e.hasReceipt ? (
                        <div className="flex justify-center">
                          <ReceiptThumb expenseId={e.id} onView={setViewImage} />
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center">
                        <button onClick={() => remove.mutate(e.id)} className="text-gray-300 hover:text-red-400 p-1" aria-label="Delete expense">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Add Expense</h2>
              <button onClick={() => { setShowForm(false); setNewCropName(""); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Date</Label>
                <Input {...register("date", { required: true })} type="date" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Amount ({curSymbol()}) *</Label>
                <Input {...register("amount", { required: true })} type="number" step="0.01" placeholder="0.00" className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => { setCategory(v); setValue("category", v); }}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "Other" ? "Other (type your own)" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {category === "Other" && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type expense name, e.g. Tractor rent"
                  className="mt-2"
                  autoFocus
                />
              )}
            </div>

            <div>
              <Label className="text-xs text-gray-500">Crop (optional)</Label>
              <Select value={cropSel || undefined} onValueChange={setCropSel}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All crops / Farm-wide" /></SelectTrigger>
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

            <div>
              <Label className="text-xs text-gray-500">Description</Label>
              <Input {...register("description")} placeholder="e.g. DAP fertilizer 50kg" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Vendor / Shop</Label>
              <Input {...register("vendor")} placeholder="e.g. Krishna Agro Store" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs text-gray-500">Bill / Receipt photo * <span className="text-gray-400">(proof of expense)</span></Label>
              <input ref={billCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onBillFile} />
              <input ref={billGalleryRef} type="file" accept="image/*" className="hidden" onChange={onBillFile} />
              {billImage ? (
                <div className="mt-2 relative inline-block">
                  <img src={billImage} alt="Bill preview" className="h-24 rounded-xl border border-gray-200 object-cover" />
                  <button
                    onClick={() => setBillImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
                    aria-label="Remove bill photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => billCameraRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl text-amber-700 font-medium text-sm active:bg-amber-100"
                  >
                    <Camera className="h-4 w-4" /> Take photo
                  </button>
                  <button
                    type="button"
                    onClick={() => billGalleryRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium text-sm active:bg-gray-50"
                  >
                    <ImageIcon className="h-4 w-4" /> From gallery
                  </button>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={create.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Expense"}
            </Button>
          </div>
        </div>
      )}

      {viewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewImage(null)}
          onKeyDown={(ev) => { if (ev.key === "Escape") setViewImage(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Bill photo"
        >
          <button
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 bg-white/20 text-white rounded-full p-2"
            aria-label="Close"
            autoFocus
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={viewImage}
            alt="Bill"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(ev) => ev.stopPropagation()}
          />
        </div>
      )}
    </PageShell>
  );
}
