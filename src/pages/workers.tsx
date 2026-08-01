import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { canGoBack } from "@/lib/nav-history";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone, MessageCircle, MapPin, Camera, Tag, Users,
  Navigation, Loader2, Banknote, Handshake, Wrench, Locate,
  Tractor, ArrowLeft, Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAdFocus } from "@/hooks/use-ad-focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface HireListing {
  id: number;
  listingType: "rental" | "job";
  category: string;
  title: string;
  posterName: string;
  phone: string;
  whatsapp?: string | null;
  district: string;
  taluk?: string | null;
  village?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  rate?: string | null;
  workersNeeded?: number | null;
  description?: string | null;
  photoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  // Set by the server when the caller's device posted this ad (matched via the
  // X-Owner-Key header). Controls the "Your ad" badge + delete button.
  mine?: boolean;
}

// Per-device secret identifying ads posted from this phone. No login in this app,
// so this key is the only proof of ownership — created once and kept forever.
const OWNER_KEY_STORAGE = "farmone-hire-owner-key";
export function getOwnerKey(): string {
  try {
    let key = localStorage.getItem(OWNER_KEY_STORAGE);
    if (!key) {
      key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(OWNER_KEY_STORAGE, key);
    }
    return key;
  } catch {
    // localStorage unavailable (rare) — posting still works, deletion won't.
    return "";
  }
}

type Tab = "rental" | "job";

const RENTAL_CATEGORIES = [
  { key: "tractor", label: "Tractor", emoji: "🚜" },
  { key: "jcb_hitachi", label: "JCB / Hitachi", emoji: "🏗️" },
  { key: "harvester", label: "Harvester / Cutting", emoji: "🌾" },
  { key: "weight_machine", label: "Weight Machine", emoji: "⚖️" },
  { key: "auto_tempo", label: "Auto / Tempo", emoji: "🛺" },
  { key: "pickup", label: "Pickup", emoji: "🛻" },
  { key: "sprayer", label: "Spray Machine", emoji: "💧" },
  { key: "power_tiller", label: "Power Tiller", emoji: "⚙️" },
  { key: "other", label: "Other", emoji: "📦" },
];

const JOB_CATEGORIES = [
  { key: "farm_labourers", label: "Farm Labourers", emoji: "🧑‍🌾" },
  { key: "women_workers", label: "Women Workers", emoji: "👩‍🌾" },
  { key: "mestri", label: "Mestri", emoji: "🧑‍🔧" },
  { key: "manager_writer", label: "Manager / Writer", emoji: "📋" },
  { key: "other", label: "Other", emoji: "📦" },
];

// Old category keys from ads posted before the rename — show them as Farm Labourers.
const LEGACY_JOB_KEYS: Record<string, string> = {
  mp_workers: "farm_labourers",
  assam_workers: "farm_labourers",
  local_workers: "farm_labourers",
};

const RADIUS_OPTIONS = [10, 25, 50, 100];

function catList(tab: Tab) {
  return tab === "rental" ? RENTAL_CATEGORIES : JOB_CATEGORIES;
}
function catMap(tab: Tab) {
  return Object.fromEntries(catList(tab).map((c) => [c.key, c]));
}

// Haversine distance in km between two lat/lng points.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface Coords {
  lat: number;
  lng: number;
}

