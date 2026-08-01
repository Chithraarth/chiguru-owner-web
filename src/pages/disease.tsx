import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  Camera, Upload, Loader2, AlertTriangle, CheckCircle2,
  ChevronRight, Sprout, Clock, X, FlaskConical, Search, ChevronDown, Stethoscope
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, apiUrl } from "@/lib/api";
import { compressForAI, fileToDataUrl } from "@/lib/photo";
import { useToast } from "@/hooks/use-toast";
import { AiDisclaimer } from "@/components/ai-disclaimer";

interface DiagnosisResult {
  id?: number | null;
  diseaseName: string;
  scientificName?: string;
  affectedCrop: string;
  confidence: "high" | "medium" | "low";
  description: string;
  visibleSymptoms?: string;
  differentials?: { name: string; note?: string }[];
  immediateSteps?: string[];
  doNotDo?: string[];
  treatmentSteps: string[];
  preventionTips: string[];
  urgency: "immediate" | "within-3-days" | "within-week" | "monitor";
  recommendedProduct?: string;
  isDisease: boolean;
}

const URGENCY_CONFIG = {
  "immediate": { label: "Treat Immediately", color: "bg-red-100 text-red-700 border-red-200" },
  "within-3-days": { label: "Treat Within 3 Days", color: "bg-orange-100 text-orange-700 border-orange-200" },
  "within-week": { label: "Treat This Week", color: "bg-amber-100 text-amber-700 border-amber-200" },
  "monitor": { label: "Monitor Closely", color: "bg-blue-100 text-blue-700 border-blue-200" },
};

const CONFIDENCE_CONFIG = {
  "high": { label: "High Confidence", color: "bg-emerald-100 text-emerald-700" },
  "medium": { label: "Medium Confidence", color: "bg-yellow-100 text-yellow-700" },
  "low": { label: "Low Confidence", color: "bg-gray-100 text-gray-600" },
};

interface CropCategory {
  label: string;
  emoji: string;
  crops: string[];
}

