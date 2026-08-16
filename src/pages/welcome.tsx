import {
  ScanFace, ClipboardList, Camera, Wallet, Users, Tractor,
  Leaf, Bot, Stethoscope, Store, Sprout, Wrench, Volume2,
  PlayCircle, CheckCircle2, ChevronDown, ArrowRight, Eye,
} from "lucide-react";
import { Link } from "wouter";
import { useT } from "@/lib/i18n";
import { LANGUAGES, speak, type Lang } from "@/lib/i18n-data";

// ── Welcome / first-time farmer onboarding page ──────────────────────────────
// A very simple, big-text page that explains Chiguru to farmers (including
// older people, and people who read best by listening rather than reading):
// what the app does, short walkthrough videos, and how it helps. Every line
// can also be read aloud with the Listen button (TTS via i18n-data#speak),
// since many users may have low literacy.

// The team uploads real screen-recordings later; until a file exists here,
// each slot shows a "video coming soon" card instead of a broken player —
// same approach as components/guided-tour.tsx.
const VIDEOS: { url: string | null; titleKey: string; descKey: string }[] = [
  { url: null, titleKey: "land.vid1", descKey: "land.vid1Desc" },
  { url: null, titleKey: "land.vid2", descKey: "land.vid2Desc" },
  { url: null, titleKey: "land.vid3", descKey: "land.vid3Desc" },
];

const FEATURES = [
  { icon: ScanFace, key: "faceAtt" },
  { icon: ClipboardList, key: "attendance" },
  { icon: Camera, key: "dailyWork" },
  { icon: Wallet, key: "accounts" },
  { icon: Users, key: "findWorkers" },
  { icon: Tractor, key: "rentMachines" },
  { icon: Leaf, key: "aiDisease" },
  { icon: Bot, key: "aiAdvisor" },
  { icon: Stethoscope, key: "realDoctor" },
] as const;

const SELL_ITEMS = [
  { icon: Store, key: "sellProduce" },
  { icon: Sprout, key: "sellNursery" },
  { icon: Wrench, key: "sellEquipment" },
] as const;

const BENEFITS = ["benefit1", "benefit2", "benefit3", "benefit4"] as const;

function ListenButton({ text, lang }: { text: string; lang: Lang }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      className="inline-flex items-center gap-1 text-primary shrink-0 rounded-lg px-1.5 py-1 active:bg-primary/10"
    >
      <Volume2 className="h-5 w-5" />
      <span className="text-xs font-semibold">{t("home.listen")}</span>
    </button>
  );
}

// Shows the real video once a URL is set, otherwise a friendly "coming soon"
// card (see VIDEOS above).
function VideoSlot({ url, title, desc }: { url: string | null; title: string; desc: string }) {
  const { t } = useT();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {url ? (
        <video controls preload="metadata" playsInline className="aspect-video w-full bg-black" src={url} />
      ) : (
        <div className="aspect-video bg-gray-100 flex flex-col items-center justify-center gap-2 text-gray-400">
          <PlayCircle className="h-10 w-10" />
          <span className="text-sm font-semibold">{t("land.videoSoon")}</span>
        </div>
      )}
      <div className="p-4">
        <p className="font-bold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const { t, lang, setLang } = useT();

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Top bar: language picker + open app */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="font-bold text-lg text-primary">{t("app.name")}</span>
          <div className="relative ml-auto">
            <select
              value={lang}
              onChange={(e) => {
                const code = e.target.value as Lang;
                setLang(code);
                const l = LANGUAGES.find((x) => x.code === code);
                if (l) speak(l.native, code);
              }}
              aria-label="Language"
              className="appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold"
          >
            {t("land.openApp")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-16">
        {/* Hero */}
        <section className="text-center pt-10 pb-8">
          <div className="flex items-start justify-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              {t("land.heroTitle")}
            </h1>
            <ListenButton text={`${t("land.heroTitle")}. ${t("land.heroDesc")}`} lang={lang} />
          </div>
          <p className="text-lg text-gray-600 mt-3 leading-relaxed">{t("land.heroDesc")}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 h-13 px-6 py-3.5 bg-primary text-primary-foreground rounded-2xl text-lg font-bold"
            >
              {t("land.startFree")}
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-3">{t("land.freeNote")}</p>
        </section>

        {/* Videos */}
        <section className="pt-2 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t("land.videosTitle")}</h2>
            <ListenButton text={t("land.videosTitle")} lang={lang} />
          </div>
          <div className="space-y-4">
            {VIDEOS.map((v) => (
              <VideoSlot key={v.titleKey} url={v.url} title={t(v.titleKey)} desc={t(v.descKey)} />
            ))}
          </div>
        </section>

        {/* Everything the app does */}
        <section className="pb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t("land.featuresTitle")}</h2>
            <ListenButton text={t("land.featuresTitle")} lang={lang} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{t(`land.${key}`)}</p>
                    <ListenButton text={`${t(`land.${key}`)}. ${t(`land.${key}Desc`)}`} lang={lang} />
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{t(`land.${key}Desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sell what you grow */}
        <section className="pb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t("land.sellTitle")}</h2>
            <ListenButton text={t("land.sellTitle")} lang={lang} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SELL_ITEMS.map(({ icon: Icon, key }) => (
              <div key={key} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                  <Icon className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="font-bold text-gray-900">{t(`land.${key}`)}</p>
                <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{t(`land.${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why farms run better with Chiguru */}
        <section className="pb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">{t("land.benefitsTitle")}</h2>
              <ListenButton
                text={`${t("land.benefitsTitle")}. ${BENEFITS.map((b) => t(`land.${b}`)).join(". ")}`}
                lang={lang}
              />
            </div>
            <ul className="space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-gray-700 leading-relaxed">{t(`land.${b}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final call to action */}
        <section className="text-center bg-primary rounded-2xl p-6">
          <h2 className="text-2xl font-extrabold text-primary-foreground">{t("land.ctaTitle")}</h2>
          <p className="text-primary-foreground/80 mt-1">{t("land.freeNote")}</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-primary rounded-2xl text-lg font-bold"
          >
            {t("land.startFree")} <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </main>
    </div>
  );
}