export default function Workers() {
  // ?post=rental / ?post=job (from the My Ads "Post an ad" chooser) lands on
  // the right board with the post form opened — posting lives in My Ads now.
  const searchParams = new URLSearchParams(window.location.search);
  const initialPost = searchParams.get("post");
  // ?edit=<id> (from My Ads) opens the post form pre-filled to edit that ad.
  const editId = Number(searchParams.get("edit")) || 0;
  // Came here from My Ads to post/edit — keep the whole trip anchored to My Ads:
  // back goes to /my-ads, no "Hire" landing chooser, and closing the form
  // returns to My Ads where the new/updated ad shows up below.
  const fromMyAds = initialPost === "rental" || initialPost === "job" || editId > 0;
  const [, navigate] = useLocation();
  // Return to My Ads as a real history step-back (not a new push) so the
  // back button on My Ads keeps working (My Ads → Home, not a loop back here).
  const returnToMyAds = () => {
    if (canGoBack()) window.history.back();
    else navigate("/my-ads", { replace: true });
  };
  // ?tab=rental|job&ad=<id> (from the Home recent-ads feed) lands directly on
  // the right board with that ad scrolled into view — no landing chooser.
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab | null>(
    initialPost === "rental" ? "rental"
      : initialPost === "job" ? "job"
      : tabParam === "rental" ? "rental"
      : tabParam === "job" ? "job"
      : null,
  );
  const [filter, setFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [districtQ, setDistrictQ] = useState("");
  const [posting, setPosting] = useState(initialPost === "rental" || initialPost === "job");
  const [myLoc, setMyLoc] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: listings = [], isLoading } = useQuery<HireListing[]>({
    queryKey: ["hire-listings", tab],
    queryFn: () => {
      // Category is filtered client-side so old ads with legacy category keys
      // (mp_workers/assam_workers/local_workers) still match Farm Labourers.
      const params = new URLSearchParams({ type: tab ?? "rental" });
      // The owner key lets the server flag which ads were posted from this device.
      const ownerKey = getOwnerKey();
      return apiFetch(`/hire-listings?${params.toString()}`, ownerKey ? { headers: { "X-Owner-Key": ownerKey } } : undefined);
    },
    enabled: tab !== null,
  });
  const focusAdId = useAdFocus(!isLoading && listings.length > 0);

  // When editing, fetch the ad by id so the form can be pre-filled.
  const { data: editListing, isLoading: editLoading, isError: editError } = useQuery<HireListing>({
    queryKey: ["hire-listing", editId],
    queryFn: () => {
      const ownerKey = getOwnerKey();
      return apiFetch(`/hire-listings/${editId}`, ownerKey ? { headers: { "X-Owner-Key": ownerKey } } : undefined);
    },
    enabled: editId > 0,
  });

  // Once the ad loads, switch to its board (rental/job) and open the edit form.
  useEffect(() => {
    if (editListing) {
      setTab(editListing.listingType);
      setPosting(true);
    }
  }, [editListing]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported on this device", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!radius) setRadius(50);
        setLocating(false);
        toast({ title: "Location found", description: "Showing listings near you." });
      },
      () => {
        setLocating(false);
        toast({ title: "Could not get location", description: "Allow location access and try again.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Decorate with distance, apply district text + radius filters, sort nearest-first.
  const shown = useMemo(() => {
    const dq = districtQ.trim().toLowerCase();
    let rows = listings.map((l) => {
      let dist: number | null = null;
      if (myLoc && l.latitude && l.longitude) {
        dist = distanceKm(myLoc.lat, myLoc.lng, Number(l.latitude), Number(l.longitude));
      }
      return { ...l, _dist: dist };
    });
    if (filter !== "all") {
      rows = rows.filter((l) => (LEGACY_JOB_KEYS[l.category] ?? l.category) === filter);
    }
    if (mineOnly) {
      rows = rows.filter((l) => l.mine);
    }
    if (dq) {
      rows = rows.filter(
        (l) =>
          l.district.toLowerCase().includes(dq) ||
          (l.taluk || "").toLowerCase().includes(dq) ||
          (l.village || "").toLowerCase().includes(dq),
      );
    }
    if (myLoc && radius) {
      // Keep in-radius listings plus any without coordinates (can't be excluded fairly).
      rows = rows.filter((l) => l._dist == null || l._dist <= radius);
    }
    if (myLoc) {
      rows.sort((a, b) => {
        if (a._dist == null && b._dist == null) return 0;
        if (a._dist == null) return 1;
        if (b._dist == null) return -1;
        return a._dist - b._dist;
      });
    }
    return rows;
  }, [listings, districtQ, myLoc, radius, mineOnly, filter]);

  // Editing: while the ad loads (or if it can't be reached), don't flash the
  // Hire landing chooser — show a short status anchored to My Ads instead.
  if (editId > 0 && !tab) {
    return (
      <PageShell title="Edit ad" back="/my-ads">
        <div className="p-6 text-center text-gray-500">
          {editError ? (
            <>
              <p className="text-sm font-medium text-gray-700">Couldn't open this ad</p>
              <p className="text-xs mt-1">It may have been removed. Go back to My Ads and try again.</p>
            </>
          ) : (
            <p className="text-sm">{editLoading ? "Loading your ad…" : "Opening…"}</p>
          )}
        </div>
      </PageShell>
    );
  }

  // Landing — Shop-style big cards, tap to enter a section.
  if (!tab) {
    return (
      <PageShell title="Hire" back="/">
        <div className="p-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-white p-5 shadow-md">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2.5">
                <Handshake className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Hire</h2>
                <p className="text-sm text-white/85">Rent machines or find workers — contact people directly.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setTab("rental"); setFilter("all"); setMineOnly(false); }}
              className="bg-primary/10 rounded-2xl p-5 flex flex-col items-center text-center gap-2 active:scale-95 transition-transform"
            >
              <div className="bg-primary/20 rounded-xl p-3">
                <Tractor className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-bold text-primary leading-tight">Rent Machines</span>
              <span className="text-[11px] text-primary/70 leading-tight">Tractor, JCB, auto, pickup, cutting & more</span>
            </button>
            <button
              onClick={() => { setTab("job"); setFilter("all"); setMineOnly(false); }}
              className="bg-orange-100 rounded-2xl p-5 flex flex-col items-center text-center gap-2 active:scale-95 transition-transform"
            >
              <div className="bg-orange-200 rounded-xl p-3">
                <Users className="h-8 w-8 text-orange-700" />
              </div>
              <span className="text-sm font-bold text-orange-800 leading-tight">Find Workers</span>
              <span className="text-[11px] text-orange-700/70 leading-tight">Farm labourers, mestri, manager & more</span>
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  const accent =
    tab === "rental"
      ? { from: "from-primary", to: "to-violet-500", solid: "bg-primary", hover: "hover:bg-primary/90", chip: "bg-primary border-primary", soft: "bg-primary/5 border-primary/20", softText: "text-primary", icon: Wrench }
      : { from: "from-orange-600", to: "to-amber-500", solid: "bg-orange-600", hover: "hover:bg-orange-700", chip: "bg-orange-600 border-orange-600", soft: "bg-orange-50 border-orange-200", softText: "text-orange-800", icon: Users };

  return (
    <PageShell title={tab === "rental" ? "Rent Machines" : "Find Workers"} back={fromMyAds ? "/my-ads" : "/"}>
      <div className="p-4 space-y-4 pb-24">
        {/* Back link: to My Ads when posting from there, else to the Hire landing */}
        {fromMyAds ? (
          <button
            onClick={returnToMyAds}
            className={`flex items-center gap-2 text-sm font-semibold ${tab === "rental" ? "text-primary" : "text-orange-600"}`}
          >
            <ArrowLeft className="h-4 w-4" /> My Ads
          </button>
        ) : (
          <button
            onClick={() => { setTab(null); setFilter("all"); setMineOnly(false); setDistrictQ(""); setMyLoc(null); setRadius(null); setPosting(false); }}
            className={`flex items-center gap-2 text-sm font-semibold ${tab === "rental" ? "text-primary" : "text-orange-600"}`}
          >
            <ArrowLeft className="h-4 w-4" /> Hire
          </button>
        )}

        {/* Hero */}
        <div className={`rounded-2xl bg-gradient-to-br ${accent.from} ${accent.to} text-white p-5 shadow-md`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <accent.icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {tab === "rental" ? "Rent Machines & Vehicles" : "Find Workers for Your Estate"}
              </h2>
              <p className="text-sm text-white/85">
                {tab === "rental"
                  ? "Tractor, JCB, Hitachi, auto, pickup, cutting & weight machines — contact owners directly."
                  : "Post the workers you need — farm labourers, mestri, manager. People contact you directly."}
              </p>
            </div>
          </div>
        </div>

        {/* Posting moved to My Ads → "Post an ad" (?post=rental / ?post=job). */}

        {/* Location + radius */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={useMyLocation}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border transition ${
                myLoc ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}
              {myLoc ? "Near me" : "Use my location"}
            </button>
            {myLoc && (
              <button onClick={() => { setMyLoc(null); setRadius(null); }} className="text-xs text-gray-400 px-2">
                Clear
              </button>
            )}
          </div>
          {myLoc && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {RADIUS_OPTIONS.map((r) => (
                <Chip key={r} active={radius === r} onClick={() => setRadius(r)} accent={accent.chip}>
                  Within {r} km
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* District search */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={districtQ}
            onChange={(e) => setDistrictQ(e.target.value)}
            placeholder="Search district, taluk or village…"
            className="pl-9"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip active={filter === "all" && !mineOnly} onClick={() => { setFilter("all"); setMineOnly(false); }} accent={accent.chip}>All</Chip>
          <Chip active={mineOnly} onClick={() => { setMineOnly((v) => !v); setFilter("all"); }} accent={accent.chip}>
            📌 My Ads
          </Chip>
          {catList(tab).map((c) => (
            <Chip key={c.key} active={filter === c.key && !mineOnly} onClick={() => { setFilter(c.key); setMineOnly(false); }} accent={accent.chip}>
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>

        {/* Listings */}
        {isLoading ? (
          <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Handshake className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {tab === "rental" ? "No machines listed here yet." : "No worker requirements posted yet."}
            </p>
            <p className="text-xs">Be the first — go to My Ads and tap “Post an ad”.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((l) => (
              <div key={l.id} id={`ad-${l.id}`} className={l.id === focusAdId ? "ring-2 ring-primary rounded-2xl" : undefined}>
                <ListingCard listing={l} dist={l._dist} tab={tab} />
              </div>
            ))}
          </div>
        )}
      </div>

      {posting && (
        <PostModal
          tab={tab}
          editListing={editId > 0 ? editListing : undefined}
          onClose={() => {
            setPosting(false);
            if (fromMyAds) returnToMyAds();
          }}
          onDone={() => {
            setPosting(false);
            qc.invalidateQueries({ queryKey: ["hire-listings"] });
            if (fromMyAds) returnToMyAds();
          }}
        />
      )}
    </PageShell>
  );
}

function Chip({ active, onClick, children, accent }: { active: boolean; onClick: () => void; children: React.ReactNode; accent: string }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium border transition ${
        active ? `${accent} text-white` : "bg-white text-gray-600 border-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

export function ListingCard({ listing, dist, tab }: { listing: HireListing; dist: number | null; tab: Tab }) {
  const cat = catMap(tab)[LEGACY_JOB_KEYS[listing.category] ?? listing.category] ?? catMap(tab).other;
  const phone = listing.phone.replace(/[^\d+]/g, "");
  const wa = (listing.whatsapp ?? listing.phone).replace(/[^\d]/g, "");
  const isRental = listing.listingType === "rental";
  const loc = [listing.village, listing.taluk, listing.district].filter(Boolean).join(", ");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const del = useMutation({
    mutationFn: () => apiMutate("DELETE", `/hire-listings/${listing.id}`, { ownerKey: getOwnerKey() }),
    onSuccess: (res) => {
      toast(
        res !== null || navigator.onLine
          ? { title: "Ad deleted", description: "Your ad has been removed." }
          : { title: "Saved offline", description: "Your ad will be removed when you're back online." },
      );
      qc.invalidateQueries({ queryKey: ["hire-listings"] });
    },
    onError: (err) => {
      const isRejection = err instanceof ApiError && err.status >= 400 && err.status < 500;
      if (isRejection) {
        toast({ title: "Could not delete", description: "This ad can only be deleted from the phone that posted it.", variant: "destructive" });
      } else {
        toast({ title: "Saved offline", description: "Your ad will be removed when you're back online." });
      }
    },
  });

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex">
        <div className={`w-24 h-24 shrink-0 flex items-center justify-center ${isRental ? "bg-primary/5" : "bg-orange-50"}`}>
          {listing.photoUrl ? (
            <img src={listing.photoUrl} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">{cat.emoji}</span>
          )}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 leading-tight">
                {listing.mine && (
                  <span className="mr-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Your ad
                  </span>
                )}
                {listing.title}
              </h3>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Tag className="w-3 h-3" /> {cat.label}
              </p>
            </div>
            {listing.rate && (
              <div className="text-right shrink-0">
                <p className={`font-bold leading-tight flex items-center gap-0.5 ${isRental ? "text-primary" : "text-orange-700"}`}>
                  <Banknote className="w-3.5 h-3.5" />{listing.rate}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {listing.posterName} · {loc}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {!isRental && listing.workersNeeded != null && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                <Users className="w-3 h-3" />{listing.workersNeeded} needed
              </span>
            )}
            {dist != null && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                <Navigation className="w-3 h-3" />~{dist < 1 ? "<1" : Math.round(dist)} km away
              </span>
            )}
          </div>
        </div>
      </div>
      {listing.description && <p className="px-3 pt-1 text-xs text-gray-500">{listing.description}</p>}
      <div className="flex gap-2 p-3 pt-2">
        <a href={`tel:${phone}`} className="flex-1">
          <Button className={`w-full h-9 text-sm ${isRental ? "bg-primary hover:bg-primary/90" : "bg-orange-600 hover:bg-orange-700"}`}>
            <Phone className="w-4 h-4 mr-1.5" /> Call {listing.posterName.split(" ")[0]}
          </Button>
        </a>
        <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noreferrer">
          <Button variant="outline" className={`h-9 text-sm ${isRental ? "border-primary/20 text-primary" : "border-orange-200 text-orange-700"}`}>
            <MessageCircle className="w-4 h-4" />
          </Button>
        </a>
        {listing.mine && (
          <Button
            variant="outline"
            className="h-9 text-sm border-red-200 text-red-600 hover:bg-red-50"
            disabled={del.isPending}
            onClick={() => setConfirming(true)}
          >
            {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        )}
      </div>
      {confirming && (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-red-50 border border-red-100 p-3">
            <p className="text-sm font-semibold text-red-700">Delete this ad?</p>
            <p className="text-xs text-red-600/80 mt-0.5">People will no longer see or contact you about it.</p>
            <div className="flex gap-2 mt-2">
              <Button
                className="h-8 text-xs bg-red-600 hover:bg-red-700"
                disabled={del.isPending}
                onClick={() => { setConfirming(false); del.mutate(); }}
              >
                Yes, delete
              </Button>
              <Button variant="outline" className="h-8 text-xs" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostModal({ tab, onClose, onDone, editListing }: { tab: Tab; onClose: () => void; onDone: () => void; editListing?: HireListing }) {
  const { toast } = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const isRental = tab === "rental";
  const isEdit = !!editListing;
  const cats = catList(tab);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(
    editListing?.latitude != null && editListing?.longitude != null
      ? { lat: Number(editListing.latitude), lng: Number(editListing.longitude) }
      : null,
  );
  const [form, setForm] = useState({
    title: editListing?.title ?? "",
    category: editListing?.category ?? cats[0].key,
    rate: editListing?.rate ?? "",
    workersNeeded: editListing?.workersNeeded != null ? String(editListing.workersNeeded) : "",
    posterName: editListing?.posterName ?? "",
    phone: editListing?.phone ?? "",
    whatsapp: editListing?.whatsapp ?? "",
    district: editListing?.district ?? "",
    taluk: editListing?.taluk ?? "",
    village: editListing?.village ?? "",
    description: editListing?.description ?? "",
    photoUrl: editListing?.photoUrl ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1000;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { set("photoUrl", reader.result as string); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        set("photoUrl", canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => set("photoUrl", reader.result as string);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  async function fillPlaceFromCoords(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return;
      const data = await res.json();
      const a = data?.address ?? {};
      const clean = (v: unknown) =>
        String(v ?? "").replace(/ (district|taluk[au]?|tehsil)$/i, "").trim();
      const norm = (v: string) => v.toLowerCase();
      const district = clean(a.state_district || a.district || a.city_district || a.county);
      let taluk = clean(a.subdistrict || a.municipality || a.county || a.town);
      if (taluk && norm(taluk) === norm(district)) taluk = "";
      const village = clean(a.village || a.hamlet || a.suburb || a.town || a.city);
      let filled = false;
      setForm((f) => {
        const next = {
          ...f,
          district: f.district.trim() || district,
          taluk: f.taluk.trim() || taluk,
          village: f.village.trim() || village,
        };
        filled =
          next.district !== f.district || next.taluk !== f.taluk || next.village !== f.village;
        return next;
      });
      if (filled) {
        toast({ title: "Location details filled in", description: "Please check district, taluk and village are correct." });
      }
    } catch {
      // Offline or geocoder unavailable — coordinates are still attached.
    }
  }

  function attachLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported on this device", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast({ title: "Live location attached", description: "Nearby users will see how far you are." });
        void fillPlaceFromCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        toast({ title: "Could not get location", description: "Allow location access and try again.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const create = useMutation({
    mutationFn: () => {
      const payload = {
        listingType: tab,
        category: form.category,
        title: form.title,
        posterName: form.posterName,
        phone: form.phone,
        whatsapp: form.whatsapp || undefined,
        district: form.district,
        taluk: form.taluk || undefined,
        village: form.village || undefined,
        rate: form.rate || undefined,
        workersNeeded: !isRental && form.workersNeeded ? Number(form.workersNeeded) : undefined,
        description: form.description || undefined,
        photoUrl: form.photoUrl || undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        // Per-device secret so this ad can be deleted/edited later from this phone.
        ownerKey: getOwnerKey() || undefined,
      };
      return isEdit
        ? apiMutate("PATCH", `/hire-listings/${editListing!.id}`, payload)
        : apiMutate("POST", "/hire-listings", payload);
    },
    onSuccess: (res) => {
      toast(
        res
          ? isEdit
            ? { title: "Changes saved", description: "Your ad has been updated." }
            : { title: "Posted!", description: "People can now contact you directly." }
          : { title: "Saved offline", description: isEdit ? "Your changes will save when you're back online." : "Your ad will publish when you're back online." },
      );
      onDone();
    },
    onError: (err) => {
      // apiMutate throws on network/timeout failure but has already queued the write
      // for retry. Only a 4xx is a true rejection; everything else was saved offline.
      const isValidation = err instanceof ApiError && err.status >= 400 && err.status < 500;
      if (isValidation) {
        // Surface the server's reason (e.g. "Enter a valid phone number")
        // instead of a vague generic message.
        let reason = "Please check the details and try again.";
        const match = (err as ApiError).message.match(/\{.*\}$/s);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            if (typeof parsed?.error === "string" && parsed.error) reason = parsed.error;
          } catch {
            // keep generic reason
          }
        }
        toast({ title: isEdit ? "Could not save changes" : "Could not post your ad", description: reason, variant: "destructive" });
      } else {
        toast({ title: "Saved offline", description: isEdit ? "Your changes will save when you're back online." : "Your ad will publish when you're back online." });
        onDone();
      }
    },
  });

  const canSubmit = form.title.trim() && form.posterName.trim() && form.phone.trim() && form.district.trim();
  const accentBtn = isRental ? "bg-primary hover:bg-primary/90" : "bg-orange-600 hover:bg-orange-700";
  const accentSel = isRental ? "border-primary bg-primary/5 text-primary" : "border-orange-500 bg-orange-50 text-orange-800";

  // Tap-outside-to-close, but ignore two false triggers: (1) the "ghost click"
  // that fires ~300ms after the tap which opened this modal and would otherwise
  // land on the just-rendered backdrop and close it instantly (making the form
  // "flash and bounce back out"), and (2) clicks that bubbled up from the sheet.
  const openedAtRef = useRef(Date.now());
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (Date.now() - openedAtRef.current < 500) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto" onClick={handleBackdrop}>
      <div className="bg-white w-full max-w-md mx-auto min-h-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-gray-600" aria-label="Back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="font-bold text-lg text-gray-900">
            {isEdit ? "Edit your ad" : isRental ? "Post a machine for rent" : "Post a worker requirement"}
          </h3>
        </div>

        {isRental && (
          <div>
            <Label className="text-xs text-gray-500">Photo (optional)</Label>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            <button
              onClick={() => photoRef.current?.click()}
              className="mt-1 w-full h-28 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center overflow-hidden"
            >
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Camera className="w-6 h-6 text-primary mb-1" />
                  <span className="text-xs text-primary font-medium">Tap to add photo</span>
                </>
              )}
            </button>
          </div>
        )}

        <Field label={isRental ? "What are you renting out? *" : "What do you need? *"}>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={isRental ? "e.g. Mahindra 575 Tractor with rotavator" : "e.g. Need 10 workers for coffee picking"}
          />
        </Field>

        <div>
          <Label className="text-xs text-gray-500">Category</Label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {cats.map((c) => (
              <button
                key={c.key}
                onClick={() => set("category", c.key)}
                className={`rounded-lg py-1.5 text-[11px] border flex flex-col items-center gap-0.5 ${
                  form.category === c.key ? accentSel : "border-gray-200 text-gray-500"
                }`}
              >
                <span className="text-base leading-none">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={isRental ? "Rate (optional)" : "Wage offered (optional)"}>
            <Input value={form.rate} onChange={(e) => set("rate", e.target.value)} placeholder={isRental ? "1200/hour" : "500/day"} />
          </Field>
          {!isRental && (
            <Field label="Workers needed">
              <Input type="number" inputMode="numeric" value={form.workersNeeded} onChange={(e) => set("workersNeeded", e.target.value)} placeholder="10" />
            </Field>
          )}
        </div>

        <Field label="Your name *">
          <Input value={form.posterName} onChange={(e) => set("posterName", e.target.value)} placeholder="Name" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Contact phone *">
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XXXXXXXXX" />
          </Field>
          <Field label="WhatsApp (optional)">
            <Input type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Same as phone" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="District *">
            <Input value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="District" />
          </Field>
          <Field label="Taluk">
            <Input value={form.taluk} onChange={(e) => set("taluk", e.target.value)} placeholder="Taluk" />
          </Field>
          <Field label="Village">
            <Input value={form.village} onChange={(e) => set("village", e.target.value)} placeholder="Village" />
          </Field>
        </div>

        {/* Live location so nearby users see distance */}
        <button
          onClick={attachLocation}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium border ${
            coords ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"
          }`}
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          {coords ? "Live location attached ✓" : "Attach my live location (recommended)"}
        </button>

        <Field label="Details (optional)">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={isRental ? "Condition, attachments, availability, driver included, etc." : "Work type, dates, food/stay, etc."}
            rows={2}
          />
        </Field>

        <Button
          className={`w-full h-11 ${accentBtn}`}
          disabled={!canSubmit || create.isPending}
          onClick={() => {
            // Validate the phone before sending: an invalid number would be
            // rejected by the server, and an offline post would queue up and
            // silently fail later.
            const digits = form.phone.replace(/\D/g, "");
            if (digits.length < 10 || digits.length > 15) {
              toast({ title: "Enter a valid phone number", description: "Phone number should have at least 10 digits.", variant: "destructive" });
              return;
            }
            const waDigits = form.whatsapp.replace(/\D/g, "");
            if (form.whatsapp.trim() && (waDigits.length < 10 || waDigits.length > 15)) {
              toast({ title: "Enter a valid WhatsApp number", description: "WhatsApp number should have at least 10 digits.", variant: "destructive" });
              return;
            }
            create.mutate();
          }}
        >
          {create.isPending ? (isEdit ? "Saving…" : "Posting…") : isEdit ? "Save changes" : isRental ? "Post for rent" : "Post requirement"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
