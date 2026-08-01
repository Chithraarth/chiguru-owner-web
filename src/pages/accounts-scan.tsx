import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  Camera, ImageIcon, RefreshCw, CheckCircle2, Sun,
  AlertCircle, Loader2, Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiMutate } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

type Phase = "capture" | "preview" | "analyzing" | "results";

interface ScannedEntry {
  type: "expense" | "income";
  category: string;
  description: string;
  originalText?: string;
  amount: number;
  date?: string;
  unit?: string;
  confidence: "high" | "medium" | "low";
  question?: string;
}

interface IndexedEntry extends ScannedEntry {
  _idx: number;
}

interface ScanResult {
  year?: string;
  pageDescription?: string;
  entries: ScannedEntry[];
  totalExpense?: number;
  totalIncome?: number;
  notes?: string;
  error?: string;
}

const CAT_COLOR: Record<string, string> = {
  Labour: "text-blue-700 bg-blue-50",
  Fertilizer: "text-primary bg-primary/5",
  Pesticide: "text-red-700 bg-red-50",
  Seed: "text-yellow-700 bg-yellow-50",
  Harvest: "text-primary bg-primary/5",
  Equipment: "text-purple-700 bg-purple-50",
  Other: "text-gray-700 bg-gray-100",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AccountsScan() {
  const { t } = useT();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [showPicker, setShowPicker] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [confirmedSet, setConfirmedSet] = useState<Set<number>>(new Set());
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({});
  const [draftDescs, setDraftDescs] = useState<Record<number, string>>({});

  function hasDoubt(entry: ScannedEntry) {
    return Boolean(entry.question) || entry.confidence === "low";
  }

  function needsCheck(entry: ScannedEntry, idx: number) {
    return hasDoubt(entry) && !confirmedSet.has(idx);
  }

  function confirmEntry(idx: number) {
    const entry = result?.entries[idx];
    if (!entry || !result) return;
    const amountStr = draftAmounts[idx];
    const amount =
      amountStr !== undefined && amountStr.trim() !== ""
        ? Number(amountStr)
        : entry.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: t("scan.badAmount"), variant: "destructive" });
      return;
    }
    const desc = draftDescs[idx]?.trim() || entry.description;
    const entries = result.entries.map((en, i) =>
      i === idx ? { ...en, amount, description: desc } : en,
    );
    setResult({ ...result, entries });
    setConfirmedSet((s) => new Set([...s, idx]));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setPhase("preview");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function resetReviewState() {
    setSavedSet(new Set());
    setConfirmedSet(new Set());
    setDraftAmounts({});
    setDraftDescs({});
    setSavingIdx(null);
    setSavingAll(false);
  }

  async function analyzePhoto() {
    if (!imageDataUrl) return;
    setPhase("analyzing");
    try {
      const data = await apiMutate<ScanResult>("POST", "/ai/accounts-scan", {
        imageBase64: imageDataUrl,
      });
      resetReviewState();
      setResult(data);
      setPhase("results");
    } catch {
      toast({ title: t("scan.noEntries"), variant: "destructive" });
      setPhase("preview");
    }
  }

  async function saveEntry(idx: number) {
    const entry = result?.entries[idx];
    if (!entry || savedSet.has(idx)) return;
    if (needsCheck(entry, idx)) {
      toast({ title: t("scan.checkFirst"), variant: "destructive" });
      return;
    }
    setSavingIdx(idx);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await apiMutate("POST", "/expenses", {
        date: entry.date ?? today,
        category: entry.type === "income" ? "Harvest Income" : entry.category,
        amount: String(entry.amount),
        description: [
          entry.description,
          entry.unit ? `(${entry.unit})` : null,
          entry.originalText && entry.originalText !== entry.description
            ? `[${entry.originalText}]`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      setSavedSet((s) => new Set([...s, idx]));
    } catch {
      toast({ title: "Could not save — please try again.", variant: "destructive" });
    } finally {
      setSavingIdx(null);
    }
  }

  async function saveAll() {
    if (!result?.entries?.length) return;
    setSavingAll(true);
    const today = new Date().toISOString().slice(0, 10);
    const pending = result.entries
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ idx }) => !savedSet.has(idx));
    const toSave = pending.filter(({ entry, idx }) => !needsCheck(entry, idx));
    const skipped = pending.length - toSave.length;
    let count = 0;
    for (const { entry, idx } of toSave) {
      try {
        await apiMutate("POST", "/expenses", {
          date: entry.date ?? today,
          category: entry.type === "income" ? "Harvest Income" : entry.category,
          amount: String(entry.amount),
          description: [
            entry.description,
            entry.unit ? `(${entry.unit})` : null,
            entry.originalText && entry.originalText !== entry.description
              ? `[${entry.originalText}]`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        });
        setSavedSet((s) => new Set([...s, idx]));
        count++;
      } catch {
        /* skip, continue with others */
      }
    }
    setSavingAll(false);
    if (skipped > 0) {
      toast({ title: t("scan.savedSkipped", { n: String(count), m: String(skipped) }) });
    } else {
      toast({ title: `${count} entries saved to Expenses` });
    }
  }

  const entries = result?.entries ?? [];
  const grouped = entries.reduce(
    (acc, entry, idx) => {
      const key = entry.category || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push({ ...entry, _idx: idx });
      return acc;
    },
    {} as Record<string, IndexedEntry[]>,
  );
  const allSaved = entries.length > 0 && savedSet.size >= entries.length;
  const pendingChecks = entries.filter((entry, idx) => needsCheck(entry, idx)).length;

  return (
    <PageShell title={t("scan.title")} back="/farm-accounts">
      <div className="p-4 space-y-4">

        {/* ── CAPTURE ── */}
        {phase === "capture" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <p className="text-base font-bold text-amber-900">{t("scan.instructions")}</p>
              <div className="space-y-2.5">
                {[
                  { Icon: Sun, text: t("scan.tip1") },
                  { Icon: Camera, text: t("scan.tip2") },
                  { Icon: ImageIcon, text: t("scan.tip3") },
                ].map(({ Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-amber-800">
                    <div className="bg-amber-200 rounded-lg p-1.5 shrink-0">
                      <Icon className="h-4 w-4 text-amber-700" />
                    </div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              onClick={() => setShowPicker(true)}
              className="w-full bg-amber-500 text-white rounded-2xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-md"
            >
              <Camera className="h-12 w-12" />
              <span className="text-xl font-bold">{t("scan.readBtn")}</span>
              <span className="text-amber-100 text-sm">{t("scan.chooseHint")}</span>
            </button>

            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />

            {/* Scan method chooser */}
            {showPicker && (
              <div
                className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
                onClick={() => setShowPicker(false)}
                onKeyDown={(e) => { if (e.key === "Escape") setShowPicker(false); }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("scan.chooseMethod")}
                  className="bg-white rounded-t-3xl w-full max-w-md p-5 pb-8 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-center font-bold text-gray-800 text-base pb-1">
                    {t("scan.chooseMethod")}
                  </p>
                  <button
                    autoFocus
                    onClick={() => { setShowPicker(false); cameraRef.current?.click(); }}
                    className="w-full bg-amber-500 text-white rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
                  >
                    <div className="bg-white/20 rounded-xl p-2.5">
                      <Camera className="h-7 w-7" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-base">{t("scan.takePhoto")}</p>
                      <p className="text-amber-100 text-xs">{t("scan.cameraHint")}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowPicker(false); galleryRef.current?.click(); }}
                    className="w-full bg-primary text-primary-foreground rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
                  >
                    <div className="bg-white/20 rounded-xl p-2.5">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-base">{t("scan.gallery")}</p>
                      <p className="text-primary-foreground/80 text-xs">{t("scan.galleryHint")}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setShowPicker(false)}
                    className="w-full py-3 text-gray-500 font-medium text-sm"
                  >
                    {t("scan.cancel")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PREVIEW ── */}
        {phase === "preview" && imageDataUrl && (
          <>
            <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200">
              <img
                src={imageDataUrl}
                alt="Account book"
                className="w-full object-contain max-h-80"
              />
            </div>
            <p className="text-center text-sm text-gray-500">{t("scan.previewHint")}</p>
            <button
              onClick={analyzePhoto}
              className="w-full bg-primary text-primary-foreground rounded-2xl p-5 flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-md text-lg font-bold"
            >
              <Sparkles className="h-6 w-6" />
              {t("scan.readBtn")}
            </button>
            <button
              onClick={() => {
                setPhase("capture");
                setImageDataUrl(null);
              }}
              className="w-full py-3 text-gray-500 font-medium text-sm"
            >
              {t("scan.retake")}
            </button>
          </>
        )}

        {/* ── ANALYZING ── */}
        {phase === "analyzing" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="bg-primary/5 rounded-full p-8">
              <Loader2 className="h-14 w-14 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-gray-800">{t("scan.analyzing")}</p>
              <p className="text-sm text-gray-400">{t("scan.analyzing2")}</p>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && result && (
          <>
            {result.error ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="font-semibold text-gray-700 max-w-xs">{result.error}</p>
                <button
                  onClick={() => setPhase("capture")}
                  className="px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold"
                >
                  {t("scan.retake")}
                </button>
              </div>
            ) : (
              <>
                {/* Summary card */}
                <div className="bg-primary text-primary-foreground rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-lg">
                      {t("scan.found", { n: entries.length })}
                    </p>
                    {result.year && (
                      <span className="bg-white/20 rounded-lg px-3 py-1 text-sm font-semibold">
                        {result.year}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm flex-wrap">
                    {(result.totalExpense ?? 0) > 0 && (
                      <span className="text-primary-foreground/80">
                        {t("scan.totalExpense")}:{" "}
                        <strong className="text-white">{fmt(result.totalExpense!)}</strong>
                      </span>
                    )}
                    {(result.totalIncome ?? 0) > 0 && (
                      <span className="text-primary-foreground/80">
                        {t("scan.totalIncome")}:{" "}
                        <strong className="text-white">{fmt(result.totalIncome!)}</strong>
                      </span>
                    )}
                  </div>
                  {result.pageDescription && (
                    <p className="text-primary-foreground/80 text-xs leading-snug">
                      {result.pageDescription}
                    </p>
                  )}
                </div>

                {/* Pending doubts banner */}
                {pendingChecks > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2.5">
                    <AlertCircle className="h-5 w-5 text-orange-600 shrink-0" />
                    <p className="text-sm text-orange-800 font-medium leading-snug">
                      {t("scan.needCheck", { n: String(pendingChecks) })}
                    </p>
                  </div>
                )}

                {/* Save all / view button */}
                {!allSaved && entries.length > 0 && (
                  <button
                    onClick={saveAll}
                    disabled={savingAll}
                    className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                  >
                    {savingAll ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    {t("scan.saveAll")} ({entries.length - savedSet.size})
                  </button>
                )}
                {allSaved && (
                  <button
                    onClick={() => navigate("/expenses")}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {t("scan.viewExpenses")} →
                  </button>
                )}

                {/* Grouped entry list */}
                {Object.entries(grouped).map(([category, catEntries]) => (
                  <div key={category}>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {catEntries.map((entry) => {
                        const isSaved = savedSet.has(entry._idx);
                        const isSaving = savingIdx === entry._idx;
                        const unclear = needsCheck(entry, entry._idx);
                        const colClass =
                          CAT_COLOR[category] ?? CAT_COLOR.Other;
                        return (
                          <div
                            key={entry._idx}
                            className={`bg-white rounded-xl border p-4 shadow-sm ${
                              unclear ? "border-orange-300" : "border-gray-100"
                            }`}
                          >
                          <div className="flex items-start gap-3">
                            <div
                              className={`rounded-lg px-2 py-0.5 text-xs font-semibold shrink-0 mt-0.5 ${colClass}`}
                            >
                              {entry.type === "income" ? "Income" : "Expense"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm leading-snug">
                                {entry.description}
                              </p>
                              {entry.originalText &&
                                entry.originalText !== entry.description && (
                                  <p className="text-xs text-gray-400 mt-0.5 italic">
                                    {entry.originalText}
                                  </p>
                                )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {entry.date && (
                                  <span className="text-xs text-gray-400">
                                    {entry.date}
                                  </span>
                                )}
                                {entry.unit && (
                                  <span className="text-xs text-gray-400">
                                    · {entry.unit}
                                  </span>
                                )}
                                {unclear && (
                                  <span className="text-xs text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                                    ⚠ {t("scan.aiDoubt")}
                                  </span>
                                )}
                                {hasDoubt(entry) && confirmedSet.has(entry._idx) && !isSaved && (
                                  <span className="text-xs text-primary bg-primary/5 rounded px-1.5 py-0.5">
                                    ✓ {t("scan.checkedByYou")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span
                                className={`text-sm font-bold ${
                                  entry.type === "income"
                                    ? "text-primary"
                                    : "text-orange-700"
                                }`}
                              >
                                {entry.type === "income" ? "+" : "−"}
                                {fmt(entry.amount)}
                              </span>
                              {!unclear && (
                                <button
                                  onClick={() => saveEntry(entry._idx)}
                                  disabled={isSaved || isSaving || savingAll}
                                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                    isSaved
                                      ? "bg-primary/10 text-primary"
                                      : "bg-amber-500 text-white active:bg-amber-600"
                                  } disabled:opacity-60`}
                                >
                                  {isSaving ? "…" : isSaved ? t("scan.saved") : t("scan.saveOne")}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* AI doubt — ask the farmer to rectify, then allow saving */}
                          {unclear && (
                            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2.5">
                              <p className="text-sm font-semibold text-orange-800 leading-snug">
                                {entry.question ?? t("scan.defaultQuestion")}
                              </p>
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs font-medium text-orange-700 block mb-1">
                                    {t("scan.amountLabel")}
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={draftAmounts[entry._idx] ?? String(entry.amount || "")}
                                    onChange={(e) =>
                                      setDraftAmounts((d) => ({
                                        ...d,
                                        [entry._idx]: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-orange-700 block mb-1">
                                    {t("scan.descLabel")}
                                  </label>
                                  <input
                                    type="text"
                                    value={draftDescs[entry._idx] ?? entry.description}
                                    onChange={(e) =>
                                      setDraftDescs((d) => ({
                                        ...d,
                                        [entry._idx]: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => confirmEntry(entry._idx)}
                                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {t("scan.confirmFix")}
                              </button>
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {result.notes && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
                    <strong>Notes: </strong>
                    {result.notes}
                  </div>
                )}

                <button
                  onClick={() => {
                    setPhase("capture");
                    setImageDataUrl(null);
                    setResult(null);
                    resetReviewState();
                  }}
                  className="w-full py-3 text-gray-500 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("scan.scanAnother")}
                </button>
              </>
            )}
          </>
        )}

      </div>
    </PageShell>
  );
}
