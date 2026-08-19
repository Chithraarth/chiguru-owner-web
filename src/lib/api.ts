import { enqueueSync, fetchWithTimeout, looksLikeOurApi } from "./offline-db";
import { getIdToken } from "./firebase";

// A stalled request on a flaky network should fall back to the offline queue, not
// hang the UI. Abort the immediate submit after this long and queue it for retry.
const SUBMIT_TIMEOUT_MS = 20_000;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${BASE}/api${path}`;
}

/** localStorage key holding the id of the estate the planter is currently viewing. */
export const ACTIVE_ESTATE_KEY = "activeEstateId";

/** Read the active estate id from localStorage (null if none picked yet). */
export function getActiveEstateId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ESTATE_KEY);
  } catch {
    return null;
  }
}

/**
 * Every request must carry the active estate (so the API scopes data to it)
 * and, once signed in, the Firebase ID token (so the API knows which Owner is
 * asking) — added here, not per call site, so neither can be forgotten.
 *
 * X-Actor-Role tells the backend this is the Owner app — needed only for the
 * rare phone number that is both an Owner and, separately, an invited
 * Manager elsewhere; the backend uses it to pick the right farm instead of
 * guessing (see effectiveOwnerId in firebaseAuth.ts).
 */
async function withAuthHeaders(headers: HeadersInit): Promise<HeadersInit> {
  const eid = getActiveEstateId();
  const token = await getIdToken();
  return {
    ...headers,
    "X-Actor-Role": "owner",
    ...(eid ? { "X-Estate-Id": eid } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Headers with the active estate id + auth token, for the few call sites that
 * must use raw fetch (e.g. media uploads in daily-update) instead of
 * apiFetch/apiMutate.
 */
export async function estateHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  return withAuthHeaders({ "Content-Type": "application/json", ...(extra ?? {}) });
}

/** Error thrown by apiFetch on a non-2xx response, carrying the HTTP status. */
export class ApiError extends Error {
  status: number;
  /** Parsed JSON error body (e.g. { message, code }), when the server sent one. */
  body: { message?: string; code?: string } | null;
  constructor(status: number, message: string, body: { message?: string; code?: string } | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Any gated feature (attendance, Farm Accounts, AI tools, posting a listing,
 * creating an estate...) answers 403 SUBSCRIPTION_REQUIRED without an active
 * plan. Rather than have every page handle that error individually, we catch
 * it once here and send the owner straight to the Subscription page — a
 * wouter-compatible navigation (history + popstate) so it doesn't force a
 * full reload.
 *
 * Uses replaceState, not pushState: the gated page never showed real content,
 * so it shouldn't occupy its own spot in the back-stack. Pushing a new entry
 * would mean "back" returns to the gated page, which immediately re-fetches,
 * gets rejected again, and redirects right back here — an invisible loop that
 * looks like the back button is broken. Replacing collapses the gated page
 * and this redirect into one entry, so back correctly skips over it.
 */
function redirectToSubscription() {
  if (window.location.pathname.replace(BASE, "") === "/subscription") return;
  const target = `${BASE}/subscription`;
  window.history.replaceState(window.history.state, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function handleErrorBody(status: number, body: { message?: string; code?: string } | null) {
  if (status === 403 && body?.code === "SUBSCRIPTION_REQUIRED") {
    redirectToSubscription();
  }
}

/** Best-effort JSON parse of an error response body — never throws. */
function parseErrorBody(text: string): { message?: string; code?: string } | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: await withAuthHeaders({
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    const body = parseErrorBody(text);
    handleErrorBody(res.status, body);
    throw new ApiError(res.status, `API ${path} → ${res.status}: ${text}`, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiMutate<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T | null> {
  // navigator.onLine only reflects a local interface, not real reachability, so we
  // don't trust it as the only gate — but if it's clearly offline, skip the attempt.
  if (!navigator.onLine) {
    await enqueueSync({ method, url: apiUrl(path), body });
    return null;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      apiUrl(path),
      {
        method,
        headers: await withAuthHeaders({ "Content-Type": "application/json" }),
        body: body ? JSON.stringify(body) : undefined,
      },
      SUBMIT_TIMEOUT_MS,
    );
  } catch (err) {
    // Network failure or a stalled request we aborted — queue it and let the sync
    // loop retry once we have real connectivity.
    await enqueueSync({ method, url: apiUrl(path), body });
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    // 5xx is transient (server restarting/overloaded) → queue for retry. A 4xx is a
    // definitive rejection (validation, not-found); retrying won't help and would
    // poison the queue, so surface it without queueing.
    if (res.status >= 500) {
      await enqueueSync({ method, url: apiUrl(path), body });
    }
    const parsedBody = parseErrorBody(text);
    handleErrorBody(res.status, parsedBody);
    throw new ApiError(res.status, `API ${path} → ${res.status}: ${text}`, parsedBody);
  }

  // A captive portal / ISP login page can answer 200 with an HTML body. res.ok
  // passes but this isn't our API and the write never reached the server, so treat
  // it like a connectivity failure: queue it and surface an error (don't return as
  // if it succeeded).
  if (!looksLikeOurApi(res)) {
    await enqueueSync({ method, url: apiUrl(path), body });
    throw new ApiError(res.status, `API ${path} → got non-API response (captive portal?)`);
  }

  if (res.status === 204) return null;
  return res.json();
}
