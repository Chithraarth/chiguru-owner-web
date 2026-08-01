import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Sprout, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectOrType } from "@/components/select-or-type";
import { apiFetch, apiMutate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface Spray {
  id: number; date: string; cropId?: number; cropName?: string; blockName?: string;
  productName: string; productType?: string;
  concentrationPct?: number; barrelsUsed?: number;
  litresUsed: number; areaAcres: number;
  cost: number; weatherCondition?: string;
}
interface Crop { id: number; name: string; variety?: string }

// Two crops can share a name (e.g. "Coffee" in different blocks/varieties) —
// append the variety so the dropdown never shows indistinguishable duplicates.
function cropLabel(c: Crop): string {
  return c.variety ? `${c.name} (${c.variety})` : c.name;
}

const PRODUCT_TYPES = ["Fungicide", "Insecticide", "Herbicide", "Foliar fertilizer", "Bio-pesticide", "Other"];
const WEATHER = ["Clear", "Cloudy", "Light rain risk", "Humid", "Windy"];

interface SprayForm {
  date: string; cropId: string; blockName: string; productName: string; productType: string;
  concentrationPct: string; barrelsUsed: string; costPerLitre: string;
  litresUsed: string; areaAcres: string; cost: string; weatherCondition: string;
}

export default function Sprays() {
  const [showForm, setShowForm] = useState(false);
  const [cropSel, setCropSel] = useState("");
  const [newCropName, setNewCropName] = useState("");
  const [productType, setProductType] = useState("Fungicide");
  const [weather, setWeather] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sprays = [], isLoading } = useQuery<Spray[]>({
    queryKey: ["sprays"],
    queryFn: () => apiFetch("/sprays"),
  });
  const { data: crops = [] } = useQuery<Crop[]>({
    queryKey: ["crops"],
    queryFn: () => apiFetch("/crops"),
  });

  const { register, handleSubmit, setValue, reset, control } = useForm<SprayForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), productType: "Fungicide" }
  });

  const litresUsed = useWatch({ control, name: "litresUsed" });
  const costPerLitre = useWatch({ control, name: "costPerLitre" });

  useEffect(() => {
    const l = parseFloat(litresUsed);
    const cpl = parseFloat(costPerLitre);
    if (!isNaN(l) && !isNaN(cpl) && l > 0 && cpl > 0) {
      setValue("cost", String((l * cpl).toFixed(2)));
    }
  }, [litresUsed, costPerLitre, setValue]);

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiMutate("POST", "/sprays", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprays"] });
      setShowForm(false);
      reset({ date: new Date().toISOString().slice(0, 10), productType: "Fungicide" });
      setCropSel(""); setNewCropName(""); setProductType("Fungicide"); setWeather("");
      toast({ title: "Spray recorded" });
    },
    onError: () => toast({ title: "Error saving spray record", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/sprays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprays"] }),
  });

  async function onSubmit(data: SprayForm) {
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
      blockName: data.blockName || undefined,
      productName: data.productName,
      productType: productType || undefined,
      concentrationPct: data.concentrationPct ? parseFloat(data.concentrationPct) : undefined,
      barrelsUsed: data.barrelsUsed ? parseFloat(data.barrelsUsed) : undefined,
      litresUsed: parseFloat(data.litresUsed),
      areaAcres: parseFloat(data.areaAcres),
      cost: parseFloat(data.cost),
      weatherCondition: weather || undefined,
    });
  }

  return (
    <PageShell
      title="Fertilisers, Sprays & Pesticides"
      back="/farm-accounts"
      action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-white text-primary rounded-full pl-2 pr-3 h-8 text-xs font-semibold">
          <Plus className="h-4 w-4" /> Add Record
        </button>
      }
    >
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : sprays.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Sprout className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No spray records yet</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Record spray
            </Button>
          </div>
        ) : (
          sprays.map((s) => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{s.productName}</span>
                    {s.productType && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s.productType}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-x-2">
                    <span>{s.date}</span>
                    {s.cropName && <span>· {s.cropName}</span>}
                    {s.blockName && <span>· {s.blockName}</span>}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                    <span>{s.litresUsed}L sprayed</span>
                    <span>{s.areaAcres} acres</span>
                    {s.concentrationPct != null && <span>{s.concentrationPct}% conc.</span>}
                    {s.barrelsUsed != null && <span>{s.barrelsUsed} barrels</span>}
                    {s.weatherCondition && <span>🌤 {s.weatherCondition}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700">{fmtMoney(Number(s.cost))}</span>
                  <button onClick={() => remove.mutate(s.id)} className="text-gray-200 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Record Spray</h2>
              <button onClick={() => { setShowForm(false); setNewCropName(""); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Date</Label>
                <Input {...register("date")} type="date" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Crop</Label>
                <Select value={cropSel || undefined} onValueChange={setCropSel}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All crops" /></SelectTrigger>
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
                <Label className="text-xs text-gray-500">Product name *</Label>
                <Input {...register("productName", { required: true })} placeholder="e.g. Blitox" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Product type</Label>
                <SelectOrType
                  options={PRODUCT_TYPES}
                  value={productType}
                  onChange={setProductType}
                  typePlaceholder="Type product type…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Concentration (%)</Label>
                <Input {...register("concentrationPct")} type="number" step="0.1" placeholder="e.g. 0.5" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Barrels used</Label>
                <Input {...register("barrelsUsed")} type="number" step="1" placeholder="e.g. 4" className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Litres used *</Label>
                <Input {...register("litresUsed", { required: true })} type="number" step="0.5" placeholder="50" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Acres covered *</Label>
                <Input {...register("areaAcres", { required: true })} type="number" step="0.1" placeholder="5" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Cost/litre ({curSymbol()})</Label>
                <Input {...register("costPerLitre")} type="number" step="0.5" placeholder="auto" className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Total cost ({curSymbol()}) *</Label>
              <Input {...register("cost", { required: true })} type="number" placeholder="auto-computed or enter" className="mt-1" />
              <p className="text-xs text-gray-400 mt-0.5">Auto-filled from litres × cost/litre; edit to override</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Block / Area</Label>
                <Input {...register("blockName")} placeholder="e.g. Block A" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Weather</Label>
                <SelectOrType
                  options={WEATHER}
                  value={weather}
                  onChange={setWeather}
                  placeholder="Condition"
                  typePlaceholder="Type weather…"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={create.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Spray Record"}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
