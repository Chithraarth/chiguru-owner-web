import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// A queued write that keeps getting rejected (permanently bad payload, e.g. an
// oversized base64 video, or a route that 404s) is dropped after this many tries
// so it can never block every newer record behind it forever.
const MAX_RETRIES = 5;

// Upload budgets. Rural links can be slow but a request that hasn't moved in this
// long is stalled, not slow — abort it and retry later instead of hanging the loop.
const TIMEOUT_SMALL_MS = 20_000; // attendance / small JSON POSTs
const TIMEOUT_MEDIA_MS = 60_000; // estate updates may carry a base64 photo/video

// On flaky networks a TCP connection can open and then stall forever; a fetch with
// no timeout would freeze the whole sync loop. Abort after a budget so a stalled
// request is treated as "retry later" (it rejects → caught → break) rather than
// hanging the queue and the "saved offline" badge.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// A 200 that isn't actually from our API — captive portals / ISP login pages on
// public and rural wifi return 200 with an HTML page — must NOT count as a synced
// write, or we'd delete the record while the server never received it. Our mutation
// endpoints always reply with JSON (or 204 No Content).
export function looksLikeOurApi(res: Response): boolean {
  if (res.status === 204) return true;
  return (res.headers.get("content-type") ?? "").includes("application/json");
}

