import { apiUrl } from "./api";

interface ErrorPayload {
  message: string;
  stack?: string;
  source: "boundary" | "window" | "promise";
}

// De-duplicate identical errors so one repeating glitch doesn't flood the server.
const recent = new Set<string>();

export function reportError(payload: ErrorPayload) {
  try {
    const key = `${payload.source}|${payload.message}`;
    if (recent.has(key)) return;
    recent.add(key);
    setTimeout(() => recent.delete(key), 30000);

    const body = JSON.stringify({
      message: payload.message,
      stack: payload.stack,
      source: payload.source,
      url: window.location.href,
      userAgent: navigator.userAgent,
      appVersion: import.meta.env.MODE,
    });

    const url = apiUrl("/errors");
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // The reporter must never throw — that would just create more errors.
  }
}

// Harmless browser/runtime noise that isn't a real app failure — filtered so
// error_logs stays signal-rich instead of flooding with benign races.
function isNoise(message: string): boolean {
  return (
    /ResizeObserver loop/i.test(message) ||
    // Benign IndexedDB race when a transaction starts as the page is
    // navigating/reloading and the connection is already closing.
    /database connection is closing/i.test(message)
  );
}

// Catches errors that escape React (async callbacks, event handlers, rejected
// promises) so they are reported too.
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    const message =
      event.message || event.error?.message || "Unknown script error";
    if (isNoise(message)) return;
    reportError({ message, stack: event.error?.stack, source: "window" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string } | string;
    const message =
      typeof reason === "string"
        ? reason
        : reason?.message || "Unhandled promise rejection";
    if (isNoise(message)) return;
    reportError({
      message,
      stack: typeof reason === "string" ? undefined : reason?.stack,
      source: "promise",
    });
  });
}
