import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Store, Phone, MapPin, ChevronRight, ArrowLeft, Loader2,
  CheckCircle2, XCircle, Clock, Trash2, X, Sprout, AlertTriangle,
  Edit3, Eye, Package
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate } from "@/lib/api";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface NurseryListing {
  id: number; vendorId: number; name: string; category: string;
  price: string; unit: string; qtyAvailable: number;
  description?: string; isAvailable: boolean; createdAt: string;
}

interface NurseryVendor {
  id: number; name: string; phone: string; whatsapp?: string;
  location: string; description?: string; speciality?: string;
  status: string; adminNotes?: string; isActive: boolean;
  listingCount: number; createdAt: string;
  listings?: NurseryListing[];
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  icon: Clock },
  approved:  { label: "Approved",  bg: "bg-primary/5",  text: "text-primary",  border: "border-primary/20",  icon: CheckCircle2 },
  suspended: { label: "Suspended", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

// ── Vendor Detail view ────────────────────────────────────────────────────────

function VendorDetail({ vendorId, onBack }: { vendorId: number; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNotes, setShowNotes] = useState(false);
  const { register, handleSubmit, reset } = useForm<{ adminNotes: string }>();

  const { data: vendor, isLoading } = useQuery<NurseryVendor>({
    queryKey: ["nursery-vendor-detail", vendorId],
    queryFn: () => apiFetch(`/nursery/vendors/${vendorId}`),
  });

  const updateVendor = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiMutate("PATCH", `/nursery/vendors/${vendorId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nursery-vendors-all"] });
      qc.invalidateQueries({ queryKey: ["nursery-vendor-detail", vendorId] });
      toast({ title: "Vendor updated ✓" });
      setShowNotes(false);
      reset();
    },
  });

  const deleteListing = useMutation({
    mutationFn: (id: number) =>
      fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/nursery/listings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nursery-vendor-detail", vendorId] });
      qc.invalidateQueries({ queryKey: ["nursery-vendors-all"] });
      toast({ title: "Listing removed" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!vendor) return <div className="p-4 text-center text-gray-400">Vendor not found</div>;

  const cfg = STATUS_CONFIG[vendor.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-primary font-semibold">
        <ArrowLeft className="h-4 w-4" /> All Vendors
      </button>

      {/* Vendor card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-5 w-5 text-gray-500" />
              <p className="font-bold text-gray-900 text-lg">{vendor.name}</p>
            </div>
            {vendor.speciality && <p className="text-xs text-primary mb-1">🌿 {vendor.speciality}</p>}
            <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{vendor.location}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{vendor.phone}{vendor.whatsapp && ` · WA: ${vendor.whatsapp}`}</p>
          </div>
          <StatusBadge status={vendor.status} />
        </div>
        {vendor.description && <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-2">{vendor.description}</p>}
        {vendor.adminNotes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Admin notes</p>
            <p className="text-xs text-amber-600">{vendor.adminNotes}</p>
          </div>
        )}
        <p className="text-xs text-gray-400">Registered: {new Date(vendor.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {vendor.status !== "approved" && (
          <Button
            onClick={() => updateVendor.mutate({ status: "approved", isActive: true })}
            disabled={updateVendor.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-10 text-sm font-bold"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
          </Button>
        )}
        {vendor.status !== "suspended" && (
          <Button
            onClick={() => updateVendor.mutate({ status: "suspended", isActive: false })}
            disabled={updateVendor.isPending}
            variant="outline"
            className="border-red-200 text-red-600 rounded-xl h-10 text-sm font-bold hover:bg-red-50"
          >
            <XCircle className="h-4 w-4 mr-1.5" /> Suspend
          </Button>
        )}
        {vendor.status === "suspended" && (
          <Button
            onClick={() => updateVendor.mutate({ status: "approved", isActive: true })}
            disabled={updateVendor.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-10 text-sm font-bold"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Reactivate
          </Button>
        )}
        <Button
          onClick={() => setShowNotes(true)}
          variant="outline"
          className="border-gray-200 text-gray-600 rounded-xl h-10 text-sm font-semibold"
        >
          <Edit3 className="h-4 w-4 mr-1.5" /> Add Note
        </Button>
      </div>

      {/* Listings */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">
          Plant Listings ({vendor.listings?.length ?? 0})
        </p>
        {(vendor.listings?.length ?? 0) === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No listings yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vendor.listings?.map(l => (
              <div key={l.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{l.name}</p>
                  <p className="text-xs text-gray-400">{l.category} · {fmtMoney(Number(l.price))} / {l.unit}</p>
                  {l.qtyAvailable > 0 && <p className="text-xs text-blue-600">{l.qtyAvailable} available</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.isAvailable ? "bg-primary/5 text-primary" : "bg-gray-50 text-gray-400"}`}>
                    {l.isAvailable ? "Live" : "Hidden"}
                  </span>
                  <button onClick={() => deleteListing.mutate(l.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add note sheet */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Admin Note</h3>
              <button onClick={() => setShowNotes(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Note for this vendor</Label>
              <Textarea
                {...register("adminNotes")}
                defaultValue={vendor.adminNotes ?? ""}
                placeholder="e.g. Verified by phone call on 15 Jun 2026"
                className="mt-1 min-h-[80px]"
              />
            </div>
            <Button
              onClick={handleSubmit(data => updateVendor.mutate({ adminNotes: data.adminNotes }))}
              disabled={updateVendor.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11"
            >
              {updateVendor.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function NurseryAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "suspended">("all");
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  useSubScreenHistory(selectedVendorId ? 1 : 0, () => setSelectedVendorId(null));
  const [deleteConfirm, setDeleteConfirm] = useState<NurseryVendor | null>(null);

  const { data: vendors = [], isLoading } = useQuery<NurseryVendor[]>({
    queryKey: ["nursery-vendors-all"],
    queryFn: () => apiFetch("/nursery/vendors?all=true"),
  });

  const updateVendor = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiMutate("PATCH", `/nursery/vendors/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nursery-vendors-all"] });
      toast({ title: "Vendor updated ✓" });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: number) =>
      fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/nursery/vendors/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nursery-vendors-all"] });
      setDeleteConfirm(null);
      toast({ title: "Vendor removed" });
    },
  });

  if (selectedVendorId !== null) {
    return (
      <PageShell title="Vendor Details">
        <VendorDetail vendorId={selectedVendorId} onBack={() => setSelectedVendorId(null)} />
      </PageShell>
    );
  }

  const pending = vendors.filter(v => v.status === "pending");
  const approved = vendors.filter(v => v.status === "approved");
  const suspended = vendors.filter(v => v.status === "suspended");

  const displayed = filterStatus === "all" ? vendors
    : filterStatus === "pending" ? pending
    : filterStatus === "approved" ? approved
    : suspended;

  return (
    <PageShell title="Nursery Vendor Admin" back="/">
      <div className="p-4 space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{pending.length}</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">Pending</p>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{approved.length}</p>
            <p className="text-xs text-primary font-medium mt-0.5">Approved</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{suspended.length}</p>
            <p className="text-xs text-red-500 font-medium mt-0.5">Suspended</p>
          </div>
        </div>

        {/* Pending alert banner */}
        {pending.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">
                {pending.length} vendor{pending.length > 1 ? "s" : ""} waiting for approval
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Review and approve to make them visible to farmers</p>
            </div>
            <button
              onClick={() => setFilterStatus("pending")}
              className="text-xs font-bold text-amber-700 underline flex-shrink-0"
            >
              View
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {(["all", "pending", "approved", "suspended"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                filterStatus === s ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
              }`}
            >
              {s === "all" ? `All (${vendors.length})` : s === "pending" ? `Pending (${pending.length})` : s === "approved" ? `Active (${approved.length})` : `Suspended (${suspended.length})`}
            </button>
          ))}
        </div>

        {/* Vendor list */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Sprout className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No vendors {filterStatus !== "all" ? `with status "${filterStatus}"` : "registered yet"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-gray-900 truncate">{v.name}</p>
                        <StatusBadge status={v.status} />
                      </div>
                      {v.speciality && <p className="text-xs text-primary truncate">🌿 {v.speciality}</p>}
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />{v.location}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 flex-shrink-0" />{v.phone}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="text-lg font-bold text-primary">{v.listingCount}</p>
                      <p className="text-xs text-gray-400">listings</p>
                    </div>
                  </div>

                  {/* Quick action row */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                    {v.status === "pending" && (
                      <button
                        onClick={() => updateVendor.mutate({ id: v.id, data: { status: "approved", isActive: true } })}
                        className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {v.status === "approved" && (
                      <button
                        onClick={() => updateVendor.mutate({ id: v.id, data: { status: "suspended", isActive: false } })}
                        className="flex-1 bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Suspend
                      </button>
                    )}
                    {v.status === "suspended" && (
                      <button
                        onClick={() => updateVendor.mutate({ id: v.id, data: { status: "approved", isActive: true } })}
                        className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedVendorId(v.id)}
                      className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Shop
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(v)}
                      className="w-9 h-9 bg-red-50 border border-red-100 text-red-500 rounded-xl flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <p className="font-bold text-gray-900">Remove Vendor?</p>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-semibold">{deleteConfirm.name}</span> and all their listings will be permanently deleted.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl">Cancel</Button>
              <Button
                onClick={() => deleteVendor.mutate(deleteConfirm.id)}
                disabled={deleteVendor.isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              >
                {deleteVendor.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