// A stable id that doubles as the server idempotency key (clientId). Generate it
// once when a submit starts so the immediate POST and, if that fails, the queued
// retry both carry the same key — the server then dedupes a re-sent write.
export function newLocalId(): string {
  return `eu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Read the active estate id straight from localStorage. Defined here (not imported
// from api.ts) to avoid a circular import; offline-db is imported by api.ts.
function readActiveEstateId(): string | null {
  try {
    return localStorage.getItem("activeEstateId");
  } catch {
    return null;
  }
}

interface SyncQueueItem {
  id?: number;
  method: "POST" | "PATCH" | "DELETE" | "PUT";
  url: string;
  body?: unknown;
  timestamp: number;
  retries: number;
  // Estate the write belongs to, captured at queue time so the replay sends the
  // right X-Estate-Id even after the user has switched estates.
  estateId?: string | null;
}

export interface PendingEstateUpdate {
  localId: string;
  date: string;
  workerName: string;
  blockName: string;
  workGroupId?: number;
  description: string;
  mediaDataUrl?: string;
  mediaType?: "photo" | "video";
  notes?: string;
  attendanceCount?: number;
  latitude?: string;
  longitude?: string;
  attempts?: number;
  createdAt: string;
  // Estate this update belongs to, captured at save time so the replay POST sends
  // the right X-Estate-Id even if the user has since switched estates.
  estateId?: string | null;
}

// A locally-kept copy of a captured photo/video, so old media can be pruned off
// the device to free storage while the server keeps the permanent copy. Tagged by
// category because the two are cleaned on different schedules (see runMediaCleanup).
export interface MediaCacheItem {
  id: string;
  category: "workUpdate" | "attendance";
  type: "photo" | "video";
  dataUrl: string;
  createdAt: number;
}

export type FarmStoreName =
  | "farmProfile"
  | "crops"
  | "workers"
  | "workGroups"
  | "attendance"
  | "expenses"
  | "sprays"
  | "harvests"
  | "loans"
  | "loanPayments";

interface FarmDBSchema extends DBSchema {
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    indexes: { "by-timestamp": number };
  };
  estateUpdatesQueue: {
    key: string;
    value: PendingEstateUpdate;
  };
  mediaCache: {
    key: string;
    value: MediaCacheItem;
    indexes: { "by-createdAt": number };
  };
  farmProfile: { key: string; value: unknown };
  crops: { key: number; value: unknown };
  workers: { key: number; value: unknown };
  workGroups: { key: number; value: unknown };
  attendance: { key: number; value: unknown };
  expenses: { key: number; value: unknown };
  sprays: { key: number; value: unknown };
  harvests: { key: number; value: unknown };
  loans: { key: number; value: unknown };
  loanPayments: { key: number; value: unknown };
}

const FARM_STORES: FarmStoreName[] = [
  "farmProfile",
  "crops",
  "workers",
  "workGroups",
  "attendance",
  "expenses",
  "sprays",
  "harvests",
  "loans",
  "loanPayments",
];

let dbPromise: Promise<IDBPDatabase<FarmDBSchema>> | null = null;
let dbInstance: IDBPDatabase<FarmDBSchema> | null = null;

function resetDB() {
  try {
    dbInstance?.close();
  } catch {
    // already closing/closed — ignore
  }
  dbInstance = null;
  dbPromise = null;
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FarmDBSchema>("farm-manager-v2", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("syncQueue")) {
          const sq = db.createObjectStore("syncQueue", {
            keyPath: "id",
            autoIncrement: true,
          });
          sq.createIndex("by-timestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("estateUpdatesQueue")) {
          db.createObjectStore("estateUpdatesQueue", { keyPath: "localId" });
        }
        if (!db.objectStoreNames.contains("mediaCache")) {
          const mc = db.createObjectStore("mediaCache", { keyPath: "id" });
          mc.createIndex("by-createdAt", "createdAt");
        }
        for (const store of FARM_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }
      },
      // Another tab is trying to upgrade — release our connection so it can proceed.
      blocking() {
        resetDB();
      },
      // Connection was closed unexpectedly (browser reclaimed it, tab frozen, etc.).
      terminated() {
        dbInstance = null;
        dbPromise = null;
      },
    }).then((db) => {
      dbInstance = db;
      return db;
    });
  }
  return dbPromise;
}

function isConnectionClosingError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /connection is closing|database is closing/i.test(err.message)
  );
}

// Runs an IndexedDB operation and, if it fails because the cached connection
// was closing, transparently reopens the database and retries once. This makes
// the offline layer self-healing against stale/reclaimed connections instead of
// surfacing "The database connection is closing" errors to the user.
async function withDB<T>(
  fn: (db: IDBPDatabase<FarmDBSchema>) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getDB());
  } catch (err) {
    if (isConnectionClosingError(err)) {
      resetDB();
      return await fn(await getDB());
    }
    throw err;
  }
}

export async function enqueueSync(item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">) {
  await withDB((db) =>
    db.add("syncQueue", {
      ...item,
      // Capture the active estate now so a replay after an estate switch still
      // targets the estate this write was made against.
      estateId: item.estateId ?? readActiveEstateId(),
      timestamp: Date.now(),
      retries: 0,
    }),
  );
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return withDB((db) => db.getAllFromIndex("syncQueue", "by-timestamp"));
}

export async function removeSyncItem(id: number) {
  await withDB((db) => db.delete("syncQueue", id));
}

export async function updateSyncItemRetries(id: number, retries: number) {
  await withDB(async (db) => {
    const tx = db.transaction("syncQueue", "readwrite");
    const item = await tx.store.get(id);
    if (item) {
      item.retries = retries;
      await tx.store.put(item);
    }
    await tx.done;
  });
}

async function runSyncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        item.url,
        {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            ...(item.estateId ? { "X-Estate-Id": item.estateId } : {}),
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        },
        TIMEOUT_SMALL_MS,
      );
    } catch {
      // Network failure or stalled request (aborted) — we're effectively offline.
      // Stop and retry the whole queue later; don't burn a retry on every item.
      break;
    }

    if (res.ok) {
      if (!looksLikeOurApi(res)) {
        // 200 from a captive portal / proxy, not our API — server never got the
        // write. Don't delete it; stop and retry once we have real connectivity.
        break;
      }
      await removeSyncItem(item.id!);
      synced++;
      continue;
    }

    if (res.status >= 500) {
      // Server is down — retry the whole queue later, keep order.
      break;
    }

    // 4xx. An idempotent removal whose target is already gone (404 on DELETE/PATCH)
    // is effectively done — drop it. Everything else (incl. a POST that 404s) is a
    // permanently bad request: count it and drop after MAX_RETRIES so it can't
    // head-of-line block newer records forever. Never treat a POST 404 as success —
    // that would silently lose the record.
    if (res.status === 404 && (item.method === "DELETE" || item.method === "PATCH")) {
      await removeSyncItem(item.id!);
      synced++;
      continue;
    }

    const retries = item.retries + 1;
    if (retries >= MAX_RETRIES) {
      await removeSyncItem(item.id!);
    } else {
      await updateSyncItemRetries(item.id!, retries);
    }
    failed++;
  }

  return { synced, failed };
}

// ─── Estate updates queue ────────────────────────────────────────────────────

export async function savePendingEstateUpdate(
  update: Omit<PendingEstateUpdate, "localId" | "createdAt">,
  localId: string = newLocalId(),
): Promise<PendingEstateUpdate> {
  const item: PendingEstateUpdate = {
    ...update,
    localId,
    createdAt: new Date().toISOString(),
    // Stamp the active estate now so the replay POST targets it even after a switch.
    estateId: update.estateId ?? readActiveEstateId(),
  };
  await withDB((db) => db.put("estateUpdatesQueue", item));
  return item;
}

export async function getPendingEstateUpdates(): Promise<PendingEstateUpdate[]> {
  return withDB((db) => db.getAll("estateUpdatesQueue"));
}

export async function deletePendingEstateUpdate(localId: string) {
  await withDB((db) => db.delete("estateUpdatesQueue", localId));
}

async function runEstateQueue(apiBase: string): Promise<number> {
  const items = await getPendingEstateUpdates();
  let flushed = 0;
  for (const item of items) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${apiBase}/estate-updates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(item.estateId ? { "X-Estate-Id": item.estateId } : {}),
          },
          body: JSON.stringify({
            clientId: item.localId,
            date: item.date,
            workerName: item.workerName || null,
            blockName: item.blockName || null,
            workGroupId: item.workGroupId ?? null,
            description: item.description,
            photoUrl: item.mediaType === "photo" ? (item.mediaDataUrl ?? null) : null,
            videoUrl: item.mediaType === "video" ? (item.mediaDataUrl ?? null) : null,
            notes: item.notes ?? null,
            attendanceCount: item.attendanceCount ?? null,
            latitude: item.latitude ?? null,
            longitude: item.longitude ?? null,
          }),
        },
        TIMEOUT_MEDIA_MS,
      );
    } catch {
      break; // offline or stalled upload — retry later
    }

    if (res.ok) {
      if (!looksLikeOurApi(res)) break; // captive portal, not our API — retry later
      await deletePendingEstateUpdate(item.localId);
      flushed++;
      continue;
    }

    if (res.status >= 500) break; // server down — retry the whole queue later

    // 4xx: permanently bad payload (e.g. oversized base64 video). Count it and drop
    // after MAX_RETRIES so it can't head-of-line block newer updates forever.
    const attempts = (item.attempts ?? 0) + 1;
    if (attempts >= MAX_RETRIES) {
      await deletePendingEstateUpdate(item.localId);
    } else {
      await withDB((db) => db.put("estateUpdatesQueue", { ...item, attempts }));
    }
  }
  return flushed;
}

export async function getPendingCount(): Promise<number> {
  return withDB(async (db) => {
    const [sq, eu] = await Promise.all([
      db.count("syncQueue"),
      db.count("estateUpdatesQueue"),
    ]);
    return sq + eu;
  });
}

// Single-flight guard. Sync fires from several triggers (SyncProvider mount,
// "online" event, 30s interval, the daily-update page's own listener) and across
// two queues. Without one shared lock, two overlapping runs could read the same
// queue snapshot and POST the same record twice before either deletes it — and not
// every generic mutation is server-idempotent. All public flush entry points share
// this lock and delegate to the unguarded run* workers, so nothing overlaps.
let flushing = false;

export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
  if (flushing) return { synced: 0, failed: 0 };
  flushing = true;
  try {
    return await runSyncQueue();
  } finally {
    flushing = false;
  }
}

export async function flushEstateUpdates(apiBase: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    return await runEstateQueue(apiBase);
  } finally {
    flushing = false;
  }
}

export async function flushAll(apiBase: string): Promise<{ synced: number; failed: number }> {
  if (flushing) return { synced: 0, failed: 0 };
  flushing = true;
  try {
    const estate = await runEstateQueue(apiBase);
    const general = await runSyncQueue();
    return { synced: general.synced + estate, failed: general.failed };
  } finally {
    flushing = false;
  }
}

export async function cacheList(store: FarmStoreName, items: unknown[]) {
  await withDB(async (db) => {
    const tx = db.transaction(store, "readwrite");
    await tx.store.clear();
    for (const item of items) {
      await tx.store.put(item);
    }
    await tx.done;
  });
}

export async function getCachedList(store: FarmStoreName): Promise<unknown[]> {
  return withDB((db) => db.getAll(store));
}

// ─── Device media cache & clean-up ───────────────────────────────────────────
// The server keeps every photo/video forever (that IS the backup). On the phone we
// only keep a local copy so recent media loads instantly offline, then prune old
// copies so a farmer's device never fills up over the seasons. We NEVER touch
// financial "farm accounts" records, and NEVER touch unsynced pending items — this
// store holds view-only copies whose originals already live in the sync queues or
// on the server.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;
// When the device is under storage pressure we prune work-update media monthly
// instead of yearly. Pressure = used/quota above this ratio, or, when the browser
// can't tell us a quota, our own cached media exceeding a hard cap.
const STORAGE_PRESSURE_RATIO = 0.7;
const MEDIA_HARD_CAP_BYTES = 60 * 1024 * 1024; // ~60 MB of cached media
const CLEANUP_THROTTLE_MS = DAY_MS; // run automatic clean-up at most once a day
const CLEANUP_TS_KEY = "mediaCleanupLastRun";

// Persist one captured media item locally for fast offline viewing + later pruning.
export async function cacheMedia(
  category: MediaCacheItem["category"],
  type: MediaCacheItem["type"],
  dataUrl: string,
): Promise<void> {
  if (!dataUrl) return;
  const item: MediaCacheItem = {
    id: newLocalId(),
    category,
    type,
    dataUrl,
    createdAt: Date.now(),
  };
  await withDB((db) => db.put("mediaCache", item));
}

// Rough byte size of a base64/data-url string (~3/4 of the character length).
function approxBytes(dataUrl: string): number {
  return Math.floor((dataUrl?.length ?? 0) * 0.75);
}

export interface MediaUsage {
  count: number;
  bytes: number;
  quotaBytes: number | null;
  usedBytes: number | null;
  underPressure: boolean;
}

export async function getMediaUsage(): Promise<MediaUsage> {
  const items = await withDB((db) => db.getAll("mediaCache"));
  const bytes = items.reduce((sum, m) => sum + approxBytes(m.dataUrl), 0);

  let quotaBytes: number | null = null;
  let usedBytes: number | null = null;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      quotaBytes = est.quota ?? null;
      usedBytes = est.usage ?? null;
    }
  } catch {
    // estimate() unavailable — fall back to the hard cap below.
  }

  const underPressure =
    quotaBytes && usedBytes
      ? usedBytes / quotaBytes >= STORAGE_PRESSURE_RATIO
      : bytes >= MEDIA_HARD_CAP_BYTES;

  return { count: items.length, bytes, quotaBytes, usedBytes, underPressure };
}

export interface CleanupResult {
  removed: number;
  bytesFreed: number;
  underPressure: boolean;
}

// Prune old LOCAL media copies. Rules (server keeps everything regardless):
//   • Attendance media: removed only after 1 YEAR — always protected from the
//     monthly sweep, because attendance photos are the proof of who worked.
//   • Work-update media: removed after 1 YEAR normally; but when the device is
//     under storage pressure, removed after 1 MONTH to reclaim space faster.
// Never touches accounts/financial data or unsynced pending items (different stores).
export async function runMediaCleanup(): Promise<CleanupResult> {
  const usage = await getMediaUsage();
  const now = Date.now();
  const workCutoff = now - (usage.underPressure ? MONTH_MS : YEAR_MS);
  const attendanceCutoff = now - YEAR_MS;

  let removed = 0;
  let bytesFreed = 0;
  await withDB(async (db) => {
    const tx = db.transaction("mediaCache", "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const m = cursor.value;
      const cutoff = m.category === "attendance" ? attendanceCutoff : workCutoff;
      if (m.createdAt < cutoff) {
        bytesFreed += approxBytes(m.dataUrl);
        removed++;
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  });

  return { removed, bytesFreed, underPressure: usage.underPressure };
}

// Called on app start / after sync. Throttled so it runs at most once a day.
export async function maybeRunMediaCleanup(): Promise<CleanupResult | null> {
  try {
    const last = Number(localStorage.getItem(CLEANUP_TS_KEY) || 0);
    if (Date.now() - last < CLEANUP_THROTTLE_MS) return null;
    localStorage.setItem(CLEANUP_TS_KEY, String(Date.now()));
    return await runMediaCleanup();
  } catch {
    return null;
  }
}

// Manual "Free up space" — clears ALL locally cached media at once. Safe: originals
// are on the server (and any unsynced capture still lives in its own sync queue).
export async function clearCachedMedia(): Promise<CleanupResult> {
  const usage = await getMediaUsage();
  await withDB((db) => db.clear("mediaCache"));
  return { removed: usage.count, bytesFreed: usage.bytes, underPressure: usage.underPressure };
}
