import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Camera, Video, X, Upload, CheckCircle2, WifiOff, Wifi,
  Plus, ChevronLeft, Loader2, Trash2, Image, Clock, RefreshCw, MapPin,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { compressForRecord } from "@/lib/photo";
import { apiFetch, apiUrl, apiMutate, estateHeaders } from "@/lib/api";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import {
  savePendingEstateUpdate,
  getPendingEstateUpdates,
  deletePendingEstateUpdate,
  flushEstateUpdates,
  newLocalId,
  fetchWithTimeout,
  looksLikeOurApi,
  cacheMedia,
  type PendingEstateUpdate,
} from "@/lib/offline-db";

interface WorkGroup { id: number; name: string; isActive?: boolean; category?: string | null }

// A "folder" in the Work Updates page: one per work group (created automatically
// from Work Attendance groups) plus a General folder for ungrouped updates.
interface UpdateFolder { id: number | null; name: string }

interface EstateUpdate {
  id: number;
  date: string;
  workerName: string | null;
  blockName: string | null;
  workGroupId: number | null;
  description: string;
  photoUrl: string | null;
  videoUrl: string | null;
  notes: string | null;
  attendanceCount: number | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
}

const TODAY = new Date().toISOString().split("T")[0];
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmtTime(iso: string) {
  // Full date + time so the recorded moment (server clock, not the phone's)
  // is visible under every update — devices can't fake this.
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Pending card ────────────────────────────────────────────────────────────

function PendingCard({ item, onDelete }: { item: PendingEstateUpdate; onDelete: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-3 items-start">
      {item.mediaDataUrl && item.mediaType === "photo" ? (
        <img src={item.mediaDataUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      ) : item.mediaType === "video" ? (
        <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Video className="h-6 w-6 text-amber-500" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Image className="h-6 w-6 text-amber-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <WifiOff className="h-3 w-3 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Saved offline · uploading when online</span>
        </div>
        <p className="text-sm font-medium text-gray-800 leading-snug">{item.description}</p>
        {item.blockName && <p className="text-xs text-gray-500 mt-0.5">📍 {item.blockName}</p>}
        <p className="text-xs text-gray-400 mt-0.5">{fmtTime(item.createdAt)}</p>
      </div>
      <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Synced card ─────────────────────────────────────────────────────────────

function SyncedCard({ item, groupName, onDelete }: { item: EstateUpdate; groupName?: string; onDelete: () => void }) {
  const [expand, setExpand] = useState(false);
  const isPhoto = item.photoUrl && item.photoUrl.startsWith("data:");
  const isVideo = item.videoUrl;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {isPhoto && (
        <img
          src={item.photoUrl!}
          alt="work update"
          className={`w-full object-cover ${expand ? "max-h-96" : "max-h-40"} cursor-pointer`}
          onClick={() => setExpand(e => !e)}
        />
      )}
      {isVideo && !isPhoto && (
        <div className="bg-gray-100 flex items-center justify-center h-32">
          <Video className="h-8 w-8 text-gray-400" />
          <span className="text-xs text-gray-500 ml-2">Video captured</span>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-snug">{item.description}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {item.blockName && <span className="text-xs text-gray-500">📍 {item.blockName}</span>}
              {item.workerName && <span className="text-xs text-gray-500">👤 {item.workerName}</span>}
              {groupName && <span className="text-xs text-blue-600">👥 {groupName}</span>}
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />{fmtTime(item.createdAt)}
              </span>
              {item.latitude && item.longitude && (
                <a
                  href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 font-medium flex items-center gap-0.5 hover:underline"
                >
                  <MapPin className="h-3 w-3" /> View on map
                </a>
              )}
            </div>
            {item.attendanceCount != null && (
              <div className="inline-flex items-center gap-1.5 mt-1.5 bg-primary/5 border border-primary/20 rounded-full px-2.5 py-0.5">
                <span className="text-sm">🧑‍🌾</span>
                <span className="text-xs font-bold text-primary">{item.attendanceCount} workers present</span>
              </div>
            )}
            {item.notes && <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add form sheet ───────────────────────────────────────────────────────────

function AddUpdateForm({ folder, onClose, onSaved }: { folder: UpdateFolder; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [blockName, setBlockName] = useState("");
  const [mediaDataUrl, setMediaDataUrl] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<"photo" | "video" | undefined>();
  const [saving, setSaving] = useState(false);

  // AI attendance
  const [aiCounting, setAiCounting] = useState(false);
  const [attendanceCount, setAttendanceCount] = useState<string>("");
  const [aiDescription, setAiDescription] = useState<string>("");
  const [aiDone, setAiDone] = useState(false);

  // Best-effort GPS tag (device hardware — works offline); a denial is non-fatal.
  const [geo, setGeo] = useState<{ latitude?: string; longitude?: string }>({});
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }),
      () => setGeo({}),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const isOnline = navigator.onLine;

  async function runAiCount(dataUrl: string) {
    if (!navigator.onLine) return;
    setAiCounting(true);
    setAiDone(false);
    setAttendanceCount("");
    setAiDescription("");
    try {
      const res = await fetch(apiUrl("/estate-updates/count-workers"), {
        method: "POST",
        headers: await estateHeaders(),
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setAttendanceCount(String(data.count ?? 0));
        setAiDescription(data.description ?? "");
        setAiDone(true);
      }
    } catch {
      // silently ignore — user can fill manually
    } finally {
      setAiCounting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "video") {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      if (type === "photo") {
        const compressed = await compressForRecord(raw);
        setMediaDataUrl(compressed);
        setMediaType("photo");
        runAiCount(compressed);
      } else {
        setMediaDataUrl(raw);
        setMediaType("video");
      }
    };
    reader.readAsDataURL(file);
  }

  function clearMedia() {
    setMediaDataUrl(undefined);
    setMediaType(undefined);
    setAiCounting(false);
    setAiDone(false);
    setAttendanceCount("");
    setAiDescription("");
  }

  async function handleSubmit() {
    if (!description.trim()) {
      toast({ title: "Please describe the work done", variant: "destructive" });
      return;
    }
    setSaving(true);
    const parsedCount = attendanceCount !== "" ? parseInt(attendanceCount, 10) : undefined;
    // One stable id for this submit: it's the offline-queue key AND the server
    // idempotency key, so a retried/lost-response POST can't create a duplicate.
    const clientId = newLocalId();
    const payload = {
      date: TODAY,
      workerName: "",
      blockName: blockName.trim(),
      workGroupId: folder.id ?? undefined,
      description: description.trim(),
      mediaDataUrl,
      mediaType,
      notes: "",
      attendanceCount: isNaN(parsedCount as number) ? undefined : parsedCount,
      latitude: geo.latitude,
      longitude: geo.longitude,
    };

    // Keep a local copy for fast offline viewing; old copies are pruned later. The
    // server/queue holds the real record, so this never risks losing data.
    if (mediaDataUrl && mediaType) {
      void cacheMedia("workUpdate", mediaType, mediaDataUrl);
    }

    if (!isOnline) {
      await savePendingEstateUpdate(payload, clientId);
      toast({ title: "Saved offline ✓", description: "Will upload automatically when internet returns" });
      onSaved();
      return;
    }

    // A photo/video is a large base64 body, so give media a longer budget than a
    // plain text update before we abort and fall back to the offline queue.
    const submitTimeoutMs = mediaDataUrl ? 60_000 : 20_000;
    try {
      const res = await fetchWithTimeout(
        apiUrl("/estate-updates"),
        {
          method: "POST",
          headers: await estateHeaders(),
          body: JSON.stringify({
            clientId,
            date: payload.date,
            workerName: payload.workerName || null,
            blockName: payload.blockName || null,
            workGroupId: payload.workGroupId ?? null,
            description: payload.description,
            photoUrl: mediaType === "photo" ? mediaDataUrl ?? null : null,
            videoUrl: mediaType === "video" ? mediaDataUrl ?? null : null,
            notes: payload.notes || null,
            attendanceCount: payload.attendanceCount ?? null,
            latitude: payload.latitude ?? null,
            longitude: payload.longitude ?? null,
          }),
        },
        submitTimeoutMs,
      );
      // Only count it as uploaded if the server actually accepted it AND the reply
      // is really from our API. A 5xx, or a captive-portal 200-HTML page, means the
      // write didn't land — queue it under the same clientId so the retry dedupes.
      if (!res.ok || !looksLikeOurApi(res)) {
        throw new Error(`estate-update not accepted: ${res.status}`);
      }
      toast({ title: "Update uploaded ✓" });
      onSaved();
    } catch {
      await savePendingEstateUpdate(payload, clientId);
      toast({ title: "Saved offline ✓", description: "Will upload automatically when internet returns" });
      onSaved();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">New Work Update</h2>
          <p className="text-xs text-blue-600 font-semibold">👥 {folder.name}</p>
        </div>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-4"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            isOnline ? <><Upload className="h-4 w-4 mr-1" />Upload</> : <><WifiOff className="h-4 w-4 mr-1" />Save</>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Online/offline pill */}
        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl w-fit ${
          isOnline ? "bg-primary/5 text-primary" : "bg-amber-50 text-amber-700"
        }`}>
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? "Online — will upload immediately" : "Offline — will upload when internet returns"}
        </div>

        {/* Media capture */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Capture Photo / Video</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => photoRef.current?.click()}
              className="flex flex-col items-center gap-2 bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl py-5 active:bg-blue-100"
            >
              <Camera className="h-6 w-6 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">Take Photo</span>
              <span className="text-[10px] text-blue-500">AI counts workers</span>
            </button>
            <button
              onClick={() => videoRef.current?.click()}
              className="flex flex-col items-center gap-2 bg-purple-50 border-2 border-dashed border-purple-200 rounded-2xl py-5 active:bg-purple-100"
            >
              <Video className="h-6 w-6 text-purple-500" />
              <span className="text-xs font-semibold text-purple-700">Record Video</span>
            </button>
          </div>
          <input ref={photoRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={(e) => handleFileChange(e, "photo")} />
          <input ref={videoRef} type="file" accept="video/*" capture="environment"
            className="hidden" onChange={(e) => handleFileChange(e, "video")} />
        </div>

        {/* Photo preview + AI counting overlay */}
        {mediaDataUrl && (
          <div className="relative">
            {mediaType === "photo" ? (
              <img src={mediaDataUrl} alt="preview" className="w-full rounded-2xl object-cover max-h-56" />
            ) : (
              <div className="bg-gray-800 rounded-2xl h-32 flex flex-col items-center justify-center gap-2">
                <Video className="h-8 w-8 text-white/60" />
                <p className="text-xs text-white/60">Video captured</p>
              </div>
            )}
            {/* AI counting spinner */}
            {aiCounting && (
              <div className="absolute inset-0 bg-black/40 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-7 w-7 text-white animate-spin" />
                <p className="text-white text-xs font-semibold">AI counting workers…</p>
              </div>
            )}
            <button
              onClick={clearMedia}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* AI attendance result */}
        {mediaType === "photo" && (aiDone || aiCounting) && (
          <div className={`rounded-2xl p-3.5 border ${aiCounting ? "bg-gray-50 border-gray-200" : "bg-primary/5 border-primary/20"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🤖</span>
              <p className={`text-xs font-bold ${aiCounting ? "text-gray-500" : "text-primary"}`}>
                {aiCounting ? "AI is counting workers in photo…" : `AI detected ${attendanceCount} worker${attendanceCount === "1" ? "" : "s"}`}
              </p>
            </div>
            {aiDone && aiDescription && (
              <p className="text-xs text-gray-500 mb-2.5 italic">{aiDescription}</p>
            )}
            {aiDone && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Attendance count <span className="font-normal text-gray-400">(edit if needed)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAttendanceCount(v => String(Math.max(0, parseInt(v || "0") - 1)))}
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center active:bg-gray-100"
                  >−</button>
                  <Input
                    type="number"
                    min="0"
                    value={attendanceCount}
                    onChange={e => setAttendanceCount(e.target.value)}
                    className="flex-1 text-center text-lg font-bold rounded-xl h-9"
                  />
                  <button
                    type="button"
                    onClick={() => setAttendanceCount(v => String(parseInt(v || "0") + 1))}
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center active:bg-gray-100"
                  >+</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
            What work was done? <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Pruning completed in Block A, weeding done near irrigation lines..."
            className="rounded-xl text-sm min-h-[80px]"
          />
        </div>

        {/* Block / Area */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">Block / Area</label>
          <Input
            value={blockName}
            onChange={e => setBlockName(e.target.value)}
            placeholder="e.g. Block A"
            className="rounded-xl text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DailyUpdate() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openFolder, setOpenFolder] = useState<UpdateFolder | null>(null);
  useSubScreenHistory(openFolder ? 1 : 0, () => setOpenFolder(null));
  const [pendingItems, setPendingItems] = useState<PendingEstateUpdate[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const { data: serverUpdates = [], isLoading } = useQuery<EstateUpdate[]>({
    queryKey: ["estate-updates", TODAY],
    queryFn: () => apiFetch(`/estate-updates?date=${TODAY}`),
    enabled: isOnline,
    staleTime: 30_000,
  });

  // Work groups drive the folder list, so keep a local cache: on offline
  // cold-start the last-known groups still show as folders.
  const { data: workGroups = [] } = useQuery<WorkGroup[]>({
    queryKey: ["work-groups"],
    queryFn: async () => {
      const groups = (await apiFetch("/work-groups")) as WorkGroup[];
      try { localStorage.setItem("cached-work-groups", JSON.stringify(groups)); } catch { /* storage full/unavailable */ }
      return groups;
    },
    initialData: () => {
      try { return JSON.parse(localStorage.getItem("cached-work-groups") || "[]") as WorkGroup[]; } catch { return []; }
    },
    // Cached initialData is only an offline fallback — always refetch when online.
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    staleTime: 60_000,
  });
  const groupNameById = new Map(workGroups.map((g) => [g.id, g.name]));

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      fetch(apiUrl(`/estate-updates/${id}`), { method: "DELETE", headers: await estateHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estate-updates"] }),
  });

  const loadPending = useCallback(async () => {
    setPendingItems(await getPendingEstateUpdates());
  }, []);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) { toast({ title: "Still offline", description: "Check your internet connection" }); return; }
    setSyncing(true);
    const flushed = await flushEstateUpdates(`${BASE}/api`);
    await loadPending();
    if (flushed > 0) {
      qc.invalidateQueries({ queryKey: ["estate-updates"] });
      toast({ title: `${flushed} update${flushed > 1 ? "s" : ""} uploaded ✓` });
    } else {
      toast({ title: "Nothing pending to upload" });
    }
    setSyncing(false);
  }, [loadPending, qc, toast]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) handleSync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [handleSync]);

  async function removePending(localId: string) {
    await deletePendingEstateUpdate(localId);
    await loadPending();
  }

  const totalToday = serverUpdates.length + pendingItems.length;

  // Updates filtered to the open folder. General folder (id null) collects
  // updates that have no work group.
  const folderPending = openFolder
    ? pendingItems.filter((i) => (i.workGroupId ?? null) === openFolder.id)
    : pendingItems;
  const folderSynced = openFolder
    ? serverUpdates.filter((i) => (i.workGroupId ?? null) === openFolder.id)
    : serverUpdates;

  // Per-folder counts for the folder list (today only).
  function countFor(id: number | null) {
    return (
      serverUpdates.filter((i) => (i.workGroupId ?? null) === id).length +
      pendingItems.filter((i) => (i.workGroupId ?? null) === id).length
    );
  }

  // Folder list: active groups, plus any group referenced by today's updates
  // that is inactive or missing (so no update is ever unreachable).
  const activeGroups = workGroups.filter((g) => g.isActive !== false);
  const knownIds = new Set(activeGroups.map((g) => g.id));
  const orphanIds: number[] = [];
  for (const u of [...serverUpdates, ...pendingItems]) {
    if (u.workGroupId != null && !knownIds.has(u.workGroupId) && !orphanIds.includes(u.workGroupId)) {
      orphanIds.push(u.workGroupId);
    }
  }
  const groupFolders: { id: number; name: string; category?: string | null }[] = [
    ...activeGroups.map((g) => ({ id: g.id, name: g.name, category: g.category })),
    ...orphanIds.map((id) => ({ id, name: groupNameById.get(id) ?? `Group #${id}` })),
  ];
  const generalCount = countFor(null);

  function goToFolder(folder: UpdateFolder | null) {
    setShowForm(false);
    setOpenFolder(folder);
  }

  return (
    <PageShell
      title={openFolder ? openFolder.name : "Work Updates"}
      back={openFolder ? undefined : "/"}
      onBack={openFolder ? () => goToFolder(null) : undefined}
    >
      {showForm && openFolder && (
        <AddUpdateForm
          folder={openFolder}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadPending();
            qc.invalidateQueries({ queryKey: ["estate-updates"] });
          }}
        />
      )}

      <div className="p-4 space-y-4">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${
            isOnline ? "bg-primary/5 text-primary" : "bg-amber-50 text-amber-700"
          }`}>
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? "Online" : "Offline mode"}
          </div>
          <div className="flex items-center gap-2">
            {pendingItems.length > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing || !isOnline}
                className="flex items-center gap-1.5 text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-2 rounded-xl disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Sync {pendingItems.length} pending
              </button>
            )}
          </div>
        </div>

        {openFolder === null ? (
          <>
            {/* Today header */}
            <div className="bg-primary rounded-3xl p-4 text-primary-foreground">
              <p className="text-primary-foreground/70 text-xs font-semibold uppercase">Today's Work Log</p>
              <p className="text-xl font-bold mt-0.5">{fmtDate(TODAY)}</p>
              <p className="text-primary-foreground/80 text-sm mt-1">
                {totalToday === 0 ? "No updates yet today" : `${totalToday} update${totalToday > 1 ? "s" : ""} logged`}
              </p>
            </div>

            {/* Group folders — created automatically from Work Attendance groups */}
            <p className="text-xs font-semibold text-gray-500 uppercase">
              👥 Your work groups
            </p>
            {groupFolders.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">No work groups yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Create a group in Work Attendance — it will appear here automatically
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {groupFolders.map((g) => {
                  const c = countFor(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => goToFolder({ id: g.id, name: g.name })}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 text-left"
                    >
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                        👥
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{g.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c === 0 ? "No updates today" : `${c} update${c > 1 ? "s" : ""} today`}
                          {g.category ? ` · ${g.category}` : ""}
                        </p>
                      </div>
                      {c > 0 && (
                        <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                          {c}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* General folder for updates not tied to a group */}
            <button
              onClick={() => goToFolder({ id: null, name: "General Updates" })}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                📋
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">General Updates</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {generalCount === 0 ? "Farm updates without a group" : `${generalCount} update${generalCount > 1 ? "s" : ""} today`}
                </p>
              </div>
              {generalCount > 0 && (
                <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                  {generalCount}
                </span>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Inside a folder */}
            <div className="bg-primary rounded-3xl p-4 text-primary-foreground">
              <p className="text-primary-foreground/70 text-xs font-semibold uppercase">
                {openFolder.id != null ? "👥 Group work log" : "📋 General work log"}
              </p>
              <p className="text-xl font-bold mt-0.5">{openFolder.name}</p>
              <p className="text-primary-foreground/80 text-sm mt-1">
                {fmtDate(TODAY)} · {folderSynced.length + folderPending.length === 0
                  ? "No updates yet today"
                  : `${folderSynced.length + folderPending.length} update${folderSynced.length + folderPending.length > 1 ? "s" : ""} today`}
              </p>
            </div>

            {/* Reminder for regular updates */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3 flex gap-2.5 items-start">
              <Clock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary leading-relaxed">
                Add a short photo or video update every 2–3 hours showing what work is being done.
              </p>
            </div>

            {/* Add button */}
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-primary/30 rounded-2xl py-4 text-primary font-semibold active:bg-primary/5 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Update for {openFolder.name}
            </button>

            {/* Pending (offline) items */}
            {folderPending.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-700 uppercase">
                  ⏳ Pending upload ({folderPending.length})
                </p>
                {folderPending.map(item => (
                  <PendingCard
                    key={item.localId}
                    item={item}
                    onDelete={() => removePending(item.localId)}
                  />
                ))}
              </div>
            )}

            {/* Synced items */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : folderSynced.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  ✓ Uploaded today ({folderSynced.length})
                </p>
                {folderSynced.map(item => (
                  <SyncedCard
                    key={item.id}
                    item={item}
                    groupName={item.workGroupId != null ? groupNameById.get(item.workGroupId) : undefined}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))}
              </div>
            ) : folderPending.length === 0 ? (
              <div className="text-center py-10">
                <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No updates today yet</p>
                <p className="text-gray-400 text-sm mt-1">Tap above to log what work was done</p>
              </div>
            ) : null}
          </>
        )}

        {/* Offline info banner */}
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <WifiOff className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">You're offline</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Photos and updates are saved on this device. They will upload automatically as soon as internet is available — no action needed.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
