import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store, Search, X, Loader2, Phone, MapPin, Trophy, RefreshCw, Globe, Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiFetch, apiMutate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { curSymbol } from "@/lib/currency";

interface MandiPriceRow {
  id: number;
  date: string;
  crop: string;
  sellerName: string;
  sellerType: string;
  price: string;
  priceMin: string | null;
  priceMax: string | null;
  unit: string;
  priceDate: string | null;
  location: string | null;
  phone: string | null;
  notes: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

// Plain-language freshness tag so a farmer instantly knows how current a quote
// is — "Today", "Yesterday", "5 days old" — instead of reading a paragraph.
function freshness(priceDate: string | null): { label: string; fresh: boolean } | null {
  if (!priceDate) return null;
  const quoted = new Date(`${priceDate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - quoted.getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return { label: "Today", fresh: true };
  if (days === 1) return { label: "Yesterday", fresh: true };
  return { label: `${days} days old`, fresh: false };
}

interface MandiPricesResponse {
  date: string;
  status: "pending" | "done" | "error";
  error: string | null;
  fetchedAt: string | null;
  prices: MandiPriceRow[];
}

const SELLER_TYPE_COLORS: Record<string, string> = {
  "Mandi": "bg-purple-100 text-purple-700",
  "Curing works": "bg-amber-50 text-amber-700",
  "Local buyer": "bg-blue-100 text-blue-700",
  "Exporter": "bg-accent/10 text-accent",
  "Trader": "bg-gray-100 text-gray-700",
  "Government": "bg-primary/5 text-primary",
};

function fmtPrice(p: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(p));
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// How many kg one unit represents, so every quote can also be shown per kg —
// farmers compare a "per 50 kg bag" curing works rate with a "per quintal"
// mandi rate at a glance.
function unitToKg(unit: string): number | null {
  const u = unit.toLowerCase();
  if (/quintal/.test(u)) return 100;
  if (/tonne|ton\b/.test(u)) return 1000;
  const m = u.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (m) return Number(m[1]);
  if (/\bkg\b/.test(u)) return 1;
  return null;
}

// Converts a quote into another weight basis (1 kg or 100 kg/quintal) so every
// price is readable both KG-wise and per quintal, whatever unit it was quoted in.
function convert(price: string, unit: string, targetKg: number): string | null {
  const kg = unitToKg(unit);
  if (!kg || kg === targetKg) return null;
  const v = (Number(price) / kg) * targetKg;
  if (!Number.isFinite(v)) return null;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: v < 100 ? 2 : 0 }).format(v);
}

// Remembered crop searches — shown as one-tap chips under the search box so
// the farmer never has to retype "coffee" or "pepper" every visit.
const RECENT_KEY = "mandi-recent-searches";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return [...new Set(
      arr.filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    )].slice(0, 8);
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    // Storage full/blocked — chips just won't persist.
  }
}

export default function MandiPrices() {
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<MandiPricesResponse>({
    queryKey: ["mandi-prices"],
    queryFn: () => apiFetch("/mandi/prices"),
    // While the morning fetch is running, poll until prices arrive.
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 6000 : false),
  });

  const refresh = useMutation({
    mutationFn: () => apiMutate("POST", "/mandi/refresh", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mandi-prices"] });
      toast({ title: "Checking today's prices again…" });
    },
    onError: () => toast({ title: "Could not refresh — try again", variant: "destructive" }),
  });

  const prices = data?.prices ?? [];
  const status = data?.status;
  const fetching = status === "pending";

  // Client-side crop/seller search — typing "coffee" instantly narrows the list.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prices;
    return prices.filter((p) =>
      p.crop.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q) ||
      p.sellerType.toLowerCase().includes(q) ||
      (p.location ?? "").toLowerCase().includes(q)
    );
  }, [prices, search]);

  // Remember a search once it settles and actually matched something, so
  // half-typed words and typos never become chips.
  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2 || filtered.length === 0) return;
    const t = setTimeout(() => {
      setRecent((prev) => {
        const next = [term, ...prev.filter((s) => s !== term)].slice(0, 8);
        saveRecent(next);
        return next;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [search, filtered.length]);

  const removeRecent = (term: string) => {
    setRecent((prev) => {
      const next = prev.filter((s) => s !== term);
      saveRecent(next);
      return next;
    });
  };

  // Group by crop; best price marked only among quotes sharing the same unit,
  // so a "per quintal" quote is never called better than a "per kg" one.
  const byCrop = useMemo(() => {
    const map = new Map<string, MandiPriceRow[]>();
    for (const p of filtered) {
      const arr = map.get(p.crop) ?? [];
      arr.push(p);
      map.set(p.crop, arr);
    }
    const result: Array<{ crop: string; rows: MandiPriceRow[]; bestIds: Set<number> }> = [];
    for (const [crop, arr] of map.entries()) {
      arr.sort((a, b) => Number(b.price) - Number(a.price));
      const bestIds = new Set<number>();
      const seenUnits = new Set<string>();
      for (const r of arr) {
        if (!seenUnits.has(r.unit)) {
          seenUnits.add(r.unit);
          bestIds.add(r.id); // first (highest) price per unit
        }
      }
      result.push({ crop, rows: arr, bestIds });
    }
    return result;
  }, [filtered]);

  return (
    <PageShell title="Market Prices" back="/">
      <div className="p-4 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Today's market prices</h2>
              <p className="text-[12px] text-white/80 leading-snug">
                Found automatically every morning from government mandi rates, curing works &amp; buyer websites for your district
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/70">
              {fetching
                ? "Searching the internet now…"
                : data?.fetchedAt
                  ? `Updated today at ${fmtTime(data.fetchedAt)}`
                  : ""}
            </p>
            <button
              onClick={() => refresh.mutate()}
              disabled={fetching || refresh.isPending}
              className="rounded-lg bg-white/20 px-2.5 py-1.5 text-[12px] font-semibold flex items-center gap-1.5 active:opacity-80 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching || refresh.isPending ? "animate-spin" : ""}`} />
              Check again
            </button>
          </div>
        </div>

        {/* Crop search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a crop — coffee, pepper, arecanut…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 py-2.5 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Remembered searches — one tap, no retyping */}
        {recent.length > 0 && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {recent.map((term) => {
              const active = search.trim().toLowerCase() === term;
              return (
                <span
                  key={term}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium capitalize ${
                    active
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-white border-gray-200 text-gray-700 active:bg-gray-50"
                  }`}
                >
                  <button onClick={() => setSearch(active ? "" : term)} className="capitalize">
                    {term}
                  </button>
                  <button
                    onClick={() => removeRecent(term)}
                    aria-label={`Remove ${term}`}
                    className={active ? "text-white/80" : "text-gray-400"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : fetching && prices.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-purple-50 flex items-center justify-center">
              <Globe className="h-7 w-7 text-purple-500 animate-pulse" />
            </div>
            <p className="font-semibold text-gray-700">Fetching today's prices…</p>
            <p className="text-sm mt-1 max-w-[260px] mx-auto leading-snug">
              Checking government mandi rates, curing works and local buyers near you. This takes a minute or two.
            </p>
          </div>
        ) : status === "error" && prices.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Store className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-gray-700">Could not fetch today's prices</p>
            <p className="text-sm mt-1">Check your internet and tap "Check again"</p>
          </div>
        ) : byCrop.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Store className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium text-gray-500">
              {search ? `No prices found for "${search}" today` : "No prices found for today yet"}
            </p>
            <p className="text-sm mt-1">
              {search ? "Try another crop name" : "Tap \"Check again\" to search once more"}
            </p>
          </div>
        ) : (
          byCrop.map(({ crop, rows, bestIds }) => (
            <div key={crop} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-primary/5 flex items-center justify-between">
                <p className="font-bold text-gray-800">{crop}</p>
                <p className="text-[11px] text-gray-500">{rows.length} {rows.length === 1 ? "buyer" : "buyers"}</p>
              </div>
              {rows.map((r, i) => {
                const isBest = bestIds.has(r.id) && rows.length > 1;
                return (
                  <div
                    key={r.id}
                    className={`px-4 py-3 flex items-start justify-between gap-3 ${i > 0 ? "border-t border-gray-50" : ""} ${isBest ? "bg-amber-50/60" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isBest && <Trophy className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                        <p className="font-semibold text-sm text-gray-800 break-words">{r.sellerName}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SELLER_TYPE_COLORS[r.sellerType] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.sellerType}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {(() => {
                            const f = freshness(r.priceDate);
                            if (!f) return null;
                            return (
                              <span
                                className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${
                                  f.fresh ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {f.label}
                              </span>
                            );
                          })()}
                          {r.notes && (
                            <span className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                              {r.notes}
                            </span>
                          )}
                        </div>
                        {r.location && (
                          <p className="text-[11px] text-gray-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" /> {r.location}
                          </p>
                        )}
                        {r.phone && (
                          <a
                            href={`tel:${r.phone}`}
                            className="text-[12px] text-primary font-semibold flex items-center gap-1 w-fit"
                          >
                            <Phone className="h-3 w-3 flex-shrink-0" /> {r.phone}
                          </a>
                        )}
                        {r.sourceUrl && /^https?:\/\//i.test(r.sourceUrl) ? (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-500 flex items-center gap-1 w-fit break-all"
                          >
                            <Globe className="h-3 w-3 flex-shrink-0" /> {r.sourceName ?? "Source"}
                          </a>
                        ) : r.sourceName ? (
                          <p className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Globe className="h-3 w-3 flex-shrink-0" /> {r.sourceName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold ${isBest ? "text-amber-600" : "text-gray-800"}`}>
                        {curSymbol()}{fmtPrice(r.price)}
                      </p>
                      <p className="text-[10px] text-gray-500">{r.unit}</p>
                      {convert(r.price, r.unit, 1) && (
                        <p className="text-[10px] font-semibold text-primary">≈ {curSymbol()}{convert(r.price, r.unit, 1)}/kg</p>
                      )}
                      {convert(r.price, r.unit, 100) && (
                        <p className="text-[10px] text-gray-500">≈ {curSymbol()}{convert(r.price, r.unit, 100)}/quintal</p>
                      )}
                      {r.priceMin && r.priceMax && Number(r.priceMin) !== Number(r.priceMax) && (
                        <p className="text-[10px] text-gray-400">{curSymbol()}{fmtPrice(r.priceMin)}–{curSymbol()}{fmtPrice(r.priceMax)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        <p className="text-[11px] text-gray-400 text-center leading-snug pb-2">
          Prices are collected automatically from public sources each morning. Always confirm with the buyer before selling.
        </p>
      </div>
    </PageShell>
  );
}
