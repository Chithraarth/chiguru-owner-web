import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw, WifiOff, History, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/api";
import { useSync } from "@/lib/sync-manager";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface ConflictValue {
  hoursWorked?: string;
  wageAmount?: string;
  notes?: string | null;
}

interface SyncConflict {
  id: number;
  entityType: string;
  workGroupId: number | null;
  workGroupName: string | null;
  summary: string;
  previousValue: ConflictValue | null;
  newValue: ConflictValue | null;
  previousDevice: string | null;
  newDevice: string | null;
  resolution: string;
  createdAt: string;
}

function describeValue(v: ConflictValue | null): string {
  if (!v) return "—";
  const parts: string[] = [];
  if (v.hoursWorked != null) parts.push(`${v.hoursWorked} hrs`);
  if (v.wageAmount != null) parts.push(`${fmtMoney(Number(v.wageAmount))}`);
  if (v.notes) parts.push(`"${v.notes}"`);
  return parts.length ? parts.join(" · ") : "—";
}

export default function SyncLogPage() {
  const { isOnline, pendingCount, isSyncing, lastSyncTime, triggerSync } = useSync();

  const { data: conflicts = [], isLoading, isError } = useQuery<SyncConflict[]>({
    queryKey: ["sync-conflicts"],
    queryFn: () => apiFetch("/sync-conflicts"),
  });

  return (
    <PageShell title="Sync Activity" back="/">
      <div className="p-4 space-y-4 pb-10">
        {/* Current status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {!isOnline ? (
              <div className="bg-amber-50 rounded-lg p-2"><WifiOff className="h-5 w-5 text-amber-600" /></div>
            ) : isSyncing ? (
              <div className="bg-blue-50 rounded-lg p-2"><RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /></div>
            ) : (
              <div className="bg-primary/5 rounded-lg p-2"><CheckCircle2 className="h-5 w-5 text-primary" /></div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">
                {!isOnline
                  ? "Offline — your data is safe on this phone"
                  : isSyncing
                  ? "Syncing your saved changes…"
                  : pendingCount > 0
                  ? `Waiting for network (${pendingCount} items)`
                  : "All changes synced"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {lastSyncTime
                  ? `Last synced at ${lastSyncTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${lastSyncTime.toLocaleDateString()}`
                  : "Not synced yet on this device"}
              </p>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800">
                {pendingCount} change{pendingCount === 1 ? "" : "s"} saved on this phone, not yet
                uploaded. {isOnline ? "Uploading automatically…" : "Will upload when internet returns."}
              </p>
            </div>
          )}

          {isOnline && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-primary border border-primary/20 rounded-xl py-2.5 active:bg-primary/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              Sync now
            </button>
          )}
        </div>

        {/* Conflict log */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <History className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Conflict log</h2>
          </div>
          <p className="text-xs text-gray-500 px-1 leading-relaxed">
            When two devices change the same record, the latest value is kept (last write wins).
            Every change is recorded here so nothing is lost silently.
          </p>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">
              Loading…
            </div>
          ) : isError ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-6 text-center">
              <WifiOff className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Couldn't load the log</p>
              <p className="text-xs text-gray-500 mt-1">
                {isOnline
                  ? "Something went wrong. Try again in a moment."
                  : "You're offline. The conflict log will load when internet returns."}
              </p>
            </div>
          ) : conflicts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">No conflicts</p>
              <p className="text-xs text-gray-500 mt-1">
                No two devices have changed the same record differently.
              </p>
            </div>
          ) : (
            conflicts.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 leading-snug">{c.summary}</p>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString()}{" "}
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                {c.workGroupName && (
                  <span className="inline-block text-xs font-medium rounded-full px-2.5 py-1 bg-blue-50 text-blue-700">
                    {c.workGroupName}
                  </span>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-1 bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400 mb-0.5">
                      Replaced{c.previousDevice ? ` · ${c.previousDevice}` : ""}
                    </p>
                    <p className="text-gray-500 line-through">{describeValue(c.previousValue)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 bg-emerald-50 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-600 mb-0.5">
                      Kept{c.newDevice ? ` · ${c.newDevice}` : ""}
                    </p>
                    <p className="text-emerald-800 font-medium">{describeValue(c.newValue)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
