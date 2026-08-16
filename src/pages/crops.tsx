import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sprout, X, Loader2, Pencil, Check, Trash2, Leaf, ChevronDown, Plus, Merge } from "lucide-react";
import { useForm } from "react-hook-form";
import { SelectOrType } from "@/components/select-or-type";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { useEstate, type Estate } from "@/lib/use-estate";

interface Crop {
  id: number;
  name: string;
  variety?: string;
  acres: string;
  season: string;
  blockName?: string;
  notes?: string;
}

interface CropForm {
  name: string;
  variety: string;
  acres: string;
  season: string;
  blockName: string;
  notes: string;
}

interface EstateForm {
  farmName: string;
  totalAcres: string;
  state: string;
  district: string;
}

const CROP_NAMES = ["Coffee", "Pepper", "Cardamom", "Arecanut", "Sugarcane", "Banana", "Orange", "Other"];
const SEASONS = ["Annual", "Kharif", "Rabi", "Zaid", "Perennial"];

export default function Crops() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { estates, activeEstateId, setActiveEstate } = useEstate();

  const [showCropForm, setShowCropForm] = useState(false);
  const [editCrop, setEditCrop] = useState<Crop | null>(null);
  // Multi-add: several crops can be picked and saved in one go.
  const [multiNames, setMultiNames] = useState<string[]>([]);
  const [customCrop, setCustomCrop] = useState("");
  const [showEstateForm, setShowEstateForm] = useState(false);
  const [editEstate, setEditEstate] = useState<Estate | null>(null);
  // Estates are collapsed by default; tap the chevron to expand one and see its crops.
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Deep link: /crops?new=1 (dashboard "Add new estate") opens the New Estate
  // form directly, while the page behind still lists existing estates.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      openAddEstate();
      // Clean the query so closing the form doesn't reopen it on refresh.
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: crops = [], isLoading } = useQuery<Crop[]>({
    queryKey: ["crops", activeEstateId],
    queryFn: () => apiFetch("/crops"),
  });

  // ── Crop form ───────────────────────────────────────────────────────────────
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CropForm>({
    defaultValues: { season: "Annual" },
  });

  const createCrop = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/crops", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowCropForm(false);
      reset();
      toast({ title: t("estate.saved") });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const updateCrop = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiMutate("PATCH", `/crops/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      setEditCrop(null);
      setShowCropForm(false);
      reset();
      toast({ title: t("estate.saved") });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteCrop = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/crops/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crops"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: t("estate.removed") });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  // Merge one crop's records (harvests, sprays, expenses, plan tasks…) into
  // another crop, then remove the duplicate row. Used to clean up duplicate
  // crop entries that split totals.
  const [mergeCrop, setMergeCrop] = useState<Crop | null>(null);
  const mergeCropMutation = useMutation({
    mutationFn: ({ id, intoId }: { id: number; intoId: number }) =>
      apiMutate("POST", `/crops/${id}/merge`, { intoId }),
    onSuccess: () => {
      qc.invalidateQueries();
      setMergeCrop(null);
      toast({ title: t("estate.saved") });
    },
    onError: (err) => toast({ title: errorMessage(err, "Error"), variant: "destructive" }),
  });

  // ── Estate form ───────────────────────────────────────────────────────────────
  const estateFormHook = useForm<EstateForm>();

  // Surfaces the server's actual message (e.g. "You've reached your estate
  // limit…") instead of a generic "Error" — falls back to `fallback` only
  // when the server didn't send a JSON body (network failure, 5xx, etc.).
  function errorMessage(err: unknown, fallback: string): string {
    return (err instanceof ApiError && err.body?.message) || fallback;
  }

  const createEstate = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate<Estate>("POST", "/estates", data),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["estates"] });
      setShowEstateForm(false);
      estateFormHook.reset();
      toast({ title: t("estate.saved") });
      if (row?.id) setActiveEstate(row.id);
    },
    onError: (err) => toast({ title: errorMessage(err, "Error"), variant: "destructive" }),
  });

  const updateEstate = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiMutate("PATCH", `/estates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estates"] });
      qc.invalidateQueries({ queryKey: ["farm-profile"] });
      setShowEstateForm(false);
      setEditEstate(null);
      estateFormHook.reset();
      toast({ title: t("estate.saved") });
    },
    onError: (err) => toast({ title: errorMessage(err, "Error"), variant: "destructive" }),
  });

  const deleteEstate = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/estates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estates"] });
      toast({ title: t("estate.removed") });
    },
    onError: (err) => toast({ title: errorMessage(err, "Error"), variant: "destructive" }),
  });

  // ── Crop handlers ───────────────────────────────────────────────────────────
  function openAddCrop() {
    setEditCrop(null);
    setMultiNames([]);
    setCustomCrop("");
    reset({ season: "Annual", name: "", variety: "", acres: "", blockName: "", notes: "" });
    setShowCropForm(true);
  }

  function toggleMultiName(name: string) {
    setMultiNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function addCustomCrop() {
    const name = customCrop.trim();
    if (!name) return;
    setMultiNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setCustomCrop("");
  }

  function openEditCrop(crop: Crop) {
    setEditCrop(crop);
    reset({
      name: crop.name,
      variety: crop.variety ?? "",
      acres: crop.acres,
      season: crop.season,
      blockName: crop.blockName ?? "",
      notes: crop.notes ?? "",
    });
    setShowCropForm(true);
  }

  // Names that appear on more than one crop row in this estate — those rows get
  // a "duplicate" badge that jumps straight into the merge flow.
  const nameCounts = crops.reduce<Record<string, number>>((acc, c) => {
    const k = c.name.trim().toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const isDuplicate = (crop: Crop) => (nameCounts[crop.name.trim().toLowerCase()] ?? 0) > 1;

  async function onSubmitCrop(data: CropForm) {
    const base = {
      variety: data.variety || undefined,
      acres: parseFloat(data.acres),
      season: data.season,
      blockName: data.blockName || undefined,
      notes: data.notes || undefined,
    };
    if (editCrop) {
      updateCrop.mutate({ id: editCrop.id, data: { ...base, name: data.name } });
      return;
    }
    // Add mode: create one crop row per selected name, all in one go.
    if (multiNames.length === 0) return;
    try {
      for (const name of multiNames) {
        await apiMutate("POST", "/crops", { ...base, name });
      }
      qc.invalidateQueries({ queryKey: ["crops"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowCropForm(false);
      setMultiNames([]);
      reset();
      toast({ title: t("estate.saved") });
    } catch {
      qc.invalidateQueries({ queryKey: ["crops"] });
      toast({ title: "Error", variant: "destructive" });
    }
  }

  // ── Estate handlers ─────────────────────────────────────────────────────────
  function openAddEstate() {
    setEditEstate(null);
    estateFormHook.reset({ farmName: "", totalAcres: "", state: "", district: "" });
    setShowEstateForm(true);
  }

  function openEditEstate(estate: Estate) {
    setEditEstate(estate);
    estateFormHook.reset({
      farmName: estate.farmName,
      totalAcres: estate.totalAcres ?? "",
      state: estate.state ?? "",
      district: estate.district ?? "",
    });
    setShowEstateForm(true);
  }

  function onSubmitEstate(data: EstateForm) {
    const name = data.farmName.trim();
    const payload = {
      farmName: name.replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
      totalAcres: data.totalAcres ? parseFloat(data.totalAcres) : undefined,
      state: data.state || undefined,
      district: data.district || undefined,
    };
    if (editEstate) updateEstate.mutate({ id: editEstate.id, data: payload });
    else createEstate.mutate(payload);
  }

  function onDeleteEstate(id: number) {
    if (estates.length <= 1) {
      toast({ title: t("estate.cannotDeleteLast"), variant: "destructive" });
      return;
    }
    if (confirm(t("estate.deleteConfirm"))) deleteEstate.mutate(id);
  }

  const cropPending = createCrop.isPending || updateCrop.isPending;
  const estatePending = createEstate.isPending || updateEstate.isPending;

  return (
    <PageShell
      title={t("estate.title")}
      back="/"
      action={
        <button
          onClick={openAddEstate}
          className="flex items-center gap-1 bg-white text-primary rounded-full pl-2 pr-3 h-8 text-xs font-semibold"
        >
          <Plus className="h-4 w-4" /> {t("estate.addEstate")}
        </button>
      }
    >
      {/* Crop add/edit sheet */}
      {showCropForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">{editCrop ? "Edit Crop" : "Add Crop"}</h2>
              <button onClick={() => { setShowCropForm(false); setEditCrop(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmitCrop)} className="space-y-4">
              {editCrop ? (
                <div>
                  <Label>Crop *</Label>
                  <SelectOrType
                    options={CROP_NAMES}
                    value={watch("name") || ""}
                    onChange={(v) => setValue("name", v)}
                    placeholder="Select crop"
                    typePlaceholder="Type crop name…"
                  />
                  <input type="hidden" {...register("name", { required: true })} />
                  {errors.name && <p className="text-red-500 text-xs mt-1">Required</p>}
                </div>
              ) : (
                <div>
                  <Label>Crops * <span className="font-normal text-gray-400">(pick one or many)</span></Label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {[...CROP_NAMES.filter((n) => n !== "Other"), ...multiNames.filter((n) => !CROP_NAMES.includes(n))].map((name) => {
                      const active = multiNames.includes(name);
                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() => toggleMultiName(name)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-primary/5 text-primary border-primary/20"
                          }`}
                        >
                          {active ? "✓ " : "+ "}{name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={customCrop}
                      onChange={(e) => setCustomCrop(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCrop(); } }}
                      placeholder="Other crop — type name…"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={addCustomCrop} disabled={!customCrop.trim()}>
                      Add
                    </Button>
                  </div>
                  {multiNames.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1.5">Selected ({multiNames.length}): {multiNames.join(", ")}</p>
                  )}
                </div>
              )}
              <div>
                <Label>Variety</Label>
                <Input className="mt-1" placeholder="e.g. Robusta, Malabar" {...register("variety")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{editCrop ? "Area (acres) *" : "Area per crop (acres) *"}</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 2.5"
                    {...register("acres", { required: true, min: 0.01 })}
                  />
                  {errors.acres && <p className="text-red-500 text-xs mt-1">Required</p>}
                </div>
                <div>
                  <Label>Season</Label>
                  <SelectOrType
                    options={SEASONS}
                    value={watch("season") || ""}
                    onChange={(v) => setValue("season", v)}
                    typePlaceholder="Type season…"
                  />
                  <input type="hidden" {...register("season")} />
                </div>
              </div>
              <div>
                <Label>Block / Plot name</Label>
                <Input className="mt-1" placeholder="e.g. North Block, Plot A" {...register("blockName")} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input className="mt-1" placeholder="Optional notes" {...register("notes")} />
              </div>
              <Button type="submit" className="w-full" disabled={cropPending || (!editCrop && multiNames.length === 0)}>
                {cropPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                {editCrop ? "Save Changes" : multiNames.length > 1 ? `Add ${multiNames.length} Crops` : "Add Crop"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Merge crop sheet — bottom sheet on mobile, right-side panel on
          wide/web screens (lg+). */}
      {mergeCrop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-stretch lg:justify-end">
          <div className="bg-white w-full rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto lg:w-[440px] lg:max-w-[90vw] lg:rounded-none lg:rounded-l-2xl lg:max-h-none lg:h-full">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-lg">Merge "{mergeCrop.name}"</h2>
              <button onClick={() => setMergeCrop(null)}>
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              All harvests, sprays, expenses and plan tasks of "{mergeCrop.name}" will move to the
              crop you pick, and this duplicate entry will be removed. This cannot be undone.
            </p>
            <div className="space-y-2">
              {crops
                .filter((c) => c.id !== mergeCrop.id)
                // Same-name crops (the likely merge target) float to the top.
                .sort((a, b) => {
                  const target = mergeCrop.name.trim().toLowerCase();
                  const aMatch = a.name.trim().toLowerCase() === target ? 0 : 1;
                  const bMatch = b.name.trim().toLowerCase() === target ? 0 : 1;
                  return aMatch - bMatch;
                })
                .map((c) => (
                  <button
                    key={c.id}
                    disabled={mergeCropMutation.isPending}
                    onClick={() => {
                      if (confirm(`Merge "${mergeCrop.name}" into "${c.name}${c.variety ? ` (${c.variety})` : ""}"?`)) {
                        mergeCropMutation.mutate({ id: mergeCrop.id, intoId: c.id });
                      }
                    }}
                    className="w-full text-left bg-gray-50 rounded-xl p-3 flex items-center justify-between active:bg-primary/10 disabled:opacity-50"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.variety && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {c.variety}
                        </span>
                      )}
                      <div className="text-xs text-gray-500 mt-0.5">{c.acres} acres · {c.season}</div>
                    </div>
                    {mergeCropMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin text-primary" />
                    ) : (
                      <Merge size={16} className="text-primary" />
                    )}
                  </button>
                ))}
              {crops.length <= 1 && (
                <p className="text-sm text-gray-400 py-2">No other crop to merge into.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estate add/edit sheet — bottom sheet on mobile, right-side panel on
          wide/web screens (lg+). */}
      {showEstateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-stretch lg:justify-end">
          <div className="bg-white w-full rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto lg:w-[440px] lg:max-w-[90vw] lg:rounded-none lg:rounded-l-2xl lg:max-h-none lg:h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">
                {editEstate ? t("estate.editEstate") : t("estate.addEstate")}
              </h2>
              <button onClick={() => { setShowEstateForm(false); setEditEstate(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={estateFormHook.handleSubmit(onSubmitEstate)} className="space-y-4">
              <div>
                <Label>{t("estate.estateName")} *</Label>
                <Input
                  className="mt-1 capitalize"
                  autoCapitalize="words"
                  placeholder={t("estate.estateNamePlaceholder")}
                  {...estateFormHook.register("farmName", {
                    required: true,
                    onChange: (e) => {
                      const v = e.target.value;
                      const tv = v.replace(/(^|\s)\S/g, (c: string) => c.toUpperCase());
                      if (tv !== v) e.target.value = tv;
                    },
                  })}
                />
                {estateFormHook.formState.errors.farmName && (
                  <p className="text-red-500 text-xs mt-1">{t("onb.required")}</p>
                )}
              </div>
              <div>
                <Label>{t("estate.acres")}</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50"
                  {...estateFormHook.register("totalAcres")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("estate.state")}</Label>
                  <Input className="mt-1" {...estateFormHook.register("state")} />
                </div>
                <div>
                  <Label>{t("estate.district")}</Label>
                  <Input className="mt-1" {...estateFormHook.register("district")} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={estatePending}>
                {estatePending && <Loader2 size={16} className="mr-2 animate-spin" />}
                {editEstate ? t("estate.saveChanges") : t("estate.addEstate")}
              </Button>
            </form>
          </div>
        </div>
      )}

      <div className="p-4">
      <p className="text-sm text-gray-500 mb-3">{t("estate.subtitle")}</p>

      {/* Estate list */}
      <div className="space-y-3">
        {estates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Sprout size={48} className="text-gray-300" />
            <p className="text-gray-500">{t("estate.noEstates")}</p>
            <Button onClick={openAddEstate}>
              <span className="mr-1">+</span> {t("estate.addEstate")}
            </Button>
          </div>
        ) : (
          estates.map((estate) => {
            const isActive = estate.id === activeEstateId;
            return (
              <div
                key={estate.id}
                className={`bg-white rounded-2xl shadow-sm border ${
                  isActive ? "border-primary" : "border-gray-100"
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveEstate(estate.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveEstate(estate.id);
                    }
                  }}
                  className="w-full text-left p-4 flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate capitalize">{estate.farmName}</span>
                      {isActive && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Check size={11} /> {t("estate.active")}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-3">
                      {estate.totalAcres && <span>{estate.totalAcres} {t("onb.acres")}</span>}
                      {(estate.district || estate.state) && (
                        <span className="truncate">
                          {[estate.district, estate.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditEstate(estate); }}
                      className="p-1.5 text-gray-400 hover:text-primary"
                      aria-label={t("estate.editEstate")}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteEstate(estate.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (expandedId === estate.id) {
                          setExpandedId(null);
                        } else {
                          setExpandedId(estate.id);
                          setActiveEstate(estate.id);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary"
                      aria-label={expandedId === estate.id ? "Collapse" : "Expand"}
                    >
                      <ChevronDown
                        size={17}
                        className={`transition-transform ${expandedId === estate.id ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded estate: show its crops with add/edit/delete */}
                {isActive && expandedId === estate.id && (
                  <div className="border-t border-gray-100 p-4 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Leaf size={13} /> {t("estate.viewCrops")}
                      </span>
                      <button
                        onClick={openAddCrop}
                        className="text-sm font-medium text-primary flex items-center gap-1"
                      >
                        <span className="text-base leading-none">+</span> {t("estate.addCrop")}
                      </button>
                    </div>

                    {isLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 size={22} className="animate-spin text-primary" />
                      </div>
                    ) : crops.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No crops added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {crops.map((crop) => (
                          <div
                            key={crop.id}
                            className="bg-gray-50 rounded-xl p-3 flex items-start justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{crop.name}</span>
                                {isDuplicate(crop) && (
                                  <button
                                    onClick={() => setMergeCrop(crop)}
                                    className="text-xs bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"
                                    aria-label="Duplicate crop — tap to merge"
                                  >
                                    <Merge size={11} /> {t("estate.duplicateTapToMerge")}
                                  </button>
                                )}
                                {crop.variety && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    {crop.variety}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-3">
                                <span>{crop.acres} acres</span>
                                <span>{crop.season}</span>
                                {crop.blockName && <span>Block: {crop.blockName}</span>}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => openEditCrop(crop)}
                                className="p-1.5 text-gray-400 hover:text-primary"
                              >
                                <Pencil size={14} />
                              </button>
                              {crops.length > 1 && (
                                <button
                                  onClick={() => setMergeCrop(crop)}
                                  className="p-1.5 text-gray-400 hover:text-primary"
                                  aria-label="Merge crop"
                                >
                                  <Merge size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => deleteCrop.mutate(crop.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {estates.length > 0 && (
          <button
            onClick={openAddEstate}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary font-medium flex items-center justify-center gap-2 active:bg-primary/10"
          >
            <span className="text-lg leading-none">+</span> {t("estate.addEstate")}
          </button>
        )}
      </div>
      </div>
    </PageShell>
  );
}
