import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import {
  Menu, X, UserCircle2, Crown, Smartphone, LifeBuoy, Settings, Star,
  LogOut, Globe, ChevronRight, ChevronDown, CloudUpload, Trash2,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { signOutUser } from "@/lib/firebase";
import {
  COUNTRIES, LANGUAGES, languagesForCountry, readStoredCountry, storeCountry,
} from "@/lib/i18n-data";
import { useT } from "@/lib/i18n";
import { currencyForCountry, storeCurrency } from "@/lib/currency";
import { apiMutate } from "@/lib/api";
import { RateAppSheet } from "@/components/rate-app-sheet";

// "menu.rate" has no href — it opens the in-app rating sheet instead of navigating.
const MENU_ITEMS = [
  { href: "/profile", icon: UserCircle2, key: "menu.profile" },
  { href: "/profile", icon: CloudUpload, key: "menu.backup" },
  { href: "/subscription", icon: Crown, key: "more.subscription" },
  { href: "/manager-devices", icon: Smartphone, key: "more.managerDevices" },
  { href: "/my-ads", icon: Megaphone, key: "menu.myAds" },
  { href: "/help", icon: LifeBuoy, key: "more.helpline" },
  { href: "/bin", icon: Trash2, key: "menu.bin" },
  { href: "/settings", icon: Settings, key: "more.settings" },
  { href: null, icon: Star, key: "menu.rate" },
];

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [country, setCountry] = useState<string | null>(readStoredCountry);
  const [countryOpen, setCountryOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [, navigate] = useLocation();
  const { t, lang, setLang } = useT();
  const { user } = useAuth();
  const selectedCountry = COUNTRIES.find((c) => c.code === country) ?? null;
  const selectedLang = LANGUAGES.find((l) => l.code === lang) ?? null;

  function go(href: string) {
    setOpen(false);
    navigate(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("menu.title")}
        className="p-1.5 -mr-1.5 rounded-lg hover:bg-primary/20 transition-colors"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-[300px] max-w-[85vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {/* Account header */}
            <div className="bg-primary text-primary-foreground p-4 pt-5">
              <div className="flex items-start justify-between">
                <button
                  onClick={() => go("/profile")}
                  className="flex items-center gap-3 text-left min-w-0"
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="h-12 w-12 rounded-full border-2 border-white/40 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <UserCircle2 className="h-8 w-8" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold truncate">{user?.displayName || user?.phoneNumber || ""}</p>
                    <p className="text-primary-foreground/80 text-xs truncate">{user?.email ?? ""}</p>
                  </div>
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-1 rounded-lg hover:bg-white/20 shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Items */}
            <nav className="flex-1 overflow-y-auto py-2">
              {MENU_ITEMS.map(({ href, icon: Icon, key }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (href) {
                      go(href);
                    } else {
                      setOpen(false);
                      setRateOpen(true);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 text-left"
                >
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="flex-1 font-medium text-gray-800">{t(key)}</span>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </button>
              ))}

              {/* Country — expandable in-drawer list (native selects pop off-screen) */}
              <div className="px-4 py-3.5 border-t border-gray-100 mt-1">
                <button
                  onClick={() => {
                    setCountryOpen((v) => !v);
                    setLangOpen(false);
                  }}
                  className="w-full flex items-center gap-3 text-left"
                  aria-expanded={countryOpen}
                >
                  <Globe className="h-5 w-5 text-primary shrink-0" />
                  <span className="flex-1 font-medium text-gray-800">{t("menu.country")}</span>
                  <span className="text-sm text-gray-500">
                    {selectedCountry ? `${selectedCountry.emoji} ${selectedCountry.name}` : "🌍"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${countryOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {countryOpen && (
                  <div className="mt-2.5 max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setCountry(c.code);
                          storeCountry(c.code);
                          const cur = currencyForCountry(c.code);
                          storeCurrency(cur);
                          // Sync to the farm profile so the manager device
                          // shows the same currency. Best-effort when offline.
                          apiMutate("PATCH", "/farm/profile", { currency: cur }).catch(() => {});
                          setCountryOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 ${
                          country === c.code ? "bg-primary/10 font-semibold text-primary" : "text-gray-800"
                        }`}
                      >
                        <span>{c.emoji}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language — expandable in-drawer list, country's languages first */}
              <div className="px-4 py-3.5 border-t border-gray-100">
                <button
                  onClick={() => {
                    setLangOpen((v) => !v);
                    setCountryOpen(false);
                  }}
                  className="w-full flex items-center gap-3 text-left"
                  aria-expanded={langOpen}
                >
                  <Globe className="h-5 w-5 text-primary shrink-0" />
                  <span className="flex-1 font-medium text-gray-800">{t("menu.language")}</span>
                  <span className="text-sm text-gray-500">{selectedLang?.native}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${langOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {langOpen && (
                  <div className="mt-2.5 max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                    {languagesForCountry(country).map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setLang(l.code);
                          setLangOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[15px] hover:bg-gray-50 ${
                          lang === l.code ? "bg-primary/10 font-semibold text-primary" : "text-gray-800"
                        }`}
                      >
                        <span className="flex-1 truncate">{l.native}</span>
                        <span className="text-xs text-gray-400">{l.english}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            {/* Sign out */}
            <div className="border-t border-gray-100 p-3">
              <button
                onClick={() => {
                  setOpen(false);
                  void signOutUser();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl h-11 text-red-600 font-medium hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {t("menu.signOut")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <RateAppSheet open={rateOpen} onClose={() => setRateOpen(false)} />
    </>
  );
}
