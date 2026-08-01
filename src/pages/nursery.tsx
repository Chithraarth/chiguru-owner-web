import { useState, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { canGoBack } from "@/lib/nav-history";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { SelectOrType } from "@/components/select-or-type";
import {
  Phone, MapPin, Store, Loader2, Trash2,
  ArrowLeft, Clock, CheckCircle2, XCircle,
  Sprout, Search, Plus, X, Camera, Star, ImageIcon, Lock
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate } from "@/lib/api";
import { getOwnerKey } from "@/pages/workers";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface NurseryVendor {
  id: number; name: string; phone: string; whatsapp?: string;
  location: string; description?: string; speciality?: string;
  photoUrl?: string; avgRating?: number; ratingCount?: number;
  listingCount: number; createdAt: string; status?: string;
}

interface NurseryRating {
  id: number; vendorId: number; rating: number;
  comment?: string; raterName?: string; createdAt: string;
}

interface NurseryListing {
  id: number; vendorId: number; vendorName: string; vendorPhone: string;
  vendorLocation: string; name: string; category: string;
  price: string; unit: string; qtyAvailable: number;
  description?: string; photoUrl?: string; isAvailable: boolean; createdAt: string;
}

const NURSERY_CATS = [
  { key: "All", emoji: "🌿", label: "All" },
  { key: "Vegetable Seedlings", emoji: "🥦", label: "Vegetables" },
  { key: "Fruit Saplings", emoji: "🍋", label: "Fruit Trees" },
  { key: "Flowering Plants", emoji: "🌸", label: "Flowering" },
  { key: "Trees & Timber", emoji: "🌳", label: "Trees" },
  { key: "Herbs & Spices", emoji: "🌿", label: "Herbs" },
  { key: "Indoor Plants", emoji: "🪴", label: "Indoor" },
  { key: "Medicinal Plants", emoji: "🌱", label: "Medicinal" },
];

const CAT_EMOJIS: Record<string, string> = {
  "Vegetable Seedlings": "🥦", "Fruit Saplings": "🍋", "Flowering Plants": "🌸",
  "Trees & Timber": "🌳", "Herbs & Spices": "🌿", "Indoor Plants": "🪴", "Medicinal Plants": "🌱",
};

const PLANT_SUGGESTIONS = [
  { emoji: "🍋", name: "Lemon", category: "Fruit Saplings" },
  { emoji: "🥭", name: "Mango", category: "Fruit Saplings" },
  { emoji: "🍌", name: "Banana", category: "Fruit Saplings" },
  { emoji: "🥥", name: "Coconut", category: "Fruit Saplings" },
  { emoji: "🍊", name: "Orange", category: "Fruit Saplings" },
  { emoji: "🍈", name: "Guava", category: "Fruit Saplings" },
  { emoji: "🍑", name: "Papaya", category: "Fruit Saplings" },
  { emoji: "🍎", name: "Pomegranate", category: "Fruit Saplings" },
  { emoji: "🫐", name: "Jamun", category: "Fruit Saplings" },
  { emoji: "🍐", name: "Sapota / Chiku", category: "Fruit Saplings" },
  { emoji: "🌰", name: "Jackfruit", category: "Fruit Saplings" },
  { emoji: "🍇", name: "Grape", category: "Fruit Saplings" },
  { emoji: "🍓", name: "Strawberry", category: "Fruit Saplings" },
  { emoji: "🍍", name: "Pineapple", category: "Fruit Saplings" },
  { emoji: "🫒", name: "Amla / Gooseberry", category: "Fruit Saplings" },
  { emoji: "🍒", name: "Fig", category: "Fruit Saplings" },
  { emoji: "🥑", name: "Avocado", category: "Fruit Saplings" },
  { emoji: "🐉", name: "Dragon Fruit", category: "Fruit Saplings" },
  { emoji: "🍅", name: "Tomato", category: "Vegetable Seedlings" },
  { emoji: "🫑", name: "Capsicum", category: "Vegetable Seedlings" },
  { emoji: "🌶️", name: "Chilli", category: "Vegetable Seedlings" },
  { emoji: "🍆", name: "Brinjal / Baingan", category: "Vegetable Seedlings" },
  { emoji: "🥦", name: "Cauliflower", category: "Vegetable Seedlings" },
  { emoji: "🥬", name: "Cabbage", category: "Vegetable Seedlings" },
  { emoji: "🧅", name: "Onion", category: "Vegetable Seedlings" },
  { emoji: "🥒", name: "Cucumber", category: "Vegetable Seedlings" },
  { emoji: "🌿", name: "Bitter Gourd / Karela", category: "Vegetable Seedlings" },
  { emoji: "🌿", name: "Ridge Gourd / Turai", category: "Vegetable Seedlings" },
  { emoji: "🎃", name: "Pumpkin", category: "Vegetable Seedlings" },
  { emoji: "🥬", name: "Okra / Bhindi", category: "Vegetable Seedlings" },
  { emoji: "🥬", name: "Spinach / Palak", category: "Vegetable Seedlings" },
  { emoji: "🌿", name: "Methi / Fenugreek", category: "Vegetable Seedlings" },
  { emoji: "🌿", name: "Drumstick / Moringa", category: "Vegetable Seedlings" },
  { emoji: "🌿", name: "Coriander / Dhaniya", category: "Vegetable Seedlings" },
  { emoji: "🌸", name: "Rose", category: "Flowering Plants" },
  { emoji: "🌸", name: "Jasmine / Mogra", category: "Flowering Plants" },
  { emoji: "🌼", name: "Marigold / Genda", category: "Flowering Plants" },
  { emoji: "🌺", name: "Hibiscus / Chembarathi", category: "Flowering Plants" },
  { emoji: "🌸", name: "Bougainvillea", category: "Flowering Plants" },
  { emoji: "🪷", name: "Lotus", category: "Flowering Plants" },
  { emoji: "🌻", name: "Sunflower", category: "Flowering Plants" },
  { emoji: "🌸", name: "Chrysanthemum", category: "Flowering Plants" },
  { emoji: "🌷", name: "Lily", category: "Flowering Plants" },
  { emoji: "🪴", name: "Orchid", category: "Flowering Plants" },
  { emoji: "🌸", name: "Gerbera", category: "Flowering Plants" },
  { emoji: "🌸", name: "Anthurium", category: "Flowering Plants" },
  { emoji: "🌸", name: "Crossandra / Kanakambara", category: "Flowering Plants" },
  { emoji: "🌸", name: "Tuberose / Rajnigandha", category: "Flowering Plants" },
  { emoji: "🌳", name: "Teak / Sagwan", category: "Trees & Timber" },
  { emoji: "🌳", name: "Eucalyptus", category: "Trees & Timber" },
  { emoji: "🌲", name: "Silver Oak", category: "Trees & Timber" },
  { emoji: "🎋", name: "Bamboo", category: "Trees & Timber" },
  { emoji: "🌴", name: "Areca Palm", category: "Trees & Timber" },
  { emoji: "🌴", name: "Royal Palm", category: "Trees & Timber" },
  { emoji: "🌿", name: "Neem", category: "Trees & Timber" },
  { emoji: "🌳", name: "Casuarina", category: "Trees & Timber" },
  { emoji: "🌳", name: "Pongamia / Honge", category: "Trees & Timber" },
  { emoji: "🌳", name: "Mahogany", category: "Trees & Timber" },
  { emoji: "🌿", name: "Tulsi / Holy Basil", category: "Herbs & Spices" },
  { emoji: "🍃", name: "Curry Leaf / Kadi Patta", category: "Herbs & Spices" },
  { emoji: "🫚", name: "Ginger / Adrak", category: "Herbs & Spices" },
  { emoji: "🟡", name: "Turmeric / Haldi", category: "Herbs & Spices" },
  { emoji: "🌿", name: "Lemongrass", category: "Herbs & Spices" },
  { emoji: "🌿", name: "Mint / Pudina", category: "Herbs & Spices" },
  { emoji: "⬛", name: "Pepper / Kali Mirch", category: "Herbs & Spices" },
  { emoji: "🟢", name: "Cardamom / Elaichi", category: "Herbs & Spices" },
  { emoji: "☕", name: "Coffee", category: "Herbs & Spices" },
  { emoji: "🍵", name: "Tea / Chai", category: "Herbs & Spices" },
  { emoji: "🌿", name: "Aloe Vera", category: "Medicinal Plants" },
  { emoji: "🌿", name: "Ashwagandha", category: "Medicinal Plants" },
  { emoji: "🌿", name: "Brahmi", category: "Medicinal Plants" },
  { emoji: "🌿", name: "Giloy / Guduchi", category: "Medicinal Plants" },
  { emoji: "🌿", name: "Stevia", category: "Medicinal Plants" },
  { emoji: "🌿", name: "Shatavari", category: "Medicinal Plants" },
  { emoji: "🌿", name: "Kalmegh / Chirata", category: "Medicinal Plants" },
  { emoji: "🪴", name: "Money Plant", category: "Indoor Plants" },
  { emoji: "🪴", name: "Snake Plant", category: "Indoor Plants" },
  { emoji: "🪴", name: "Peace Lily", category: "Indoor Plants" },
  { emoji: "🪴", name: "Pothos / Devil's Ivy", category: "Indoor Plants" },
  { emoji: "🪴", name: "ZZ Plant", category: "Indoor Plants" },
  { emoji: "🌵", name: "Cactus / Succulent", category: "Indoor Plants" },
  { emoji: "🪴", name: "Croton", category: "Indoor Plants" },
];

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
        />
      ))}
    </div>
  );
}

