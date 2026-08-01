import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "jk:lastChunkReload";

// Only auto-reload once in a short window so a genuinely missing chunk can't
// trap the app in an endless reload loop.
function canReloadNow(): boolean {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
  return Date.now() - last > 10000;
}

// Wraps React.lazy so that when a page chunk fails to load — almost always
// because a new app version was published and the old file no longer exists —
// the app quietly reloads itself to fetch the new version instead of crashing.
export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (canReloadNow()) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Hold rendering while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
