import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { canGoBack } from "@/lib/nav-history";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone, MessageCircle, MapPin, ShoppingBasket, Camera, Tag, Lock, ArrowLeft, Loader2,
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

interface ProduceListing {
  id: number;
  sellerName: string;
  phone: string;
  whatsapp?: string | null;
  productName: string;
  category: string;
  price: string;
  unit: string;
  quantity?: string | null;
  location: string;
  description?: string | null;
  photoUrl?: string | null;
  isAvailable: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "pepper", label: "Pepper", emoji: "🌶️" },
  { key: "honey", label: "Honey", emoji: "🍯" },
  { key: "spices", label: "Spices", emoji: "🧂" },
  { key: "fruits", label: "Fruits", emoji: "🍎" },
  { key: "tea", label: "Tea", emoji: "🍵" },
  { key: "vegetables", label: "Vegetables", emoji: "🥦" },
  { key: "grains", label: "Grains", emoji: "🌾" },
  { key: "dairy", label: "Dairy", emoji: "🥛" },
  { key: "other", label: "Other", emoji: "📦" },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

function inr(n: number) {
  return fmtMoney(n, 0);
}

export default function Marketplace() {
  const [filter, setFilter] = useState<string>("all");
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

  const { data: listings = [], isLoading } = useQuery<ProduceListing[]>({
    queryKey: ["produce-listings", filter],
    queryFn: () => apiFetch(`/produce-listings${filter !== "all" ? `?category=${filter}` : ""}`),
    enabled: !fromMyAds,
  });
  const focusAdId = useAdFocus(!isLoading && listings.length > 0);

  const { data: settings } = useQuery<{ canSell: boolean }>({
    queryKey: ["app-settings"],
    queryFn: () => apiFetch("/app-settings"),
  });
  const canSell = !!settings?.canSell;

  // Reached from My Ads → "Sell produce": show ONLY a full-screen surface, never
  // the browse page behind it. Loading → spinner; no active plan → full-screen
  // unlock CTA; otherwise the full-screen sell form.
  if (fromMyAds) {
    if (!settings) {
      return (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    if (!canSell) {
      return (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto p-5">
          <div className="w-full max-w-md mx-auto space-y-4">
            <button onClick={returnToMyAds} className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ArrowLeft className="h-4 w-4" /> My Ads
            </button>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock className="h-6 w-6 text-amber-600" />
              </div>
              <p className="font-bold text-amber-900">Unlock selling for your produce</p>
              <p className="text-sm text-amber-700 mt-1">Selling needs an active Farmer plan.</p>
              <Link href="/subscription" className="inline-block mt-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-11 leading-[44px] font-bold">
                See plans
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <SellModal
        onClose={returnToMyAds}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["produce-listings"] });
          returnToMyAds();
        }}
      />
    );
  }

  return (
    <PageShell title="Farmers Market" back={fromMyAds ? "/my-ads" : "/"}>
      <div className="p-4 space-y-4 pb-24">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-white p-5 shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <ShoppingBasket className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Farmer Market</h2>
              <p className="text-sm text-primary/5">Sell your produce directly to buyers — no middlemen</p>
            </div>
          </div>
        </div>

        {/* Selling moved to My Ads → "Post an ad". If someone arrives here to
            sell (?sell=1) without an active plan, show the unlock banner. */}
        {selling && settings && !canSell && (
          <Link href="/subscription" className="w-full flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left active:scale-[0.99] transition">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 text-white rounded-full p-1.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 text-sm">Unlock selling for your produce</p>
                <p className="text-xs text-amber-700">Selling needs an active Farmer plan. Tap to see plans.</p>
              </div>
            </div>
          </Link>
        )}

        {/* When selling from My Ads, hide the browse filters/listings —
            the sell form is all that's needed. */}
        {!fromMyAds && (
          <>
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
                <ShoppingBasket className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No produce listed here yet.</p>
                <p className="text-xs">Be the first — go to My Ads and tap “Post an ad”.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} id={`ad-${l.id}`} className={l.id === focusAdId ? "ring-2 ring-primary rounded-2xl" : undefined}>
                    <ListingCard listing={l} onChanged={() => qc.invalidateQueries({ queryKey: ["produce-listings"] })} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selling && canSell && (
        <SellModal
          onClose={() => {
            setSelling(false);
            if (fromMyAds) returnToMyAds();
          }}
          onDone={() => {
            setSelling(false);
            qc.invalidateQueries({ queryKey: ["produce-listings"] });
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

function ListingCard({ listing, onChanged }: { listing: ProduceListing; onChanged: () => void }) {
  const cat = CAT_MAP[listing.category] ?? CAT_MAP.other;
  const phone = listing.phone.replace(/[^\d+]/g, "");
  const wa = (listing.whatsapp ?? listing.phone).replace(/[^\d]/g, "");

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex">
        <div className="w-24 h-24 shrink-0 bg-primary/5 flex items-center justify-center">
          {listing.photoUrl ? (
            <img src={listing.photoUrl} alt={listing.productName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">{cat.emoji}</span>
          )}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{listing.productName}</h3>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {cat.label}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-primary font-bold leading-tight">{inr(Number(listing.price))}</p>
              <p className="text-[11px] text-gray-400">per {listing.unit}</p>
            </div>
          </div>
          {listing.quantity && <p className="text-xs text-gray-500 mt-1">Available: {listing.quantity}</p>}
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" /> {listing.sellerName} · {listing.location}
          </p>
        </div>
      </div>
      {listing.description && <p className="px-3 pt-1 text-xs text-gray-500">{listing.description}</p>}
      <div className="flex gap-2 p-3 pt-2">
        <a href={`tel:${phone}`} className="flex-1">
          <Button className="w-full bg-primary hover:bg-primary/90 h-9 text-sm">
            <Phone className="w-4 h-4 mr-1.5" /> Call to buy
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
    productName: "",
    category: "coffee",
    price: "",
    unit: "kg",
    quantity: "",
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
      apiMutate("POST", "/produce-listings", {
        ...form,
        price: Number(form.price) || 0,
        // Per-device secret so this ad shows in "My Ads" and can be deleted later.
        ownerKey: getOwnerKey(),
      }),
    onSuccess: (res) => {
      toast(
        res
          ? { title: "Listed!", description: "Buyers can now contact you directly." }
          : { title: "Saved offline", description: "Your listing will publish when you're back online." }
      );
      onDone();
    },
    onError: () => toast({ title: "Could not list produce", variant: "destructive" }),
  });

  const canSubmit =
    form.productName.trim() && form.sellerName.trim() && form.phone.trim() && form.location.trim() && form.price.trim();

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
          <h3 className="font-bold text-lg text-gray-900">Sell your produce</h3>
        </div>

        <div>
          <Label className="text-xs text-gray-500">Product photo</Label>
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

        <Field label="What are you selling? *">
          <Input value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder="e.g. Arabica Coffee Beans" />
        </Field>

        <div>
          <Label className="text-xs text-gray-500">Category</Label>
          <div className="mt-1 grid grid-cols-5 gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => set("category", c.key)}
                className={`rounded-lg py-1.5 text-[11px] border flex flex-col items-center gap-0.5 ${
                  form.category === c.key ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500"
                }`}
              >
                <span className="text-base leading-none">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={`Price (${curSymbol()}) *`}>
            <Input type="number" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="350" />
          </Field>
          <Field label="Per unit">
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="kg" />
          </Field>
        </div>

        <Field label="Quantity available">
          <Input value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="e.g. 50 kg" />
        </Field>

        <Field label="Your name *">
          <Input value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} placeholder="Farmer name" />
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
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Quality, harvest date, organic, etc." rows={2} />
        </Field>

        <Button
          className="w-full bg-primary hover:bg-primary/90 h-11"
          disabled={!canSubmit || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Listing…" : "List for sale"}
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
