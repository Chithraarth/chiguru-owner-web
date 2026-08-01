import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ShieldCheck, ImageDown, HardDrive, Trash2, Loader2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isLowSizePhoto, setLowSizePhoto } from "@/lib/photo";
import {
  getMediaUsage,
  runMediaCleanup,
  clearCachedMedia,
  type MediaUsage,
} from "@/lib/offline-db";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export default function Settings() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // ── Low-size photo mode ──
  const [lowSize, setLowSize] = useState(isLowSizePhoto());

  function toggleLowSize() {
    const next = !lowSize;
    setLowSize(next);
    setLowSizePhoto(next);
    toast({
      title: next ? "Data-saver photos ON" : "Data-saver photos OFF",
      description: next
        ? "Photos will be smaller — faster uploads on slow internet."
        : "Photos will be full size again.",
    });
  }

  // ── Storage & clean-up ──
  const [usage, setUsage] = useState<MediaUsage | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshUsage() {
    try {
      setUsage(await getMediaUsage());
    } catch {
      setUsage(null);
    }
  }

  useEffect(() => { void refreshUsage(); }, []);

  async function handleCleanup() {
    setBusy(true);
    try {
      const r = await runMediaCleanup();
      toast({
        title: r.removed > 0 ? `Cleaned ${r.removed} old item${r.removed !== 1 ? "s" : ""}` : "Nothing old to clean yet",
        description: r.removed > 0 ? `Freed about ${formatBytes(r.bytesFreed)}.` : "Your device is tidy.",
      });
      await refreshUsage();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setBusy(true);
    try {
      const r = await clearCachedMedia();
      toast({
        title: `Freed about ${formatBytes(r.bytesFreed)}`,
        description: "Old photos still live on the server — this only clears this phone.",
      });
      await refreshUsage();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Settings" back="/">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Data-saver photos */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-xl p-2.5 flex-shrink-0">
              <ImageDown className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Data-saver photos</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Shrinks photos before uploading — faster and cheaper on slow internet.
              </p>
            </div>
            <button
              onClick={toggleLowSize}
              role="switch"
              aria-checked={lowSize}
              aria-label="Data-saver photos"
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                lowSize ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  lowSize ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        </section>

        {/* Backup & restore moved to My Profile — point people there */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 text-blue-700 rounded-xl p-2.5 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Backup & restore</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Your backup code and restore now live in My Profile, together with
                Google sign-in backup.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/profile")}
                className="mt-3 w-full rounded-xl h-11"
              >
                Open My Profile
              </Button>
            </div>
          </div>
        </section>

        {/* Storage & clean-up */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-orange-100 text-orange-700 rounded-xl p-2.5 flex-shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Phone storage</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {usage
                  ? `${usage.count} photo${usage.count !== 1 ? "s" : ""}/video kept on this phone — about ${formatBytes(usage.bytes)}.`
                  : "Checking storage…"}
              </p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Old photos are cleaned off your phone automatically (work updates and
                attendance after a year; work-update photos sooner if your phone gets
                full). Attendance photos are kept longer. Your farm accounts are never
                deleted, and nothing waiting to upload is ever removed. Everything stays
                safe on the server.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCleanup}
                  disabled={busy}
                  className="flex-1 rounded-xl h-11"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Clean old media"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={busy || !usage || usage.count === 0}
                  className="flex-1 rounded-xl h-11 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Free up space
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
