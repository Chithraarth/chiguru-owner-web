import { useLocation } from "wouter";
import { useSync } from "@/lib/sync-manager";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatSyncTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function SyncIndicator() {
  const { isOnline, pendingCount, isSyncing, lastSyncTime } = useSync();
  const [, navigate] = useLocation();

  let icon = <CheckCircle2 className="h-3.5 w-3.5" />;
  let label = lastSyncTime ? `Synced at ${formatSyncTime(lastSyncTime)}` : "Synced";
  let tone = "text-emerald-700";

  if (!isOnline) {
    icon = <WifiOff className="h-3.5 w-3.5" />;
    label = pendingCount > 0 ? `Waiting for network (${pendingCount})` : "Offline";
    tone = "text-amber-700";
  } else if (isSyncing) {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    label = "Syncing…";
  } else if (pendingCount > 0) {
    icon = <RefreshCw className="h-3.5 w-3.5" />;
    label = `Waiting for network (${pendingCount})`;
    tone = "text-amber-700";
  }

  return (
    <button
      onClick={() => navigate("/sync-log")}
      className={cn("flex items-center gap-1.5 text-xs", tone)}
      title="View sync activity & conflict log"
    >
      {icon}
      <span
        className={cn(
          pendingCount > 0 ? "font-semibold" : "hidden min-[430px]:inline"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing } = useSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "w-full px-4 py-2 text-sm font-medium text-center",
        !isOnline
          ? "bg-amber-100 text-amber-800"
          : "bg-blue-100 text-blue-800"
      )}
    >
      {!isOnline ? (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          You're offline — your data is safe on this phone.
          {pendingCount > 0 ? ` Waiting for network (${pendingCount} items).` : ""}
        </span>
      ) : isSyncing ? (
        <span className="flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing {pendingCount} saved changes to server…
        </span>
      ) : null}
    </div>
  );
}
