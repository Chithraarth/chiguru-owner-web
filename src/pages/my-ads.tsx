import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Megaphone, Trash2, MapPin, Tag, Pencil } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getOwnerKey, type HireListing } from "@/pages/workers";
import { useT } from "@/lib/i18n";
import { fmtMoney, curSymbol } from "@/lib/currency";

// Everything posted from this device across all the ad boards — Hire (worker
// requirements + machine rentals), Marketplace (produce for sale), Equipment
// (for sale) and the user's own nursery listings — so the poster can review
// and delete anything that's fulfilled or sold. Reached from the hamburger
// menu; ownership is proven by the per-device owner key (nursery listings by
// the locally-stored vendor id).

type ProduceAd = {
  id: number;
  productName: string;
  price: string;
  unit: string;
  quantity: string | null;
  location: string;
  photoUrl: string | null;
  mine?: boolean;
};

type EquipmentAd = {
  id: number;
  title: string;
  price: string;
  condition: string;
  location: string;
  photoUrl: string | null;
  mine?: boolean;
};

type NurseryProduct = {
  id: number;
  name: string;
  category: string;
  price: string;
  unit: string;
  photoUrl: string | null;
};

type NurseryVendor = {
  id: number;
  name: string;
  listings?: NurseryProduct[];
};