const CROP_CATEGORIES: CropCategory[] = [
  {
    label: "Estate Crops (Most Common)",
    emoji: "⭐",
    crops: [
      "Coffee", "Pepper (Black Pepper / Kali Mirch)", "Cardamom (Elaichi)",
      "Arecanut (Supari)", "Sugarcane (Ganna)", "Banana (Kela)",
      "Pineapple (Ananas)", "Jackfruit (Kathal)", "Mango (Aam)", "Coconut (Nariyal)",
    ],
  },
  {
    label: "Vegetables",
    emoji: "🥦",
    crops: [
      "Tomato", "Potato", "Onion", "Brinjal (Eggplant)", "Cauliflower", "Cabbage",
      "Capsicum (Bell Pepper)", "Green Chilli", "Bitter Gourd (Karela)", "Bottle Gourd (Lauki)",
      "Ridge Gourd (Turai)", "Snake Gourd", "Pumpkin", "Cucumber", "Ladies Finger (Okra)",
      "Spinach (Palak)", "Fenugreek (Methi)", "Coriander (Dhaniya)", "Peas (Matar)",
      "Carrot (Gajar)", "Radish (Mooli)", "Beetroot", "Garlic (Lahsun)", "Ginger (Adrak)",
      "Drumstick (Moringa)", "Cluster Beans (Gawar)", "French Beans", "Colocasia (Arbi)",
      "Sweet Potato", "Yam (Suran)", "Ash Gourd", "Pointed Gourd (Parwal)",
    ],
  },
  {
    label: "Fruits",
    emoji: "🍎",
    crops: [
      "Mango (Aam)", "Banana (Kela)", "Papaya (Papita)", "Guava (Amrood)", "Pomegranate (Anar)",
      "Coconut (Nariyal)", "Jackfruit (Kathal)", "Sapota (Chikoo)", "Custard Apple (Sitaphal)",
      "Watermelon (Tarbuz)", "Muskmelon (Kharbooja)", "Grapes (Angoor)", "Strawberry",
      "Pineapple (Ananas)", "Lemon (Nimbu)", "Orange (Santra)", "Mosambi (Sweet Lime)",
      "Amla (Gooseberry)", "Litchi", "Jamun", "Tamarind (Imli)", "Fig (Anjeer)",
      "Avocado", "Dragon Fruit", "Passion Fruit", "Mulberry (Shahtoot)", "Bael",
    ],
  },
  {
    label: "Cereals & Grains",
    emoji: "🌾",
    crops: [
      "Rice (Paddy / Dhan)", "Wheat (Gehun)", "Maize (Makka)", "Sorghum (Jowar)",
      "Pearl Millet (Bajra)", "Finger Millet (Ragi / Nachni)", "Barley (Jau)",
      "Oats (Jai)", "Foxtail Millet (Kangni)", "Kodo Millet", "Little Millet (Kutki)",
    ],
  },
  {
    label: "Pulses",
    emoji: "🫘",
    crops: [
      "Chickpea (Chana / Bengal Gram)", "Pigeon Pea (Arhar / Tur Dal)", "Black Gram (Urad Dal)",
      "Green Gram (Moong Dal)", "Lentil (Masoor Dal)", "Kidney Beans (Rajma)",
      "Cowpea (Lobia)", "Field Bean (Vaal)", "Horse Gram (Kulith)", "Moth Bean (Matki)",
    ],
  },
  {
    label: "Spices & Herbs",
    emoji: "🌿",
    crops: [
      "Turmeric (Haldi)", "Ginger (Adrak)", "Chilli (Dry / Lal Mirch)", "Cardamom (Elaichi)",
      "Pepper (Black Pepper / Kali Mirch)", "Cumin (Jeera)", "Fennel (Saunf)",
      "Coriander Seed (Dhaniya)", "Fenugreek Seed (Methi)", "Mustard (Sarson)",
      "Ajwain (Carom Seeds)", "Bay Leaf (Tejpatta)", "Curry Leaf", "Mint (Pudina)",
      "Tulsi (Basil)", "Lemongrass", "Ashwagandha", "Shatavari",
    ],
  },
  {
    label: "Commercial Crops",
    emoji: "🌱",
    crops: [
      "Coffee", "Arecanut (Supari)", "Sugarcane (Ganna)", "Cotton (Kapas)",
      "Jute (Pat)", "Sunflower (Surajmukhi)", "Groundnut (Moongphali)",
      "Sesame (Til)", "Soybean", "Castor (Arandi)", "Linseed (Alsi)",
      "Niger Seed (Ramtil)", "Safflower (Kusumba)", "Tobacco (Tambaakhu)",
    ],
  },
  {
    label: "Plantation Crops",
    emoji: "🌴",
    crops: [
      "Rubber (Kaucho)", "Tea (Chai)", "Oil Palm",
      "Cashew (Kaju)", "Cocoa (Chocolate)", "Areca Palm",
    ],
  },
  {
    label: "Flowers & Horticulture",
    emoji: "🌸",
    crops: [
      "Rose (Gulab)", "Marigold (Genda)", "Jasmine (Chameli)", "Chrysanthemum",
      "Tuberose (Rajnigandha)", "Lotus", "Gladiolus", "Carnation", "Orchid",
      "Aloe Vera",
    ],
  },
];

const ALL_CROPS = CROP_CATEGORIES.flatMap((cat) => cat.crops);

