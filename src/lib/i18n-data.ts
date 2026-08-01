// Fully-translated languages (each has its own dictionary in i18n.tsx).
export type TranslatedLang = "en" | "hi" | "kn" | "ta" | "te" | "ml" | "mr";

// World languages — selectable everywhere; UI text falls back to English
// until a dictionary is added, but TTS + native names work.
export type Lang =
  | TranslatedLang
  | "es" | "fr" | "pt" | "ar" | "bn" | "ur" | "id" | "sw" | "zh" | "ja"
  | "ko" | "ru" | "de" | "it" | "tr" | "vi" | "th" | "fa" | "am" | "ha"
  | "yo" | "ne" | "si" | "km" | "ms" | "tl" | "my" | "pl" | "nl" | "uk"
  | "gu" | "pa" | "or";

export const LOCALE: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  or: "or-IN",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-BR",
  ar: "ar-SA",
  bn: "bn-BD",
  ur: "ur-PK",
  id: "id-ID",
  sw: "sw-KE",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ru: "ru-RU",
  de: "de-DE",
  it: "it-IT",
  tr: "tr-TR",
  vi: "vi-VN",
  th: "th-TH",
  fa: "fa-IR",
  am: "am-ET",
  ha: "ha-NG",
  yo: "yo-NG",
  ne: "ne-NP",
  si: "si-LK",
  km: "km-KH",
  ms: "ms-MY",
  tl: "fil-PH",
  my: "my-MM",
  pl: "pl-PL",
  nl: "nl-NL",
  uk: "uk-UA",
};

