import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { MapPin, Loader2, CheckCircle2, Search, Volume2, Minus, Plus, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiMutate, apiFetch } from "@/lib/api";
import { useEstate } from "@/lib/use-estate";
import { useToast } from "@/hooks/use-toast";
import { useT, type Lang } from "@/lib/i18n";
import { speak, LANGUAGES, TOP_CROPS } from "@/lib/i18n-data";

const ALL_CROPS = [
  "Rice (Paddy)", "Wheat", "Maize", "Jowar (Sorghum)", "Bajra (Pearl Millet)",
  "Ragi (Finger Millet)", "Barley", "Oats",
  "Chana (Chickpea)", "Arhar (Pigeon Pea)", "Urad Dal", "Moong Dal",
  "Masoor Dal", "Rajma (Kidney Beans)", "Lobia (Cowpea)", "Horse Gram",
  "Tomato", "Potato", "Onion", "Brinjal", "Cauliflower", "Cabbage",
  "Capsicum", "Green Chilli", "Bitter Gourd (Karela)", "Bottle Gourd (Lauki)",
  "Ridge Gourd", "Pumpkin", "Cucumber", "Ladies Finger (Okra)", "Spinach",
  "Fenugreek (Methi)", "Coriander (Dhaniya)", "Peas", "Carrot", "Radish",
  "Beetroot", "Garlic", "Cluster Beans", "French Beans", "Sweet Potato",
  "Colocasia (Arbi)", "Drumstick (Moringa)", "Pointed Gourd (Parwal)",
  "Mango (Aam)", "Banana (Kela)", "Papaya", "Guava (Amrood)", "Pomegranate",
  "Coconut (Nariyal)", "Jackfruit (Kathal)", "Sapota (Chikoo)",
  "Custard Apple (Sitaphal)", "Watermelon", "Muskmelon", "Grapes",
  "Strawberry", "Pineapple", "Lemon", "Orange", "Mosambi (Sweet Lime)",
  "Amla (Gooseberry)", "Litchi", "Jamun", "Fig (Anjeer)", "Avocado",
  "Dragon Fruit", "Mulberry",
  "Ginger (Adrak)", "Turmeric (Haldi)", "Cardamom (Elaichi)", "Pepper (Black Pepper)",
  "Chilli (Dry)", "Cumin (Jeera)", "Fennel (Saunf)", "Mustard (Sarson)",
  "Coriander Seed", "Fenugreek Seed", "Ajwain", "Mint (Pudina)",
  "Curry Leaf", "Lemongrass", "Ashwagandha",
  "Coffee", "Arecanut (Supari)", "Sugarcane", "Cotton", "Jute",
  "Sunflower", "Groundnut (Moongphali)", "Sesame (Til)", "Soybean",
  "Castor (Arandi)", "Tobacco", "Rubber", "Tea", "Oil Palm",
  "Cashew (Kaju)", "Cocoa",
];

