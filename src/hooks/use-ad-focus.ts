import { useEffect, useRef } from "react";

/**
 * Deep-link focus for community-board ads (?ad=<id> from the Home recent-ads
 * feed). Once the listings have rendered, scrolls the matching card (element
 * id `ad-<id>`) into view. Returns the ad id so the page can highlight it.
 */
export function useAdFocus(ready: boolean): number {
  const adId = useRef(Number(new URLSearchParams(window.location.search).get("ad")) || 0).current;
  const done = useRef(false);

  useEffect(() => {
    if (!adId || !ready || done.current) return;
    const el = document.getElementById(`ad-${adId}`);
    if (!el) return;
    done.current = true;
    // Let the list finish painting before jumping.
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [adId, ready]);

  return adId;
}
