import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { canGoBack } from "@/lib/nav-history";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone, MessageCircle, MapPin, Tractor, Camera, Tag, ArrowLeft,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiFetch, apiMutate } from "@/lib/api";
import { getOwnerKey } from "@/pages/workers";
import { useToast } from "@/hooks/use-toast";
import { useAdFocus } from "@/hooks/use-ad-focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface EquipmentListing {
  id: number;
  sellerName: string;
  phone: string;
  whatsapp?: string | null;
  title: string;
  category: string;
  condition: string;
  price: string;
  location: string;
  description?: string | null;
  photoUrl?: string | null;
  isAvailable: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { key: "tractor", label: "Tractor", emoji: "🚜" },
  { key: "weeding_machine", label: "Weeding Machine", emoji: "🌿" },
  { key: "spray_pump", label: "Spray Pump", emoji: "🧴" },
  { key: "sprinkler", label: "Sprinkler", emoji: "💦" },
  { key: "tiller", label: "Tiller", emoji: "⚙️" },
  { key: "harvester", label: "Harvester", emoji: "🌾" },
  { key: "plough", label: "Plough", emoji: "🪓" },
  { key: "trailer", label: "Trailer", emoji: "🛻" },
  { key: "power_tools", label: "Power Tools", emoji: "🔧" },
  { key: "irrigation", label: "Irrigation", emoji: "🚰" },
  { key: "other", label: "Other", emoji: "📦" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

function inr(n: number) {
  return fmtMoney(n, 0);
}

export default function Equipment() {
  const [filter, setFilter] = useState<string>("all");
  const [condition, setCondition] = useState<string>("all");
  // ?sell=1 (from the My Ads chooser) opens the sell form directly. In that
  // mode we hide the browse filters/listings and anchor everything to My Ads.
  const fromMyAds = new URLSearchParams(window.location.search).get("sell") === "1";
  const [, navigate] = useLocation();
  // Return to My Ads as a real history step-back (not a new push) so the
  // back button on My Ads keeps working (My Ads → Home, not a loop back here).
  const returnToMyAds = () => {
    if (canGoBack()) window.history.back();
    else navigate("/my-ads", { replace: true });
  };
  const [selling, setSelling] = useState(fromMyAds);
  const qc = useQueryClient();

  const { data: listings = [], isLoading } = useQuery<EquipmentListing[]>({
    queryKey: ["equipment-listings", filter, condition],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("category", filter);
      if (condition !== "all") params.set("condition", condition);
      const qs = params.toString();
      return apiFetch(`/equipment-listings${qs ? `?${qs}` : ""}`);
    },
    enabled: !fromMyAds,
  });
  const focusAdId = useAdFocus(!isLoading && listings.length > 0);

  return (
    <PageShell title="Farm Equipments for Sale" back={fromMyAds ? "/my-ads" : "/shop"}>
      <div className="p-4 space-y-4 pb-24">
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <Tractor className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Buy & Sell Farm Equipment</h2>
              <p className="text-sm text-primary-foreground/80">Tractors, pumps, sprinklers & more — new or used. Contact sellers directly.</p>
            </div>
          </div>
        </div>

        {/* Posting moved to My Ads → "Post an ad" (?sell=1 opens the form).
            When selling from My Ads, hide the browse filters/listings —
            the sell form is all that's needed. */}
        {!fromMyAds && (
          <>
            {/* Condition filter */}
            <div className="flex gap-2">
              <Chip active={condition === "all"} onClick={() => setCondition("all")}>All</Chip>
              <Chip active={condition === "new"} onClick={() => setCondition("new")}>🆕 New</Chip>
              <Chip active={condition === "used"} onClick={() => setCondition("used")}>♻️ Used</Chip>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
                  {c.emoji} {c.label}
                </Chip>
              ))}
            </div>

            {isLoading ? (
              <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
            ) : listings.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Tractor className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No equipment listed here yet.</p>
                <p className="text-xs">Be the first — go to My Ads and tap “Post an ad”.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} id={`ad-${l.id}`} className={l.id === focusAdId ? "ring-2 ring-primary rounded-2xl" : undefined}>
                    <ListingCard listing={l} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selling && (
        <SellModal
          onClose={() => {
            setSelling(false);
            if (fromMyAds) returnToMyAds();
          }}
          onDone={() => {
            setSelling(false);
            qc.invalidateQueries({ queryKey: ["equipment-listings"] });
            if (fromMyAds) returnToMyAds();
          }}
        />
      )}
    </PageShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium border transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-white text-gray-600 border-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function ListingCard({ listing }: { listing: EquipmentListing }) {
  const cat = CAT_MAP[listing.category] ?? CAT_MAP.other;
  const phone = listing.phone.replace(/[^\d+]/g, "");
  const wa = (listing.whatsapp ?? listing.phone).replace(/[^\d]/g, "");
  const isNew = listing.condition === "new";

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex">
        <div className="w-24 h-24 shrink-0 bg-primary/10 flex items-center justify-center">
          {listing.photoUrl ? (
            <img src={listing.photoUrl} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">{cat.emoji}</span>
          )}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{listing.title}</h3>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {cat.label}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-primary font-bold leading-tight">{inr(Number(listing.price))}</p>
              <span
                className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isNew ? "bg-primary/5 text-primary" : "bg-gray-100 text-gray-600"
                }`}
              >
                {isNew ? "New" : "Used"}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" /> {listing.sellerName} · {listing.location}
          </p>
        </div>
      </div>
      {listing.description && <p className="px-3 pt-1 text-xs text-gray-500">{listing.description}</p>}
      <div className="flex gap-2 p-3 pt-2">
        <a href={`tel:${phone}`} className="flex-1">
          <Button className="w-full bg-primary hover:bg-primary/90 h-9 text-sm">
            <Phone className="w-4 h-4 mr-1.5" /> Call seller
          </Button>
        </a>
        <a href={`https://wa.me/${wa.length === 10 ? "91" + wa : wa}`} target="_blank" rel="noreferrer">
          <Button variant="outline" className="h-9 text-sm border-primary/20 text-primary">
            <MessageCircle className="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}

function SellModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    category: "tractor",
    condition: "used",
    price: "",
    sellerName: "",
    phone: "",
    whatsapp: "",
    location: "",
    description: "",
    photoUrl: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to max 1000px and re-encode as JPEG to keep payload small.
        const max = 1000;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          set("photoUrl", reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        set("photoUrl", canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => set("photoUrl", reader.result as string);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const create = useMutation({
    mutationFn: () =>
      apiMutate("POST", "/equipment-listings", {
        ...form,
        price: Number(form.price) || 0,
        // Per-device secret so this ad shows in "My Ads" and can be deleted later.
        ownerKey: getOwnerKey(),
      }),
    onSuccess: (res) => {
      toast(
        res
          ? { title: "Posted!", description: "Buyers can now contact you directly." }
          : { title: "Saved offline", description: "Your ad will publish when you're back online." }
      );
      onDone();
    },
    onError: () => toast({ title: "Could not post equipment", variant: "destructive" }),
  });

  const canSubmit =
    form.title.trim() && form.sellerName.trim() && form.phone.trim() && form.location.trim() && form.price.trim();

  // Ignore the "ghost click" (~300ms after the opening tap) that would land on
  // the fresh backdrop and close the form instantly, plus bubbled sheet clicks.
  const openedAtRef = useRef(Date.now());
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (Date.now() - openedAtRef.current < 500) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto" onClick={handleBackdrop}>
      <div
        className="bg-white w-full max-w-md mx-auto min-h-full p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 -ml-1 text-gray-600" aria-label="Back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="font-bold text-lg text-gray-900">Post equipment for sale</h3>
        </div>

        <div>
          <Label className="text-xs text-gray-500">Equipment photo</Label>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
          <button
            onClick={() => photoRef.current?.click()}
            className="mt-1 w-full h-28 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center overflow-hidden"
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

        <Field label="What are you selling? *">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Mahindra 575 Tractor" />
        </Field>

        <div>
          <Label className="text-xs text-gray-500">Condition</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[
              { key: "used", label: "♻️ Used" },
              { key: "new", label: "🆕 New" },
            ].map((c) => (
              <button
                key={c.key}
                onClick={() => set("condition", c.key)}
                className={`rounded-lg py-2 text-sm font-medium border ${
                  form.condition === c.key ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-500">Category</Label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => set("category", c.key)}
                className={`rounded-lg py-1.5 text-[11px] border flex flex-col items-center gap-0.5 ${
                  form.category === c.key ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500"
                }`}
              >
                <span className="text-base leading-none">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Field label={`Price (${curSymbol()}) *`}>
          <Input type="number" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="150000" />
        </Field>

        <Field label="Your name *">
          <Input value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} placeholder="Seller name" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Contact phone *">
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XXXXXXXXX" />
          </Field>
          <Field label="WhatsApp (optional)">
            <Input type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Same as phone" />
          </Field>
        </div>

        <Field label="Location *">
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Village, District" />
        </Field>

        <Field label="Description (optional)">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Year, hours used, condition, accessories, etc." rows={2} />
        </Field>

        <Button
          className="w-full bg-primary hover:bg-primary/90 h-11"
          disabled={!canSubmit || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Posting…" : "Post for sale"}
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