interface ProfileForm {
  farmName: string;
  village: string;
  district: string;
  state: string;
}

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const { t, lang, setLang } = useT();
  const [step, setStep] = useState(1);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [acres, setAcres] = useState(2);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [cropSearch, setCropSearch] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { setActiveEstate } = useEstate();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreCode, setRestoreCode] = useState("");
  const [restoring, setRestoring] = useState(false);

  const { register, handleSubmit, watch, trigger, formState: { errors } } = useForm<ProfileForm>({
    defaultValues: { state: "Karnataka" },
  });

  const farmNameVal = watch("farmName");

  const createProfile = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/farm/profile", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm-profile"] }),
  });

  const createCrop = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/crops", data),
  });

  function detectGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        toast({ title: t("onb.orManual") });
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  }

  function toggleCrop(name: string) {
    setSelectedCrops((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  async function onFinish(formData: ProfileForm) {
    const profile = {
      farmName: formData.farmName.trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
      latitude: coords?.lat ?? 12.9716,
      longitude: coords?.lon ?? 77.5946,
      village: formData.village,
      district: formData.district,
      state: formData.state || "Karnataka",
      totalAcres: acres,
    };

    try {
      await createProfile.mutateAsync(profile);
      const perCrop = selectedCrops.length > 0 ? acres / selectedCrops.length : 0;
      for (const name of selectedCrops) {
        await createCrop.mutateAsync({
          name,
          acres: Math.round(perCrop * 10) / 10 || 1,
          season: "Annual",
        });
      }
      toast({ title: t("onb.welcome"), description: t("onb.welcomeSub") });
      navigate("/");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function handleRestore() {
    if (!restoreCode.trim()) return;
    setRestoring(true);
    try {
      const res = await apiFetch<{ estateId: number; farmName: string }>("/backup/restore", {
        method: "POST",
        body: JSON.stringify({ code: restoreCode.trim() }),
      });
      // Ensure the restored farm is in the estate list, then make it active via the
      // provider (updates state + invalidates estate-scoped queries), not just localStorage.
      await qc.invalidateQueries({ queryKey: ["estates"] });
      setActiveEstate(res.estateId);
      toast({ title: `Restored: ${res.farmName}`, description: "Your farm data is loading back in." });
      navigate("/");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      const friendly = /404/.test(msg)
        ? "No farm found for that code. Please check and try again."
        : /400/.test(msg)
        ? "That code doesn't look right. It should be like FARM-XXXX-XXXX."
        : "Couldn't restore — check your internet and try again.";
      toast({ title: friendly, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  }

  const cropLabel = (name: string) => {
    const top = TOP_CROPS.find((c) => c.name === name);
    return top ? `${top.emoji} ${top.label[lang] ?? top.label.en}` : name;
  };

  const filteredAll = ALL_CROPS.filter(
    (name) => !cropSearch || name.toLowerCase().includes(cropSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-6 pt-10 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("app.name")}</h1>
        <p className="text-primary-foreground/60 text-sm mt-1">{t("onb.stepOf", { n: step, total: TOTAL_STEPS })}</p>
        <div className="flex gap-1.5 mt-4">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full flex-1 transition-all ${s <= step ? "bg-white" : "bg-primary-foreground/20"}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 pb-10">
        {/* ── STEP 1: LANGUAGE + FARM NAME ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{t("onb.chooseLanguage")}</h2>
              <p className="text-sm text-gray-500 mt-1">{t("onb.chooseLanguageSub")}</p>
            </div>

            {/* Dropdown so any regional language fits without a wall of buttons */}
            <div className="relative">
              <select
                value={lang}
                aria-label={t("onb.chooseLanguage")}
                onChange={(e) => {
                  const code = e.target.value as Lang;
                  setLang(code);
                  const l = LANGUAGES.find((x) => x.code === code);
                  if (l) speak(l.native, code);
                }}
                className="w-full appearance-none rounded-2xl border-2 border-primary bg-white py-4 pl-5 pr-12 text-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native} — {l.english}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold text-gray-700">{t("onb.farmName")}</Label>
                <button
                  type="button"
                  onClick={() => speak(t("onb.farmName"), lang)}
                  aria-label={t("home.listen")}
                  className="text-primary"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">{t("onb.farmNameSub")}</p>
              <Input
                {...register("farmName", {
                  required: true,
                  onChange: (e) => {
                    const v = e.target.value;
                    const tv = v.replace(/(^|\s)\S/g, (c: string) => c.toUpperCase());
                    if (tv !== v) e.target.value = tv;
                  },
                })}
                autoCapitalize="words"
                placeholder={t("onb.farmNamePlaceholder")}
                className="text-lg h-12"
              />
              {errors.farmName && <p className="text-red-500 text-xs mt-1">{t("onb.required")}</p>}
            </div>

            <Button
              onClick={() => farmNameVal?.trim() && setStep(2)}
              disabled={!farmNameVal?.trim()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-14 text-lg"
            >
              {t("onb.next")} →
            </Button>

            {/* Returning farmer on a new phone: skip setup and restore by code. */}
            <div className="pt-2 text-center">
              {!restoreOpen ? (
                <button
                  type="button"
                  onClick={() => setRestoreOpen(true)}
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Already have a farm? Restore with a backup code
                </button>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 text-left space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">Enter your backup code</Label>
                  <Input
                    value={restoreCode}
                    onChange={(e) => setRestoreCode(e.target.value)}
                    placeholder="FARM-XXXX-XXXX"
                    autoCapitalize="characters"
                    className="rounded-xl h-12 font-mono tracking-wider"
                  />
                  <Button
                    onClick={handleRestore}
                    disabled={restoring || !restoreCode.trim()}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
                  >
                    {restoring ? <Loader2 className="w-5 h-5 animate-spin" /> : "Restore my farm"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: LOCATION ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{t("onb.whereFarm")}</h2>
                <p className="text-sm text-gray-500 mt-1">{t("onb.whereFarmSub")}</p>
              </div>
              <button
                type="button"
                onClick={() => speak(`${t("onb.whereFarm")}. ${t("onb.whereFarmSub")}`, lang)}
                aria-label={t("home.listen")}
                className="text-primary ml-auto"
              >
                <Volume2 className="h-6 w-6" />
              </button>
            </div>

            <button
              onClick={detectGPS}
              disabled={gpsLoading}
              className={`w-full rounded-2xl py-4 flex items-center justify-center gap-2 text-lg font-medium transition-colors ${
                coords
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {gpsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : coords ? <CheckCircle2 className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
              {gpsLoading ? t("onb.detecting") : coords ? t("onb.gpsSaved") : t("onb.useGPS")}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{t("onb.orManual")}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
              <div>
                <Label className="text-sm text-gray-600">{t("onb.district")}</Label>
                <Input {...register("district")} className="mt-1 h-12 text-base" />
              </div>
              <div>
                <Label className="text-sm text-gray-600">{t("onb.state")}</Label>
                <Input {...register("state")} className="mt-1 h-12 text-base" />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl h-14 text-base">← {t("onb.back")}</Button>
              <Button onClick={() => setStep(3)} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-14 text-base">{t("onb.next")} →</Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: ACREAGE ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{t("onb.farmSize")}</h2>
                <p className="text-sm text-gray-500 mt-1">{t("onb.farmSizeSub")}</p>
              </div>
              <button
                type="button"
                onClick={() => speak(t("onb.farmSize"), lang)}
                aria-label={t("home.listen")}
                className="text-primary ml-auto"
              >
                <Volume2 className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setAcres((a) => Math.max(0.5, Math.round((a - 0.5) * 10) / 10))}
                  className="rounded-full bg-primary/10 text-primary h-12 w-12 flex items-center justify-center active:scale-95 shrink-0"
                  aria-label="-"
                >
                  <Minus className="h-6 w-6" />
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    step={0.5}
                    value={acres || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setAcres(isNaN(v) ? 0 : v);
                    }}
                    placeholder="0"
                    className="w-full text-center text-4xl font-bold text-primary outline-none border-b-2 border-primary/20 focus:border-primary pb-1 bg-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">{t("onb.acres")}</p>
                </div>
                <button
                  onClick={() => setAcres((a) => Math.round((a + 0.5) * 10) / 10)}
                  className="rounded-full bg-primary/10 text-primary h-12 w-12 flex items-center justify-center active:scale-95 shrink-0"
                  aria-label="+"
                >
                  <Plus className="h-6 w-6" />
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">{t("onb.acresHint")}</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 rounded-xl h-14 text-base">← {t("onb.back")}</Button>
              <Button onClick={() => setStep(4)} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-14 text-base">{t("onb.next")} →</Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: CROPS ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{t("onb.crops")}</h2>
                <p className="text-sm text-gray-500 mt-1">{t("onb.cropsSub")}</p>
              </div>
              <button
                type="button"
                onClick={() => speak(t("onb.crops"), lang)}
                aria-label={t("home.listen")}
                className="text-primary ml-auto"
              >
                <Volume2 className="h-6 w-6" />
              </button>
            </div>

            {!showAll ? (
              <>
                <p className="text-sm font-semibold text-gray-600">{t("onb.commonCrops")}</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {TOP_CROPS.map((c) => {
                    const active = selectedCrops.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        onClick={() => toggleCrop(c.name)}
                        className={`rounded-2xl py-3 px-1 flex flex-col items-center gap-1 border-2 transition-colors ${
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        <span className="text-2xl">{c.emoji}</span>
                        <span className="text-xs font-medium text-center leading-tight">{c.label[lang] ?? c.label.en}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowAll(true)}
                  className="flex items-center gap-2 text-primary text-sm font-semibold mx-auto"
                >
                  <Search className="h-4 w-4" /> {t("onb.seeAll")}
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={t("onb.searchCrop")}
                    value={cropSearch}
                    onChange={(e) => setCropSearch(e.target.value)}
                    className="pl-9 h-11"
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                  {filteredAll.map((name) => {
                    const active = selectedCrops.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleCrop(name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-primary/5 text-primary border-primary/20"
                        }`}
                      >
                        {active ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setShowAll(false); setCropSearch(""); }}
                  className="text-primary text-sm font-semibold mx-auto block"
                >
                  ← {t("onb.commonCrops")}
                </button>
              </>
            )}

            {selectedCrops.length > 0 && (
              <div className="bg-white rounded-2xl p-3 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{t("onb.selected")} ({selectedCrops.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCrops.map((name) => (
                    <span key={name} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                      {cropLabel(name)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1 rounded-xl h-14 text-base">← {t("onb.back")}</Button>
              <Button
                onClick={handleSubmit(onFinish)}
                disabled={createProfile.isPending || createCrop.isPending}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-14 text-base"
              >
                {createProfile.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("onb.saving")}</>
                ) : `${t("onb.finish")} ✓`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
