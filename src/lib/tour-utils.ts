const COUNT_KEY = "jk.tourSeenCount";
const SESSION_KEY = "jk.tourShownThisSession";
const MAX_SHOWS = 1;

function seenCount(): number {
  try {
    const n = parseInt(window.localStorage.getItem(COUNT_KEY) ?? "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Show the training tour only on the very first app open (once per session). */
export function shouldShowTour(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return false;
    return seenCount() < MAX_SHOWS;
  } catch {
    return false;
  }
}

/** Record that the training tour has now been shown. */
export function markTourShown() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
    window.localStorage.setItem(COUNT_KEY, String(seenCount() + 1));
  } catch {
    /* ignore */
  }
}
