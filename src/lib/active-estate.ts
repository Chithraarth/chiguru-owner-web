// The estate this tab is working on, held in memory so every API request
// uses exactly the farm the UI is showing. localStorage only seeds it on load
// and remembers it for next time - it's shared by every tab, so reading it
// per request let another tab silently change which farm this one acted on.
// Kept in its own module so api.ts and offline-db.ts can both import it.

export const ACTIVE_ESTATE_KEY = "activeEstateId";

let current: string | null | undefined;

export function getCurrentEstateId(): string | null {
  if (current === undefined) {
    try {
      current = localStorage.getItem(ACTIVE_ESTATE_KEY);
    } catch {
      current = null;
    }
  }
  return current;
}

/** Only EstateProvider calls this, alongside its own state. */
export function setCurrentEstateId(id: number | null) {
  current = id == null ? null : String(id);
}
