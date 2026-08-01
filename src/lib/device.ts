// Stable per-device identity for the 2-devices-per-account limit. The id is a
// random UUID persisted in localStorage — it survives reloads and PWA installs,
// and resets only if the user clears site data (which then counts as a new device).

const DEVICE_ID_KEY = "farmone_device_id";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (rare) — fall back to a per-session id.
    return "session-" + Math.random().toString(36).slice(2);
  }
}

/** Human-readable label like "Android phone · Chrome" shown in the device list. */
export function describeDevice(): string {
  const ua = navigator.userAgent;
  let device = "Computer";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) device = /Mobile/i.test(ua) ? "Android phone" : "Android tablet";
  else if (/Mac/i.test(ua)) device = "Mac";
  else if (/Windows/i.test(ua)) device = "Windows PC";
  else if (/Linux/i.test(ua)) device = "Linux computer";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  return `${device} · ${browser}`;
}
