import { useEffect, useRef } from "react";

/**
 * Registers in-page "sub screens" (vendor details, open folders, chat views…)
 * as real browser-history steps so the back button walks back one screen at a
 * time (detail → list → previous page → home) instead of skipping them.
 *
 * `depth` is how many sub-screens are currently open on top of the page's
 * root view (0 = root). `onBack` must close exactly one level.
 *
 * Each pushed history entry stores its level number in `history.state`
 * (`{ subScreen: n }`). On popstate we compare the entry's level with the
 * level we're tracking, so user back presses, programmatic closes, and even
 * multi-step jumps (long-press back) are all handled without race-prone
 * suppression counters. Stale entries left behind by a previous visit are
 * skipped automatically on mount.
 */
export function useSubScreenHistory(depth: number, onBack: () => void): void {
  const trackedRef = useRef(0);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // On mount: if we landed on a stale sub-screen entry left by a previous
  // visit (e.g. user opened a detail view, tapped Home, later came back),
  // clear its marker and hop down to the page's real root entry.
  useEffect(() => {
    const s = window.history.state;
    const staleLevel = typeof s?.subScreen === "number" ? s.subScreen : 0;
    if (staleLevel > 0 && trackedRef.current === 0) {
      window.history.replaceState({}, "");
      window.history.go(-staleLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = trackedRef.current;
    if (depth > prev) {
      for (let i = prev; i < depth; i++) {
        window.history.pushState({ subScreen: i + 1 }, "");
      }
      trackedRef.current = depth;
    } else if (depth < prev) {
      // Closed via a UI button — consume the extra history entries. The
      // resulting popstate lands on an entry whose level equals the new
      // depth, so the handler below treats it as a no-op.
      trackedRef.current = depth;
      window.history.go(depth - prev);
    }
  }, [depth]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const level =
        typeof e.state?.subScreen === "number" ? e.state.subScreen : 0;
      if (level < trackedRef.current) {
        // Back landed below our current level: close one UI level per step.
        const steps = trackedRef.current - level;
        trackedRef.current = level;
        for (let i = 0; i < steps; i++) onBackRef.current();
      } else if (level > trackedRef.current) {
        // Landed on a sub-screen entry we're not showing (forward button or
        // a stale entry from an earlier visit) — skip past it.
        window.history.go(trackedRef.current - level);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