// English first — the app opens in English by default; farmers pick their
// regional language from the dropdown.
export const LANGUAGES: { code: Lang; native: string; english: string; emoji: string }[] = [
  { code: "en", native: "English", english: "English", emoji: "🇬🇧" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", emoji: "🇮🇳" },
  { code: "hi", native: "हिन्दी", english: "Hindi", emoji: "🇮🇳" },
  { code: "ta", native: "தமிழ்", english: "Tamil", emoji: "🇮🇳" },
  { code: "te", native: "తెలుగు", english: "Telugu", emoji: "🇮🇳" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", emoji: "🇮🇳" },
  { code: "mr", native: "मराठी", english: "Marathi", emoji: "🇮🇳" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", emoji: "🇮🇳" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", emoji: "🇮🇳" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", emoji: "🇮🇳" },
  { code: "bn", native: "বাংলা", english: "Bengali", emoji: "🇧🇩" },
  { code: "ur", native: "اردو", english: "Urdu", emoji: "🇵🇰" },
  { code: "ne", native: "नेपाली", english: "Nepali", emoji: "🇳🇵" },
  { code: "si", native: "සිංහල", english: "Sinhala", emoji: "🇱🇰" },
  { code: "es", native: "Español", english: "Spanish", emoji: "🇪🇸" },
  { code: "fr", native: "Français", english: "French", emoji: "🇫🇷" },
  { code: "pt", native: "Português", english: "Portuguese", emoji: "🇧🇷" },
  { code: "ar", native: "العربية", english: "Arabic", emoji: "🇸🇦" },
  { code: "id", native: "Bahasa Indonesia", english: "Indonesian", emoji: "🇮🇩" },
  { code: "ms", native: "Bahasa Melayu", english: "Malay", emoji: "🇲🇾" },
  { code: "tl", native: "Filipino", english: "Filipino", emoji: "🇵🇭" },
  { code: "sw", native: "Kiswahili", english: "Swahili", emoji: "🇰🇪" },
  { code: "ha", native: "Hausa", english: "Hausa", emoji: "🇳🇬" },
  { code: "yo", native: "Yorùbá", english: "Yoruba", emoji: "🇳🇬" },
  { code: "am", native: "አማርኛ", english: "Amharic", emoji: "🇪🇹" },
  { code: "zh", native: "中文", english: "Chinese", emoji: "🇨🇳" },
  { code: "ja", native: "日本語", english: "Japanese", emoji: "🇯🇵" },
  { code: "ko", native: "한국어", english: "Korean", emoji: "🇰🇷" },
  { code: "vi", native: "Tiếng Việt", english: "Vietnamese", emoji: "🇻🇳" },
  { code: "th", native: "ไทย", english: "Thai", emoji: "🇹🇭" },
  { code: "my", native: "မြန်မာ", english: "Burmese", emoji: "🇲🇲" },
  { code: "km", native: "ខ្មែរ", english: "Khmer", emoji: "🇰🇭" },
  { code: "ru", native: "Русский", english: "Russian", emoji: "🇷🇺" },
  { code: "uk", native: "Українська", english: "Ukrainian", emoji: "🇺🇦" },
  { code: "de", native: "Deutsch", english: "German", emoji: "🇩🇪" },
  { code: "it", native: "Italiano", english: "Italian", emoji: "🇮🇹" },
  { code: "tr", native: "Türkçe", english: "Turkish", emoji: "🇹🇷" },
  { code: "fa", native: "فارسی", english: "Persian", emoji: "🇮🇷" },
  { code: "pl", native: "Polski", english: "Polish", emoji: "🇵🇱" },
  { code: "nl", native: "Nederlands", english: "Dutch", emoji: "🇳🇱" },
];

// ---------------- Countries ----------------

export const COUNTRY_STORAGE_KEY = "jk.country";

// Top farming nations only — major growers of coffee, tea, spices, and
// staple crops. Names come from Intl.DisplayNames so we don't hardcode them.
export const COUNTRY_CODES: string[] = [
  "IN", // India — spices, tea, coffee, rice
  "BR", // Brazil — world's largest coffee grower
  "VN", // Vietnam — coffee (robusta), rice, pepper
  "CO", // Colombia — coffee
  "ET", // Ethiopia — birthplace of coffee
  "ID", // Indonesia — coffee, spices, palm
  "KE", // Kenya — tea, coffee
  "LK", // Sri Lanka — tea (Ceylon), cinnamon
  "CN", // China — tea, rice
  "UG", // Uganda — coffee
  "TZ", // Tanzania — coffee, tea, cloves
  "RW", // Rwanda — coffee, tea
  "BD", // Bangladesh — tea, rice, jute
  "NP", // Nepal — tea, cardamom
  "PK", // Pakistan — wheat, rice, cotton
  "TH", // Thailand — rice, rubber
  "MM", // Myanmar — rice, pulses
  "PH", // Philippines — coconut, rice
  "MY", // Malaysia — palm, pepper
  "MX", // Mexico — coffee, avocado
  "GT", // Guatemala — coffee, cardamom
  "HN", // Honduras — coffee
  "PE", // Peru — coffee, cacao
  "EC", // Ecuador — cacao, bananas
  "CI", // Côte d'Ivoire — cocoa
  "GH", // Ghana — cocoa
  "NG", // Nigeria — cassava, cocoa
  "TR", // Türkiye — tea, hazelnuts
  "MG", // Madagascar — vanilla, cloves
  "PG", // Papua New Guinea — coffee, cocoa
  "CR", // Costa Rica — pineapple, bananas, coffee
  "CL", // Chile — grapes, apples, berries
  "ZA", // South Africa — citrus, grapes
  "EG", // Egypt — dates, citrus
  "MA", // Morocco — citrus, olives
  "ES", // Spain — oranges, olives
  // Other common countries so every farmer can pick home + get local currency.
  "US", // United States
  "CA", // Canada
  "AU", // Australia
  "NZ", // New Zealand
  "GB", // United Kingdom
  "FR", // France
  "DE", // Germany
  "IT", // Italy
  "NL", // Netherlands
  "PT", // Portugal
  "AR", // Argentina
  "SA", // Saudi Arabia
  "AE", // United Arab Emirates
  "JP", // Japan
  "KR", // South Korea
  "RU", // Russia
  "UA", // Ukraine
];

/** English display name for a country code. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Flag emoji derived from ISO country code. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// Countries sorted by English name, computed once.
export const COUNTRIES: { code: string; name: string; emoji: string }[] =
  COUNTRY_CODES.map((code) => ({ code, name: countryName(code), emoji: flagEmoji(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

// Suggested languages per country — shown at the top of the language list.
// Any country not listed defaults to English + the full list.
export const COUNTRY_LANGS: Record<string, Lang[]> = {
  IN: ["en", "kn", "hi", "ta", "te", "ml", "mr", "gu", "pa", "or", "bn", "ur"],
  PK: ["ur", "en", "pa"],
  BD: ["bn", "en"],
  NP: ["ne", "hi", "en"],
  LK: ["si", "ta", "en"],
  US: ["en", "es"], GB: ["en"], CA: ["en", "fr"], AU: ["en"], NZ: ["en"],
  MX: ["es"], AR: ["es"], CO: ["es"], PE: ["es"], CL: ["es"], EC: ["es"],
  BO: ["es"], VE: ["es"], GT: ["es"], CU: ["es"], DO: ["es"], HN: ["es"],
  PY: ["es"], SV: ["es"], NI: ["es"], CR: ["es"], PA: ["es"], UY: ["es"],
  ES: ["es"], BR: ["pt"], PT: ["pt"], MZ: ["pt"], AO: ["pt"],
  FR: ["fr"], BE: ["fr", "nl"], CH: ["de", "fr", "it"], SN: ["fr"],
  CI: ["fr"], CM: ["fr", "en"], CD: ["fr", "sw"], MG: ["fr"], ML: ["fr"],
  BF: ["fr"], NE: ["fr", "ha"], TD: ["fr", "ar"], BJ: ["fr"], TG: ["fr"],
  GN: ["fr"], RW: ["fr", "sw", "en"], BI: ["fr", "sw"], GA: ["fr"], CG: ["fr"],
  DE: ["de"], AT: ["de"], IT: ["it"], NL: ["nl"], PL: ["pl"],
  RU: ["ru"], UA: ["uk", "ru"], KZ: ["ru"], BY: ["ru"], KG: ["ru"],
  TR: ["tr"], IR: ["fa"], AF: ["fa", "ur"], TJ: ["fa", "ru"],
  SA: ["ar"], EG: ["ar"], DZ: ["ar", "fr"], MA: ["ar", "fr"], TN: ["ar", "fr"],
  LY: ["ar"], SD: ["ar", "en"], IQ: ["ar"], SY: ["ar"], JO: ["ar"],
  LB: ["ar", "fr"], AE: ["ar", "en"], KW: ["ar"], QA: ["ar"], BH: ["ar"],
  OM: ["ar"], YE: ["ar"], MR: ["ar", "fr"], SO: ["ar", "en"],
  CN: ["zh"], TW: ["zh"], SG: ["en", "zh", "ms", "ta"], HK: ["zh", "en"],
  JP: ["ja"], KR: ["ko"], KP: ["ko"],
  VN: ["vi"], TH: ["th"], MM: ["my"], KH: ["km"], LA: ["th"],
  ID: ["id"], MY: ["ms", "en"], BN: ["ms"], PH: ["tl", "en"], TL: ["pt", "id"],
  KE: ["sw", "en"], TZ: ["sw", "en"], UG: ["en", "sw"],
  NG: ["en", "ha", "yo"], GH: ["en"], ET: ["am"], ER: ["am", "ar"],
  ZA: ["en"], ZM: ["en"], ZW: ["en"], MW: ["en"], BW: ["en"], NA: ["en"],
  LS: ["en"], SZ: ["en"], LR: ["en"], SL: ["en"], GM: ["en"], SS: ["en", "ar"],
};

/** Language list re-ordered so the country's suggested languages come first. */
export function languagesForCountry(country: string | null) {
  const preferred = (country && COUNTRY_LANGS[country]) || [];
  if (preferred.length === 0) return LANGUAGES;
  const set = new Set(preferred);
  const first = preferred
    .map((c) => LANGUAGES.find((l) => l.code === c))
    .filter((l): l is (typeof LANGUAGES)[number] => Boolean(l));
  return [...first, ...LANGUAGES.filter((l) => !set.has(l.code))];
}

export function readStoredCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(COUNTRY_STORAGE_KEY);
    return stored && COUNTRY_CODES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeCountry(code: string | null) {
  try {
    if (code) window.localStorage.setItem(COUNTRY_STORAGE_KEY, code);
    else window.localStorage.removeItem(COUNTRY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Crop labels: en/hi/kn are hand-translated; other languages fall back to
// English via `cropLabelFor` below.
export const TOP_CROPS: { name: string; emoji: string; label: Partial<Record<Lang, string>> & { en: string } }[] = [
  { name: "Coffee", emoji: "☕", label: { en: "Coffee", hi: "कॉफ़ी", kn: "ಕಾಫಿ" } },
  { name: "Rice (Paddy)", emoji: "🌾", label: { en: "Rice", hi: "धान", kn: "ಭತ್ತ" } },
  { name: "Ragi (Finger Millet)", emoji: "🌾", label: { en: "Ragi", hi: "रागी", kn: "ರಾಗಿ" } },
  { name: "Maize", emoji: "🌽", label: { en: "Maize", hi: "मक्का", kn: "ಜೋಳ" } },
  { name: "Sugarcane", emoji: "🎋", label: { en: "Sugarcane", hi: "गन्ना", kn: "ಕಬ್ಬು" } },
  { name: "Arecanut (Supari)", emoji: "🌴", label: { en: "Arecanut", hi: "सुपारी", kn: "ಅಡಿಕೆ" } },
  { name: "Coconut (Nariyal)", emoji: "🥥", label: { en: "Coconut", hi: "नारियल", kn: "ತೆಂಗು" } },
  { name: "Tomato", emoji: "🍅", label: { en: "Tomato", hi: "टमाटर", kn: "ಟೊಮೇಟೊ" } },
  { name: "Onion", emoji: "🧅", label: { en: "Onion", hi: "प्याज़", kn: "ಈರುಳ್ಳಿ" } },
  { name: "Cotton", emoji: "🌱", label: { en: "Cotton", hi: "कपास", kn: "ಹತ್ತಿ" } },
  { name: "Banana (Kela)", emoji: "🍌", label: { en: "Banana", hi: "केला", kn: "ಬಾಳೆ" } },
  { name: "Mango (Aam)", emoji: "🥭", label: { en: "Mango", hi: "आम", kn: "ಮಾವು" } },
  { name: "Groundnut (Moongphali)", emoji: "🥜", label: { en: "Groundnut", hi: "मूँगफली", kn: "ಕಡಲೆಕಾಯಿ" } },
  { name: "Turmeric (Haldi)", emoji: "🟡", label: { en: "Turmeric", hi: "हल्दी", kn: "ಅರಿಶಿಣ" } },
  { name: "Chilli (Dry)", emoji: "🌶️", label: { en: "Chilli", hi: "मिर्च", kn: "ಮೆಣಸಿನಕಾಯಿ" } },
];

/** Read text aloud in the current language using the browser's speech engine. */
export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE[lang];
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang === LOCALE[lang]) ||
      voices.find((v) => v.lang.startsWith(lang));
    if (match) u.voice = match;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech not available */
  }
}
