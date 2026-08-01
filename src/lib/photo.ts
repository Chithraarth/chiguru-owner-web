// Shared image handling for the whole farm app. Two goals:
//   1. Never upload a full-resolution phone photo (multi-MB) — always downscale
//      and re-encode as JPEG first, so uploads are fast on rural links and the
//      base64 stored server-side stays small.
//   2. Let farmers opt into "low-size photo mode" (a device preference) which
//      squeezes photos harder to save mobile data and phone storage.

/** localStorage flag: "1" when the farmer wants smaller, data-saving photos. */
export const LOW_SIZE_PHOTO_KEY = "lowSizePhoto";

export function isLowSizePhoto(): boolean {
  try {
    return localStorage.getItem(LOW_SIZE_PHOTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLowSizePhoto(on: boolean): void {
  try {
    if (on) localStorage.setItem(LOW_SIZE_PHOTO_KEY, "1");
    else localStorage.removeItem(LOW_SIZE_PHOTO_KEY);
  } catch {
    // private mode — preference just won't persist, not fatal.
  }
}

interface CompressOpts {
  maxW: number;
  quality: number;
}

// Core canvas downscale + JPEG re-encode. Resolves the original data URL back if
// the image can't be decoded, so a capture never silently disappears.
function compress(dataUrl: string, { maxW, quality }: CompressOpts): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Photos that are just records of work (daily updates, profiles). These don't
// need fine detail, so they can be squeezed hard — especially in low-size mode.
export function compressForRecord(dataUrl: string): Promise<string> {
  return isLowSizePhoto()
    ? compress(dataUrl, { maxW: 512, quality: 0.5 })
    : compress(dataUrl, { maxW: 800, quality: 0.72 });
}

// Photos the AI has to actually "see" (disease leaves, worker head-count). Detail
// matters for accuracy, so keep these larger; low-size mode still trims them but
// stays high enough to diagnose/count reliably.
export function compressForAI(dataUrl: string): Promise<string> {
  return isLowSizePhoto()
    ? compress(dataUrl, { maxW: 768, quality: 0.6 })
    : compress(dataUrl, { maxW: 1100, quality: 0.8 });
}

/** Read a picked File into a data URL (rejects on read error). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
