import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { syncPendingMutations, getSyncQueue, maybeRunMediaCleanup } from "./offline-db";

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncState>({
  isOnline: navigator.onLine,
  pendingCount: 0,
  isSyncing: false,
  lastSyncTime: null,
  triggerSync: async () => {},
});

const LAST_SYNC_KEY = "farm_last_sync_time";

function loadLastSyncTime(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? new Date(Number(raw)) : null;
  } catch {
    return null;
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  // Persist the last successful sync so "Synced at 10:30 AM" survives reloads and
  // a farmer always sees when their data last reached the server.
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(loadLastSyncTime);

  const refreshPendingCount = useCallback(async () => {
    const queue = await getSyncQueue();
    setPendingCount(queue.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingMutations();
      await refreshPendingCount();
      // After data reaches the server, prune old local media copies (throttled daily).
      void maybeRunMediaCleanup();
      const now = new Date();
      setLastSyncTime(now);
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(now.getTime()));
      } catch {
        // localStorage can throw in private mode — the in-memory value still works.
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    refreshPendingCount();
    // Also prune old local media on startup (throttled to once a day internally).
    void maybeRunMediaCleanup();

    const interval = setInterval(refreshPendingCount, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [triggerSync, refreshPendingCount]);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      triggerSync();
    }
  }, [isOnline, pendingCount, triggerSync]);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, lastSyncTime, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