export default function DiseasePage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingSpray, setCreatingSpray] = useState(false);
  const [showCropPicker, setShowCropPicker] = useState(false);
  const [cropSearch, setCropSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  async function handleFile(file: File) {
    try {
      const raw = await fileToDataUrl(file);
      const compressed = await compressForAI(raw);
      setImagePreview(compressed);
      setImageBase64(compressed);
      setResult(null);
    } catch {
      toast({ title: "Could not read that photo", variant: "destructive" });
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    setLoading(true);
    setResult(null);
    setOutcome(null);
    try {
      const data = await apiFetch<DiagnosisResult>("/ai/disease", {
        method: "POST",
        body: JSON.stringify({ imageBase64, cropType: selectedCrop || undefined }),
      });
      setResult(data);
    } catch {
      toast({ title: "Analysis failed", description: "Please try again with a clearer photo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createSprayTask() {
    if (!result) return;
    setCreatingSpray(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await apiFetch("/sprays", {
        method: "POST",
        body: JSON.stringify({
          date: today,
          productName: result.recommendedProduct || result.diseaseName + " treatment",
          productType: "Pesticide / Fungicide",
          litresUsed: 10,
          areaAcres: 1,
          cost: 0,
          notes: `Auto-created from disease diagnosis: ${result.diseaseName}. ${result.treatmentSteps[0] ?? ""}`,
        }),
      });
      toast({ title: "Spray record created!", description: "You can edit it in the Sprays section." });
      navigate("/sprays");
    } catch {
      toast({ title: "Failed to create spray record", variant: "destructive" });
    } finally {
      setCreatingSpray(false);
    }
  }

  async function submitOutcome(value: string) {
    if (!result?.id || savingOutcome) return;
    setSavingOutcome(true);
    const previous = outcome;
    setOutcome(value);
    try {
      await apiFetch(`/ai/disease/${result.id}/outcome`, {
        method: "PATCH",
        body: JSON.stringify({ outcome: value }),
      });
      toast({ title: "Thank you!", description: "Your feedback helps improve diagnosis for all farmers." });
    } catch {
      setOutcome(previous);
      toast({ title: "Could not save feedback", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingOutcome(false);
    }
  }

  const urgency = result ? URGENCY_CONFIG[result.urgency] ?? URGENCY_CONFIG["monitor"] : null;
  const confidence = result ? CONFIDENCE_CONFIG[result.confidence] ?? CONFIDENCE_CONFIG["medium"] : null;
  // "Could not read the photo" is NOT the same as "healthy" — keep them visually distinct
  // so a farmer never reads an unreadable photo as a clean bill of health.
  const cannotDiagnose = !!result && !result.isDisease && (result.confidence === "low" || /unable to identify/i.test(result.diseaseName));
  const isHealthy = !!result && !result.isDisease && !cannotDiagnose;

  const filteredCrops = (() => {
    const q = cropSearch.toLowerCase();
    let list = activeCategory === "All"
      ? ALL_CROPS
      : (CROP_CATEGORIES.find((c) => c.label === activeCategory)?.crops ?? []);
    if (q) list = list.filter((c) => c.toLowerCase().includes(q));
    return list;
  })();

  return (
    <PageShell title="Disease Detection" back="/">
      <div className="p-4 space-y-4 pb-10">

        {/* Intro */}
        {!result && !loading && (
          <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2.5">
                <FlaskConical className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold">Plant Disease Detector</p>
                <p className="text-primary-foreground/80 text-xs mt-0.5">Select your crop · take a photo · get instant AI diagnosis + treatment advice</p>
              </div>
            </div>
          </div>
        )}

        {/* Image picker + crop selector */}
        {!result && (
          <div className="space-y-3">

            {/* Crop selector — full picker */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Which crop? (select for better accuracy)</p>
              <button
                onClick={() => setShowCropPicker(true)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                  selectedCrop
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                <span className="text-sm font-medium">
                  {selectedCrop || "Tap to select crop (sabzi, phal, anaaj…)"}
                </span>
                <div className="flex items-center gap-1">
                  {selectedCrop && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedCrop(""); }}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            </div>

            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={imagePreview} alt="Plant photo" className="w-full object-cover max-h-64" />
                <button
                  onClick={() => { setImagePreview(null); setImageBase64(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5"
                >
                  <X className="h-4 w-4" />
                </button>
                {selectedCrop && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    🌱 {selectedCrop}
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-primary/30 rounded-2xl p-8 flex flex-col items-center gap-3 bg-primary/5 cursor-pointer active:bg-primary/10 transition-colors"
              >
                <div className="bg-primary rounded-full p-3">
                  <Camera className="h-7 w-7 text-primary-foreground" />
                </div>
                <p className="font-semibold text-gray-700">Take or upload a photo</p>
                <p className="text-xs text-gray-500 text-center">Photo of affected leaf, fruit, stem, or whole plant. Closer = better diagnosis.</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 flex items-center gap-1">
                    <Camera className="h-3 w-3" /> Camera
                  </span>
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600 flex items-center gap-1">
                    <Upload className="h-3 w-3" /> Gallery
                  </span>
                </div>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {imagePreview && (
              <Button
                onClick={analyze}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-semibold"
              >
                <FlaskConical className="h-5 w-5 mr-2" />
                Analyze{selectedCrop ? ` ${selectedCrop}` : " Plant"} Disease
              </Button>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Sprout className="absolute inset-0 m-auto h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">Examining your plant…</p>
              {selectedCrop && <p className="text-xs text-primary mt-0.5 font-medium">Analyzing {selectedCrop}</p>}
              <p className="text-sm text-gray-400 mt-1">AI is checking for diseases, pests & deficiencies</p>
            </div>
            {imagePreview && (
              <img src={imagePreview} alt="" className="w-24 h-24 object-cover rounded-xl opacity-50 border border-gray-200" />
            )}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Photo thumbnail */}
            {imagePreview && (
              <div className="flex items-center gap-3">
                <img src={imagePreview} alt="Analyzed" className="w-16 h-16 object-cover rounded-xl border border-gray-200" />
                <div>
                  <p className="text-xs text-gray-400">Analyzed photo</p>
                  {selectedCrop && <p className="text-xs text-primary font-medium">🌱 {selectedCrop}</p>}
                  <button
                    onClick={() => { setResult(null); setImagePreview(null); setImageBase64(null); }}
                    className="text-xs text-primary font-medium mt-0.5"
                  >
                    ← Analyze another photo
                  </button>
                </div>
              </div>
            )}

            {/* Main result card */}
            <div className={`rounded-2xl border-2 p-4 space-y-3 ${
              isHealthy
                ? "bg-emerald-50 border-emerald-200"
                : cannotDiagnose
                ? "bg-orange-50 border-orange-200"
                : result.urgency === "immediate"
                ? "bg-red-50 border-red-200"
                : "bg-white border-gray-200 shadow-sm"
            }`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isHealthy ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      )}
                      <h2 className="font-bold text-gray-800 text-base leading-tight">{result.diseaseName}</h2>
                    </div>
                    {result.scientificName && (
                      <p className="text-xs italic text-gray-400 ml-7">{result.scientificName}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {confidence && (
                    <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${confidence.color}`}>
                      {confidence.label}
                    </span>
                  )}
                  {result.affectedCrop && (
                    <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-blue-50 text-blue-700">
                      🌱 {result.affectedCrop}
                    </span>
                  )}
                  {urgency && result.isDisease && (
                    <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${urgency.color} flex items-center gap-1`}>
                      <Clock className="h-3 w-3" />{urgency.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 leading-relaxed">{result.description}</p>

              {/* What the AI saw — the evidence behind the diagnosis */}
              {result.visibleSymptoms && !isHealthy && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-600">Photo mein dikha (Seen in photo):</span> {result.visibleSymptoms}
                </p>
              )}

              {/* Verify-first warning when the AI is not fully sure */}
              {!isHealthy && result.confidence !== "high" && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-800 leading-relaxed">
                    {cannotDiagnose ? (
                      <>
                        <span className="font-semibold">Photo saaf nahi hai (Photo not clear).</span> Please
                        take a sharp close-up of the affected leaf, stem or fruit in good light and try again,
                        or show it to your nearest KVK. Do not buy any chemical based on this.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">Pakka nahi hai (Not fully sure).</span> This may also be
                        something else. Please confirm with a KVK or an experienced farmer, and take a clearer
                        close-up photo in good light, before buying chemicals.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Differential diagnoses — other realistic causes */}
              {!isHealthy && result.differentials && result.differentials.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-600">Yeh bhi ho sakta hai (Could also be):</p>
                  <ul className="space-y-1">
                    {result.differentials.map((d, i) => (
                      <li key={i} className="text-xs text-gray-600 leading-relaxed">
                        <span className="font-medium text-gray-700">• {d.name}</span>
                        {d.note ? <span> — {d.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended product */}
              {result.recommendedProduct && result.isDisease && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <FlaskConical className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Agri shop mein milega (Available at agri shop):</p>
                    <p className="text-sm text-amber-900 font-medium mt-0.5">{result.recommendedProduct}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Immediate steps — free, do-now actions before buying anything */}
            {result.immediateSteps && result.immediateSteps.length > 0 && !isHealthy && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <span className="text-lg">👀</span> Pehle Yeh Karein (Do this first — free)
                </h3>
                <ul className="space-y-1.5">
                  {result.immediateSteps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-primary flex-shrink-0">✓</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What NOT to do */}
            {result.doNotDo && result.doNotDo.length > 0 && !isHealthy && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-4 space-y-2">
                <h3 className="font-semibold text-red-800 text-sm flex items-center gap-2">
                  <span className="text-lg">🚫</span> Yeh Mat Karein (Do NOT do this)
                </h3>
                <ul className="space-y-1.5">
                  {result.doNotDo.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-red-800">
                      <span className="text-red-400 flex-shrink-0">✕</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Treatment steps */}
            {result.treatmentSteps?.length > 0 && result.isDisease && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-lg">💊</span> Treatment Steps (Ilaj ke Kadam)
                </h3>
                <ol className="space-y-2">
                  {result.treatmentSteps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Prevention tips */}
            {result.preventionTips?.length > 0 && (
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 space-y-2">
                <h3 className="font-semibold text-blue-800 text-sm flex items-center gap-2">
                  <span>🛡️</span> Prevention Tips (Bachav ke Upay)
                </h3>
                <ul className="space-y-1.5">
                  {result.preventionTips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-blue-800">
                      <span className="text-blue-400 flex-shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* KVK tip */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                💡 <span className="font-medium text-gray-700">Expert tip:</span> For confirmation, take a sample to your nearest <span className="font-medium text-primary">KVK (Krishi Vigyan Kendra)</span> or contact the state agriculture department helpline.
              </p>
            </div>

            <AiDisclaimer />

            {/* Create spray task */}
            {result.isDisease && (
              <Button
                onClick={createSprayTask}
                disabled={creatingSpray}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 font-semibold"
              >
                {creatingSpray ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Create Spray Record from This Diagnosis
              </Button>
            )}

            <button
              onClick={() => navigate("/agri-doctor")}
              className="w-full bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-center gap-2.5 active:scale-[0.99] transition-transform"
            >
              <div className="bg-accent/10 rounded-lg p-2"><Stethoscope className="h-5 w-5 text-accent" /></div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-accent">Want a second opinion?</p>
                <p className="text-xs text-accent">Consult an agriculture doctor to confirm & improve yield</p>
              </div>
              <ChevronRight className="h-4 w-4 text-accent" />
            </button>

            {/* Outcome feedback — logged to improve diagnosis quality over time */}
            {result.id != null && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-2.5">
                <p className="text-xs font-medium text-gray-600 text-center">
                  Kya yeh sahi tha? (Was this diagnosis helpful?)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => submitOutcome("helpful")}
                    disabled={savingOutcome}
                    className={`rounded-xl border py-2 px-1 text-xs font-medium transition-colors ${
                      outcome === "helpful"
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-white border-gray-200 text-gray-700 active:bg-gray-50"
                    }`}
                  >
                    👍 Helpful
                  </button>
                  <button
                    onClick={() => submitOutcome("not-helpful")}
                    disabled={savingOutcome}
                    className={`rounded-xl border py-2 px-1 text-xs font-medium transition-colors ${
                      outcome === "not-helpful"
                        ? "bg-red-600 border-red-600 text-white"
                        : "bg-white border-gray-200 text-gray-700 active:bg-gray-50"
                    }`}
                  >
                    👎 Not helpful
                  </button>
                  <button
                    onClick={() => submitOutcome("agronomist-confirmed")}
                    disabled={savingOutcome}
                    className={`rounded-xl border py-2 px-1 text-xs font-medium transition-colors ${
                      outcome === "agronomist-confirmed"
                        ? "bg-accent border-accent text-white"
                        : "bg-white border-gray-200 text-gray-700 active:bg-gray-50"
                    }`}
                  >
                    ✅ Agronomist confirmed
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => { setResult(null); setImagePreview(null); setImageBase64(null); setSelectedCrop(""); setOutcome(null); }}
              className="w-full text-sm text-gray-500 py-2 text-center"
            >
              Analyze another plant →
            </button>
          </div>
        )}
      </div>

      {/* Crop picker bottom sheet */}
      {showCropPicker && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={() => setShowCropPicker(false)}>
          <div
            className="bg-white rounded-t-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-bold text-gray-800">Select Crop (Fasal Chunein)</h2>
              <button onClick={() => setShowCropPicker(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search crop… (e.g. Tomato, Aam, Gehun)"
                  value={cropSearch}
                  onChange={(e) => { setCropSearch(e.target.value); setActiveCategory("All"); }}
                  className="pl-9 h-9 text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* Category tabs */}
            {!cropSearch && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {["All", ...CROP_CATEGORIES.map((c) => c.label)].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {cat === "All" ? "🌿 All" : `${CROP_CATEGORIES.find((c) => c.label === cat)?.emoji} ${cat}`}
                  </button>
                ))}
              </div>
            )}

            {/* Crop list */}
            <div className="overflow-y-auto flex-1 px-4 pb-6">
              {cropSearch && (
                <p className="text-xs text-gray-400 mb-2">{filteredCrops.length} crop{filteredCrops.length !== 1 ? "s" : ""} found</p>
              )}
              {!cropSearch && activeCategory === "All" ? (
                CROP_CATEGORIES.map((cat) => (
                  <div key={cat.label} className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {cat.emoji} {cat.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cat.crops.map((crop) => (
                        <button
                          key={crop}
                          onClick={() => { setSelectedCrop(crop); setShowCropPicker(false); setCropSearch(""); setActiveCategory("All"); }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selectedCrop === crop
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white text-gray-700 border-gray-200 hover:border-primary"
                          }`}
                        >
                          {crop}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {filteredCrops.map((crop) => (
                    <button
                      key={crop}
                      onClick={() => { setSelectedCrop(crop); setShowCropPicker(false); setCropSearch(""); setActiveCategory("All"); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedCrop === crop
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-primary"
                      }`}
                    >
                      {crop}
                    </button>
                  ))}
                  {filteredCrops.length === 0 && (
                    <p className="text-sm text-gray-400 py-4 w-full text-center">No crops found. Type your crop name in the analyze field anyway — AI will still detect it.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
