import { getIdToken } from "@/lib/firebase";
import { apiUrl as ownerApiUrl, getActiveEstateId as ownerActiveEstateId } from "@/lib/api";

// API client for the invitee screens (ported from chiguru-manager-web). Same
// signed-in user and the same active estate as the rest of the Owner app, so
// switching farms anywhere switches it here too. The backend decides from
// X-Estate-Id alone whether this is the person's own farm or an invited one.

export const apiUrl = ownerApiUrl;

// A stalled request on a flaky network must not hang the UI forever. Abort after
// this long; callers fall back to the offline queue on the resulting error.
const FETCH_TIMEOUT_MS = 20_000;

/** An estate is a farm_profile row; the owner may have several. */
export interface Estate {
  id: number;
  farmName: string;
  /** From /me/estates: whether this is the person's own farm or one they're invited to. */
  relationship?: "own" | "invited";
}

/** The estate this person is currently working on (null until one is picked). */
export function getActiveEstateId(): string | null {
  return ownerActiveEstateId();
}

async function withAuthHeaders(headers: HeadersInit): Promise<HeadersInit> {
  const eid = getActiveEstateId();
  const token = await getIdToken();
  return {
    ...headers,
    ...(eid ? { "X-Estate-Id": eid } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Headers with the active estate id + auth token, for the few call sites that
 * must use raw fetch (e.g. AI headcount photo uploads) instead of apiFetch/apiPost.
 */
export async function estateHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  return withAuthHeaders({ "Content-Type": "application/json", ...(extra ?? {}) });
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...options,
      signal: options?.signal ?? controller.signal,
      headers: await withAuthHeaders({
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export type SessionVerdict = "valid" | "invalid" | "offline";

/** GET /manager/me - this person's invite on the active invited estate. */
export interface ManagerMe {
  managerId: number;
  name: string;
  phone: string | null;
  email: string | null;
  ownerId: number;
  estateId: number | null;
  farmName: string;
}

/**
 * Re-checks that this person still holds the invite for the active farm.
 * Distinguishes a revoked invite (401/403 → "invalid") from a connectivity
 * problem (fetch rejects or 5xx → "offline"), so nobody is locked out just
 * because they briefly lost signal.
 */
export async function checkManagerSession(): Promise<SessionVerdict> {
  try {
    const data = await apiFetch<ManagerMe>("/manager/me");
    return data ? "valid" : "offline";
  } catch (err) {
    if (err instanceof Error && /→ 40[13]/.test(err.message)) return "invalid";
    return "offline";
  }
}
