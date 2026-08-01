/**
 * Tracks in-app navigation depth so the header back button can step through
 * real history (page 4 → 3 → 2 → 1) instead of always jumping to a fixed
 * page, while never stepping out of the app (if the app was opened directly
 * on a deep page, back falls back to the page's `back` href).
 *
 * Every history entry created by the app is stamped with a monotonically
 * increasing `__navIdx` in its state. Depth is read from the *current*
 * entry's stamp, so multi-step traversals (history.go(-n), used by the
 * sub-screen history hook) stay perfectly accurate — unlike a counter that
 * assumes one step per popstate.
 */
let initialized = false;
let counter = 0;

function asObject(state: unknown): Record<string, unknown> {
  return state && typeof state === "object"
    ? (state as Record<string, unknown>)
    : {};
}

export function initNavTracking(): void {
  if (initialized) return;
  initialized = true;

  const current = window.history.state;
  const currentIdx = asObject(current).__navIdx;
  if (typeof currentIdx === "number") {
    // Session restore: keep counting from where we left off.
    counter = currentIdx;
  } else {
    // Stamp the initial entry as the app's root (depth 0).
    window.history.replaceState({ ...asObject(current), __navIdx: 0 }, "");
  }

  const originalPushState = window.history.pushState.bind(window.history);
  window.history.pushState = function (
    state: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    counter += 1;
    return originalPushState({ ...asObject(state), __navIdx: counter }, unused, url);
  } as History["pushState"];

  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (
    state: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    // Preserve the current entry's stamp so replaceState never erases depth.
    const idx = asObject(window.history.state).__navIdx;
    return originalReplaceState(
      { ...asObject(state), __navIdx: typeof idx === "number" ? idx : 0 },
      unused,
      url
    );
  } as History["replaceState"];

  window.addEventListener("popstate", () => {
    // Keep the counter monotonic even if the user goes forward to an entry
    // stamped higher than anything pushed this session.
    const idx = asObject(window.history.state).__navIdx;
    if (typeof idx === "number" && idx > counter) counter = idx;
  });
}

export function canGoBack(): boolean {
  const idx = asObject(window.history.state).__navIdx;
  return typeof idx === "number" && idx > 0;
}