function ListingCard({
  listing, onVendorTap, onContact
}: {
  listing: NurseryListing;
  onVendorTap?: () => void;
  onContact: () => void;
}) {
  const emoji = CAT_EMOJIS[listing.category] ?? "🌱";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex gap-3">
      <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 text-2xl">
        {listing.photoUrl ? (
          <img src={listing.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
        ) : (
          emoji
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm leading-tight">{listing.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-tight line-clamp-1">{listing.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold text-primary">{fmtMoney(Number(listing.price))}</span>
          <span className="text-xs text-gray-400">/ {listing.unit}</span>
          {listing.qtyAvailable > 0 && (
            <span className="text-xs text-blue-600 font-medium">{listing.qtyAvailable} avail.</span>
          )}
        </div>
        {onVendorTap ? (
          <button onClick={onVendorTap} className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 hover:text-primary">
            <Store className="h-2.5 w-2.5" />{listing.vendorName} · {listing.vendorLocation}
          </button>
        ) : (
          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />{listing.vendorLocation}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 self-center flex flex-col gap-1.5">
        <a
          href={`tel:${listing.vendorPhone}`}
          className="bg-primary text-primary-foreground text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1 justify-center"
          onClick={e => e.stopPropagation()}
        >
          <Phone className="h-3 w-3" /> Call
        </a>
        <p className="text-[9px] text-gray-400 text-center truncate max-w-[56px]">{listing.vendorPhone}</p>
      </div>
    </div>
  );
}

function VendorDetail({ vendor, onBack, onContact }: {
  vendor: NurseryVendor;
  onBack: () => void;
  onContact: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: detail, isLoading } = useQuery<NurseryVendor & { listings: NurseryListing[]; ratings: NurseryRating[] }>({
    queryKey: ["nursery-vendor-detail", vendor.id],
    queryFn: () => apiFetch(`/nursery/vendors/${vendor.id}`),
  });

  const submitRating = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiMutate("POST", `/nursery/vendors/${vendor.id}/ratings`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nursery-vendor-detail", vendor.id] });
      qc.invalidateQueries({ queryKey: ["nursery-vendors"] });
      setMyRating(0);
      setComment("");
      toast({ title: "Thanks for your rating! ⭐" });
    },
    onError: () => toast({ title: "Could not submit rating", variant: "destructive" }),
  });

  const listings = detail?.listings ?? [];
  const ratings = detail?.ratings ?? [];
  const avgRating = detail?.avgRating ?? vendor.avgRating ?? 0;
  const ratingCount = detail?.ratingCount ?? vendor.ratingCount ?? 0;

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-primary font-semibold"
      >
        <ArrowLeft className="h-4 w-4" /> All Vendors
      </button>
      <div className="bg-gradient-to-br from-primary to-violet-700 rounded-2xl p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
              {vendor.photoUrl ? (
                <img src={vendor.photoUrl} alt={vendor.name} className="w-full h-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-primary-foreground/80" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg leading-tight">{vendor.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <StarRating value={avgRating} size={13} />
                <span className="text-primary-foreground/80 text-xs">
                  {ratingCount > 0 ? `${avgRating} (${ratingCount})` : "No ratings yet"}
                </span>
              </div>
              {vendor.speciality && (
                <p className="text-primary-foreground/80 text-xs mt-1">🌿 {vendor.speciality}</p>
              )}
              <p className="text-primary-foreground/80 text-xs flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />{vendor.location}
              </p>
            </div>
          </div>
          <button
            onClick={onContact}
            className="bg-white text-primary rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
          >
            <Phone className="h-3.5 w-3.5" /> Contact
          </button>
        </div>
        {vendor.description && (
          <p className="text-primary-foreground/80 text-xs mt-3 leading-relaxed">{vendor.description}</p>
        )}
      </div>

      {/* Rate this vendor */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-800 mb-2">Rate this nursery</p>
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => setMyRating(i)} type="button">
              <Star
                className={`h-7 w-7 ${i <= myRating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Share your experience (optional)"
          className="min-h-[56px] text-sm"
        />
        <Button
          onClick={() => submitRating.mutate({ rating: myRating, comment: comment || undefined })}
          disabled={myRating === 0 || submitRating.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-10 font-bold mt-2 text-sm"
        >
          {submitRating.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Rating"}
        </Button>
      </div>

      {ratings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Reviews ({ratings.length})</p>
          {ratings.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <StarRating value={r.rating} size={12} />
              {r.comment && <p className="text-sm text-gray-700 mt-1.5">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Sprout className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No plants listed yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">{listings.length} plants available</p>
          {listings.map(l => (
            <ListingCard key={l.id} listing={l} onContact={onContact} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactModal({ vendor, onClose }: { vendor: NurseryVendor; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl p-6 w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">{vendor.name}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{vendor.location}</p>
        <a
          href={`tel:${vendor.phone}`}
          className="flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-2xl py-4 font-bold text-base w-full"
        >
          <Phone className="h-5 w-5" /> Call {vendor.phone}
        </a>
        {vendor.whatsapp && (
          <a
            href={`https://wa.me/91${vendor.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-3 bg-[#25D366] text-white rounded-2xl py-4 font-bold text-base w-full"
          >
            <span className="text-xl">💬</span> WhatsApp {vendor.whatsapp}
          </a>
        )}
        <p className="text-xs text-center text-gray-400">Tell them you found them on Chiguru app</p>
      </div>
    </div>
  );
}

function BrowsePlants({ onContactVendor }: { onContactVendor: (v: NurseryVendor) => void }) {
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<NurseryVendor | null>(null);
  useSubScreenHistory(selectedVendor ? 1 : 0, () => setSelectedVendor(null));

  const { data: vendors = [], isLoading: vendorLoading } = useQuery<NurseryVendor[]>({
    queryKey: ["nursery-vendors"],
    queryFn: () => apiFetch("/nursery/vendors"),
  });

  const { data: listings = [], isLoading: listingLoading } = useQuery<NurseryListing[]>({
    queryKey: ["nursery-listings", catFilter, selectedVendor?.id],
    queryFn: () => {
      const params = new URLSearchParams();
      if (catFilter !== "All") params.set("category", catFilter);
      if (selectedVendor) params.set("vendorId", String(selectedVendor.id));
      return apiFetch(`/nursery/listings?${params}`);
    },
  });

  const filtered = useMemo(() => {
    if (!search) return listings;
    const q = search.toLowerCase();
    return listings.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.vendorName.toLowerCase().includes(q)
    );
  }, [listings, search]);

  if (selectedVendor) {
    return (
      <VendorDetail
        vendor={selectedVendor}
        onBack={() => setSelectedVendor(null)}
        onContact={() => onContactVendor(selectedVendor)}
      />
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search plants, trees, seedlings…"
          className="pl-9"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        {NURSERY_CATS.map(c => (
          <button
            key={c.key}
            onClick={() => setCatFilter(c.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-full font-medium border transition-colors ${
              catFilter === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            <span>{c.emoji}</span>{c.label}
          </button>
        ))}
      </div>
      {catFilter === "All" && !search && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">🏪 Nursery Vendors</p>
          {vendorLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : vendors.length === 0 ? (
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 text-center">
              <Sprout className="h-8 w-8 mx-auto mb-2 text-primary/30" />
              <p className="text-sm text-primary font-medium">No vendors yet</p>
              <p className="text-xs text-primary mt-0.5">Be the first to register your nursery!</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
              {vendors.map((v, idx) => {
                const isTopRated = idx === 0 && (v.ratingCount ?? 0) > 0 && (v.avgRating ?? 0) >= 4;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendor(v)}
                    className="flex-shrink-0 w-40 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-left active:bg-gray-50 relative"
                  >
                    {isTopRated && (
                      <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Star className="h-2 w-2 fill-amber-500 text-amber-500" /> TOP
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2 overflow-hidden">
                      {v.photoUrl ? (
                        <img src={v.photoUrl} alt={v.name} className="w-full h-full object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-tight truncate">{v.name}</p>
                    {(v.ratingCount ?? 0) > 0 ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <StarRating value={v.avgRating ?? 0} size={10} />
                        <span className="text-[9px] text-gray-400">({v.ratingCount})</span>
                      </div>
                    ) : (
                      <p className="text-[9px] text-gray-300 mt-0.5">No ratings yet</p>
                    )}
                    {v.speciality && <p className="text-[10px] text-primary mt-0.5 truncate">{v.speciality}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">📍 {v.location}</p>
                    <p className="text-xs text-primary font-semibold mt-1.5">{v.listingCount} plants</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {listingLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 && (catFilter !== "All" || search) ? (
        <div className="text-center py-12 text-gray-400">
          <Sprout className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No plants found</p>
        </div>
      ) : filtered.length > 0 ? (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">
            {catFilter !== "All" ? catFilter : "All Plants"} · {filtered.length} listed
          </p>
          <div className="space-y-2">
            {filtered.map(l => (
              <ListingCard
                key={l.id}
                listing={l}
                onVendorTap={() => {
                  const v = vendors.find(vv => vv.id === l.vendorId);
                  if (v) setSelectedVendor(v);
                }}
                onContact={() => {
                  const v = vendors.find(vv => vv.id === l.vendorId);
                  if (v) onContactVendor(v);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface VendorForm {
  name: string; phone: string; whatsapp: string;
  location: string; description: string; speciality: string;
}
interface ListingForm {
  name: string; category: string; price: string; unit: string;
  qtyAvailable: string; description: string; photoUrl: string;
}

function MyShop() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const returnToMyAds = () => {
    if (canGoBack()) window.history.back();
    else navigate("/my-ads", { replace: true });
  };
  const { data: appSettings } = useQuery<{ canSell: boolean }>({
    queryKey: ["app-settings"],
    queryFn: () => apiFetch("/app-settings"),
  });
  const canSell = !!appSettings?.canSell;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const shopPhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [shopPhoto, setShopPhoto] = useState<string>("");
  const [myVendorId, setMyVendorId] = useState<number | null>(() => {
    const v = localStorage.getItem("nursery_vendor_id");
    return v ? Number(v) : null;
  });
  // Reached only from My Ads → "Sell plants". If the shop is already
  // registered, open the add-plant form straight away so the user lands on a
  // form (not the shop dashboard behind it).
  const [showListingForm, setShowListingForm] = useState(myVendorId != null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPhotoPreview(url);
      setLVal("photoUrl", url);
    };
    reader.readAsDataURL(file);
  }

  function handleShopPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShopPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  const { data: vendor, isLoading: vendorLoading } = useQuery<NurseryVendor & { listings: NurseryListing[] }>({
    queryKey: ["my-nursery-vendor", myVendorId],
    queryFn: () => apiFetch(`/nursery/vendors/${myVendorId}`),
    enabled: myVendorId != null,
  });

  const { register: regVendor, handleSubmit: hvSubmit, formState: { errors: ve } } = useForm<VendorForm>();
  const { register: regListing, handleSubmit: hlSubmit, setValue: setLVal, watch: watchL, reset: resetListing, formState: { errors: le } } = useForm<ListingForm>({
    defaultValues: { category: "Vegetable Seedlings", unit: "plant" }
  });

  const registerVendor = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/nursery/vendors", data),
    onSuccess: (row: NurseryVendor) => {
      localStorage.setItem("nursery_vendor_id", String(row.id));
      setMyVendorId(row.id);
      qc.invalidateQueries({ queryKey: ["nursery-vendors"] });
      // Go straight into the add-plant form after the shop is created.
      setShowListingForm(true);
      toast({ title: "🌿 Shop registered! Now add your plants." });
    },
    onError: () => toast({ title: "Error registering shop", variant: "destructive" }),
  });

  const addListing = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/nursery/listings", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-nursery-vendor", myVendorId] });
      qc.invalidateQueries({ queryKey: ["nursery-listings"] });
      setShowListingForm(false);
      resetListing();
      setPhotoPreview("");
      toast({ title: "Plant listing added ✓" });
    },
    onError: () => toast({ title: "Error adding listing", variant: "destructive" }),
  });

  const deleteListing = useMutation({
    mutationFn: (id: number) =>
      apiMutate("DELETE", `/nursery/listings/${id}`, { ownerKey: getOwnerKey() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-nursery-vendor", myVendorId] });
      qc.invalidateQueries({ queryKey: ["nursery-listings"] });
      toast({ title: "Listing removed" });
    },
  });

  function onRegisterVendor(data: VendorForm) {
    if (!shopPhoto) {
      toast({ title: "Please add a photo of the plants you're selling", variant: "destructive" });
      return;
    }
    registerVendor.mutate({
      name: data.name, phone: data.phone,
      whatsapp: data.whatsapp || undefined,
      location: data.location,
      description: data.description || undefined,
      speciality: data.speciality || undefined,
      photoUrl: shopPhoto,
      // Per-device secret so only this device can manage the shop's listings.
      ownerKey: getOwnerKey(),
    });
  }

  function onAddListing(data: ListingForm) {
    addListing.mutate({
      vendorId: myVendorId,
      name: data.name,
      category: data.category,
      price: parseFloat(data.price),
      unit: data.unit,
      qtyAvailable: parseInt(data.qtyAvailable) || 0,
      description: data.description || undefined,
      photoUrl: data.photoUrl || undefined,
    });
  }

  if (!canSell) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="bg-white w-full max-w-md mx-auto min-h-full p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={returnToMyAds} className="p-1 -ml-1 text-gray-600" aria-label="Back">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h3 className="text-lg font-bold text-gray-800">Open My Shop</h3>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <p className="font-bold text-amber-900">Unlock selling to open your shop</p>
            <p className="text-sm text-amber-700 mt-1">
              To open your own nursery shop and sell, get the Farmer plan.
            </p>
            <Link href="/subscription" className="inline-block mt-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-11 leading-[44px] font-bold">
              See plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!myVendorId) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="bg-white w-full max-w-md mx-auto min-h-full p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={returnToMyAds} className="p-1 -ml-1 text-gray-600" aria-label="Back">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h3 className="text-lg font-bold text-gray-800">Register Your Shop</h3>
          </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">Photo of plants you're selling *</Label>
            <input
              ref={shopPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleShopPhotoChange}
            />
            <button
              type="button"
              onClick={() => shopPhotoInputRef.current?.click()}
              className="mt-1 w-full h-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50"
            >
              {shopPhoto ? (
                <img src={shopPhoto} alt="Shop preview" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center text-gray-400 text-xs">
                  <ImageIcon className="h-7 w-7 mb-1" />
                  Tap to add a photo of the plants you're selling
                </span>
              )}
            </button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Shop / Nursery name *</Label>
            <Input {...regVendor("name", { required: true })} placeholder="e.g. Raju's Green Nursery" className="mt-1" />
            {ve.name && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Phone *</Label>
              <Input {...regVendor("phone", { required: true })} type="tel" placeholder="9876543210" className="mt-1" />
              {ve.phone && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-500">WhatsApp</Label>
              <Input {...regVendor("whatsapp")} type="tel" placeholder="Same as phone?" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Location / Village *</Label>
            <Input {...regVendor("location", { required: true })} placeholder="e.g. Sira, Tumkur Dist." className="mt-1" />
            {ve.location && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-500">Speciality</Label>
            <Input {...regVendor("speciality")} placeholder="e.g. Coffee seedlings, Mango saplings" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">About your nursery</Label>
            <Textarea {...regVendor("description")} placeholder="Years of experience, what you grow..." className="mt-1 min-h-[60px]" />
          </div>
          <Button
            onClick={hvSubmit(onRegisterVendor)}
            disabled={registerVendor.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 font-bold"
          >
            {registerVendor.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🌿 Open My Shop"}
          </Button>
        </div>
        </div>
      </div>
    );
  }

  if (vendorLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const status = vendor?.status ?? "pending";
  const isPending = status === "pending";
  const isSuspended = status === "suspended";

  return (
    <div className="p-4 space-y-4">
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Waiting for approval</p>
            <p className="text-xs text-amber-600 mt-0.5">Your shop is under review. You'll be visible to farmers once approved.</p>
          </div>
        </div>
      )}
      {isSuspended && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Shop suspended</p>
            <p className="text-xs text-red-600 mt-0.5">Your shop is currently not visible. Please contact the administrator.</p>
          </div>
        </div>
      )}
      {!isPending && !isSuspended && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-primary">Your shop is live — farmers can see and contact you</p>
        </div>
      )}
      <div className="bg-primary rounded-2xl p-4 text-primary-foreground flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-4 w-4 text-primary-foreground/80" />
            <p className="font-bold text-lg">{vendor?.name}</p>
          </div>
          {vendor?.speciality && <p className="text-primary-foreground/80 text-xs">{vendor.speciality}</p>}
          <p className="text-primary-foreground/80 text-xs mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" />{vendor?.location}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{vendor?.listings?.length ?? 0}</p>
          <p className="text-primary-foreground/80 text-xs">listings</p>
        </div>
      </div>
      <button
        onClick={() => setShowListingForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-primary/30 rounded-2xl py-4 text-primary font-semibold active:bg-primary/5"
      >
        <Plus className="h-5 w-5" /> Add Plant Listing
      </button>
      {(vendor?.listings?.length ?? 0) === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Sprout className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No listings yet</p>
          <p className="text-xs mt-1 text-gray-300">Tap above to add your first plant</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Your listings</p>
          {vendor?.listings.map(l => {
            const emoji = CAT_EMOJIS[l.category] ?? "🌱";
            return (
              <div key={l.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-2xl flex-shrink-0">
                  {l.photoUrl
                    ? <img src={l.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                    : emoji
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{l.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.category}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-primary">{fmtMoney(Number(l.price))}</span>
                    <span className="text-xs text-gray-400">/ {l.unit}</span>
                    {l.qtyAvailable > 0 && (
                      <span className="text-xs text-blue-600">{l.qtyAvailable} avail.</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteListing.mutate(l.id)}
                  className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showListingForm && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="bg-white w-full max-w-md mx-auto min-h-full p-5 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowListingForm(false); setPhotoPreview(""); resetListing(); }} className="p-1 -ml-1 text-gray-600" aria-label="Back">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h2 className="text-lg font-bold text-gray-800">Add Plant Listing</h2>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Plant Photo</Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="mt-1 w-full h-32 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-2 active:bg-primary/10"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Plant preview" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <>
                    <Camera className="h-7 w-7 text-primary" />
                    <span className="text-xs text-primary font-medium">Tap to add photo</span>
                    <span className="text-[10px] text-primary">Camera or gallery</span>
                  </>
                )}
              </button>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Plant / Seedling name *</Label>
              <Input {...regListing("name", { required: true })} placeholder="e.g. Arabica Coffee Seedling" className="mt-1" />
              {le.name && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-500">Category *</Label>
              <SelectOrType
                options={NURSERY_CATS.filter(c => c.key !== "All").map(c => c.key)}
                labels={Object.fromEntries(NURSERY_CATS.filter(c => c.key !== "All").map(c => [c.key, `${c.emoji} ${c.label}`]))}
                value={watchL("category") || ""}
                onChange={(v) => setLVal("category", v)}
                typePlaceholder="Type category…"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs text-gray-500">Price ({curSymbol()}) *</Label>
                <Input {...regListing("price", { required: true })} type="number" placeholder="25" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Per</Label>
                <SelectOrType
                  options={["plant","sapling","kg","bundle","dozen","100 plants","tray"]}
                  value={watchL("unit") || ""}
                  onChange={(v) => setLVal("unit", v)}
                  typePlaceholder="Type unit…"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Qty available</Label>
              <Input {...regListing("qtyAvailable")} type="number" placeholder="50" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Description</Label>
              <Textarea {...regListing("description")} placeholder="Age, variety, growing conditions…" className="mt-1 min-h-[60px]" />
            </div>
            <Button
              onClick={hlSubmit(onAddListing)}
              disabled={addListing.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 font-bold"
            >
              {addListing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🌿 Post Listing"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NurseryShop() {
  // The "My Shop" seller flow is only reached from My Ads → "Sell plants"
  // (?tab=myshop). The nursery page itself is browse-only — no tabs.
  const myShopMode = new URLSearchParams(window.location.search).get("tab") === "myshop";
  const [contactVendor, setContactVendor] = useState<NurseryVendor | null>(null);

  if (myShopMode) {
    return (
      <PageShell title="Nursery Shop" back="/my-ads">
        <MyShop />
      </PageShell>
    );
  }

  return (
    <PageShell title="Nursery Shop" back="/">
      <BrowsePlants onContactVendor={setContactVendor} />
      {contactVendor && (
        <ContactModal vendor={contactVendor} onClose={() => setContactVendor(null)} />
      )}
    </PageShell>
  );
}
