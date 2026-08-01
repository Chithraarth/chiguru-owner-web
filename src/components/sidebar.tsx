import { Link, useLocation } from "wouter";
import {
  Home, UserCheck, Camera, BookOpen, Store, Plus,
  UserCircle2, CloudUpload, Crown, Smartphone, Megaphone, LifeBuoy, Trash2, Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { signOutUser } from "@/lib/firebase";
import { useT } from "@/lib/i18n";
import { useEstate } from "@/lib/use-estate";
import { useSidebar } from "@/lib/sidebar-context";
import { SyncIndicator } from "@/components/sync-indicator";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", icon: Home, key: "nav.home" },
  { href: "/work-groups", icon: UserCheck, key: "home.attendance" },
  { href: "/daily-update", icon: Camera, key: "home.workUpdates" },
  { href: "/farm-accounts", icon: BookOpen, key: "home.farmAccounts" },
  { href: "/marketplace", icon: Store, key: "nav.market" },
];

const ACCOUNT_LINKS = [
  { href: "/profile", icon: UserCircle2, key: "menu.profile" },
  { href: "/profile", icon: CloudUpload, key: "menu.backup" },
  { href: "/subscription", icon: Crown, key: "more.subscription" },
  { href: "/manager-devices", icon: Smartphone, key: "more.managerDevices" },
  { href: "/my-ads", icon: Megaphone, key: "menu.myAds" },
  { href: "/help", icon: LifeBuoy, key: "more.helpline" },
  { href: "/bin", icon: Trash2, key: "menu.bin" },
  { href: "/settings", icon: Settings, key: "more.settings" },
];

/**
 * Persistent left sidebar for wide/web screens — toggled by the hamburger in
 * PageShell's header (see useSidebar). Hidden below the lg breakpoint, where
 * the existing drawer-style AppMenu is used instead.
 */
export function Sidebar() {
  const { open } = useSidebar();
  const [location] = useLocation();
  const { t } = useT();
  const { user } = useAuth();
  const { estates } = useEstate();

  function isActive(href: string) {
    return href === "/" ? location === "/" : location === href || location.startsWith(href + "/");
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 bg-primary text-primary-foreground overflow-hidden transition-[width] duration-200",
        open ? "w-64" : "w-0"
      )}
    >
      <div className="w-64 h-full flex flex-col">
        <div className="px-5 pt-6 pb-4">
          <h1
            className="text-xl uppercase tracking-[0.06em] font-bold"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {t("app.name")}
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-6">
          <div className="space-y-0.5">
            {NAV_LINKS.map(({ href, icon: Icon, key }) => (
              <Link key={key} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive(href)
                      ? "bg-white/15 text-white"
                      : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(key)}</span>
                </div>
              </Link>
            ))}
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/50 mb-1.5">
              {t("estate.title")}
            </p>
            <Link href="/crops?new=1">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary-foreground/70 hover:bg-white/10 hover:text-white transition-colors">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">{t("estate.add")}</span>
              </div>
            </Link>
            {estates.length > 0 && (
              <p className="px-3 mt-1 text-xs text-primary-foreground/50">
                {estates.length} {estates.length === 1 ? "estate" : "estates"}
              </p>
            )}
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/50 mb-1.5">
              {t("menu.account")}
            </p>
            <div className="space-y-0.5">
              {ACCOUNT_LINKS.map(({ href, icon: Icon, key }, i) => (
                <Link key={`${href}-${i}`} href={href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive(href)
                        ? "bg-white/15 text-white"
                        : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(key)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="px-3 pb-2">
          <div className="px-3 py-2">
            <SyncIndicator />
          </div>
        </div>

        <Link href="/profile">
          <div className="flex items-center gap-3 px-5 py-3 border-t border-white/10 hover:bg-white/5 transition-colors">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full border border-white/30 shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <UserCircle2 className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.displayName || user?.phoneNumber || ""}</p>
              <p className="text-xs text-primary-foreground/60 truncate">{user?.email ?? user?.phoneNumber ?? ""}</p>
            </div>
          </div>
        </Link>
        <button
          onClick={() => void signOutUser()}
          className="flex items-center justify-center gap-2 mx-3 mb-4 h-10 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 text-red-200 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t("menu.signOut")}
        </button>
      </div>
    </aside>
  );
}