// One compact card used for produce / equipment / nursery ads, with the
// same tap-twice delete confirm pattern as the Hire board cards.
function MyAdCard({
  photoUrl,
  title,
  subtitle,
  location,
  onDelete,
  onEdit,
  deleting,
}: {
  photoUrl: string | null;
  title: string;
  subtitle: string;
  location?: string;
  onDelete: () => void;
  onEdit?: () => void;
  deleting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Tag className="w-5 h-5 text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{title}</p>
        <p className="text-xs text-primary font-semibold">{subtitle}</p>
        {location && (
          <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" /> {location}
          </p>
        )}
      </div>
      {confirming ? (
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-xs font-semibold bg-red-600 text-white rounded-full px-3 py-1.5 disabled:opacity-50"
          >
            Yes, delete
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-gray-500 rounded-full px-3 py-1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"
              aria-label="Edit ad"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setConfirming(true)}
            className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center"
            aria-label="Delete ad"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

// The 5 posting options shown directly on the My Ads front page as five
// columns — tapping one routes to the right board with its sell form opened
// automatically. No extra "Post an ad" step in between.
function PostAdColumns() {
  const { t } = useT();
  const [, navigate] = useLocation();
  const options = [
    { emoji: "🚛", label: t("myAds.postMachine"), to: "/workers?post=rental", bg: "bg-muted border-muted-foreground/20" },
    { emoji: "👷", label: t("myAds.postWorker"), to: "/workers?post=job", bg: "bg-accent border-accent/20" },
    { emoji: "🧺", label: t("myAds.sellProduce"), to: "/marketplace?sell=1", bg: "bg-primary/5 border-primary/20" },
    { emoji: "🚜", label: t("myAds.sellEquipment"), to: "/equipment?sell=1", bg: "bg-secondary border-secondary/20" },
    { emoji: "🌱", label: t("myAds.sellPlants"), to: "/nursery?tab=myshop", bg: "bg-primary/10 border-primary/20" },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-700 text-center">{t("myAds.chooseType")}</h3>
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((o) => (
          <button
            key={o.to}
            onClick={() => navigate(o.to)}
            className={`flex flex-col items-center gap-1 rounded-2xl border ${o.bg} px-1 py-2.5 active:scale-95 transition`}
          >
            <span className="text-2xl leading-none">{o.emoji}</span>
            <span className="text-[10px] leading-tight font-semibold text-gray-700 text-center break-words w-full">
              {o.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MyAds() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const ownerKey = getOwnerKey();
  const ownerHeaders = ownerKey ? { headers: { "X-Owner-Key": ownerKey } } : undefined;
  const myNurseryVendorId = (() => {
    const v = Number(localStorage.getItem("nursery_vendor_id"));
    return Number.isFinite(v) && v > 0 ? v : null;
  })();

  const { data: hireAds = [], isLoading: hireLoading } = useQuery<HireListing[]>({
    queryKey: ["hire-listings", "mine"],
    queryFn: () => apiFetch("/hire-listings?mine=1", ownerHeaders),
  });

  const { data: produceAds = [], isLoading: produceLoading } = useQuery<ProduceAd[]>({
    queryKey: ["produce-listings", "mine"],
    queryFn: () => apiFetch("/produce-listings?mine=1", ownerHeaders),
  });

  const { data: equipmentAds = [], isLoading: equipmentLoading } = useQuery<EquipmentAd[]>({
    queryKey: ["equipment-listings", "mine"],
    queryFn: () => apiFetch("/equipment-listings?mine=1", ownerHeaders),
  });

  const { data: myNurseryVendor } = useQuery<NurseryVendor>({
    queryKey: ["my-nursery-vendor", myNurseryVendorId],
    queryFn: () => apiFetch(`/nursery/vendors/${myNurseryVendorId}`),
    enabled: myNurseryVendorId != null,
  });
  const nurseryProducts = myNurseryVendor?.listings ?? [];

  const deleteHire = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/hire-listings/${id}`, { ownerKey }),
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

  const deleteProduce = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/produce-listings/${id}`, { ownerKey }),
    onSuccess: (res) => {
      toast(
        res !== null || navigator.onLine
          ? { title: "Ad deleted", description: "Your ad has been removed." }
          : { title: "Saved offline", description: "Your ad will be removed when you're back online." },
      );
      qc.invalidateQueries({ queryKey: ["produce-listings"] });
    },
    onError: () => toast({ title: "Could not delete ad", variant: "destructive" }),
  });

  const deleteEquipment = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/equipment-listings/${id}`, { ownerKey }),
    onSuccess: (res) => {
      toast(
        res !== null || navigator.onLine
          ? { title: "Ad deleted", description: "Your ad has been removed." }
          : { title: "Saved offline", description: "Your ad will be removed when you're back online." },
      );
      qc.invalidateQueries({ queryKey: ["equipment-listings"] });
    },
    onError: () => toast({ title: "Could not delete ad", variant: "destructive" }),
  });

  const deleteNurseryProduct = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/nursery/listings/${id}`, { ownerKey }),
    onSuccess: () => {
      toast({ title: "Listing removed" });
      qc.invalidateQueries({ queryKey: ["my-nursery-vendor", myNurseryVendorId] });
      qc.invalidateQueries({ queryKey: ["nursery-listings"] });
    },
    onError: () => toast({ title: "Could not remove listing", variant: "destructive" }),
  });

  const rentals = hireAds.filter((l) => l.listingType === "rental");
  const jobs = hireAds.filter((l) => l.listingType === "job");

  const isLoading = hireLoading || produceLoading || equipmentLoading;
  const total = hireAds.length + produceAds.length + equipmentAds.length + nurseryProducts.length;

  return (
    <PageShell title={t("menu.myAds")} back="/">
      <div className="p-4 space-y-4 pb-24">
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">{t("menu.myAds")}</h2>
              <p className="text-sm text-white/85">{t("myAds.subtitle")}</p>
            </div>
          </div>
        </div>

        <PostAdColumns />

        {isLoading ? (
          <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
        ) : total === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("myAds.empty")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {jobs.length > 0 && (
              <Section title={`👷 ${t("myAds.workerAds")}`}>
                {jobs.map((l) => (
                  <MyAdCard
                    key={l.id}
                    photoUrl={l.photoUrl ?? null}
                    title={l.title}
                    subtitle={[l.rate ? `${fmtMoney(l.rate)}` : null, l.workersNeeded ? `${l.workersNeeded} needed` : null]
                      .filter(Boolean)
                      .join(" · ") || "Worker needed"}
                    location={[l.village, l.taluk, l.district].filter(Boolean).join(", ")}
                    onDelete={() => deleteHire.mutate(l.id)}
                    onEdit={() => navigate(`/workers?edit=${l.id}`)}
                    deleting={deleteHire.isPending}
                  />
                ))}
              </Section>
            )}
            {rentals.length > 0 && (
              <Section title={`🚛 ${t("myAds.machineAds")}`}>
                {rentals.map((l) => (
                  <MyAdCard
                    key={l.id}
                    photoUrl={l.photoUrl ?? null}
                    title={l.title}
                    subtitle={l.rate ? `${fmtMoney(l.rate)}` : "Machine for rent"}
                    location={[l.village, l.taluk, l.district].filter(Boolean).join(", ")}
                    onDelete={() => deleteHire.mutate(l.id)}
                    onEdit={() => navigate(`/workers?edit=${l.id}`)}
                    deleting={deleteHire.isPending}
                  />
                ))}
              </Section>
            )}
            {produceAds.length > 0 && (
              <Section title={`🧺 ${t("myAds.produceAds")}`}>
                {produceAds.map((l) => (
                  <MyAdCard
                    key={l.id}
                    photoUrl={l.photoUrl}
                    title={l.productName}
                    subtitle={`${fmtMoney(l.price)} / ${l.unit}${l.quantity ? ` · ${l.quantity}` : ""}`}
                    location={l.location}
                    onDelete={() => deleteProduce.mutate(l.id)}
                    deleting={deleteProduce.isPending}
                  />
                ))}
              </Section>
            )}
            {equipmentAds.length > 0 && (
              <Section title={`🚜 ${t("myAds.equipmentAds")}`}>
                {equipmentAds.map((l) => (
                  <MyAdCard
                    key={l.id}
                    photoUrl={l.photoUrl}
                    title={l.title}
                    subtitle={`${fmtMoney(l.price)} · ${l.condition === "new" ? "New" : "Used"}`}
                    location={l.location}
                    onDelete={() => deleteEquipment.mutate(l.id)}
                    deleting={deleteEquipment.isPending}
                  />
                ))}
              </Section>
            )}
            {nurseryProducts.length > 0 && (
              <Section title={`🌱 ${t("myAds.nurseryAds")}`}>
                {nurseryProducts.map((p) => (
                  <MyAdCard
                    key={p.id}
                    photoUrl={p.photoUrl}
                    title={p.name}
                    subtitle={`${fmtMoney(p.price)} / ${p.unit}`}
                    onDelete={() => deleteNurseryProduct.mutate(p.id)}
                    deleting={deleteNurseryProduct.isPending}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
