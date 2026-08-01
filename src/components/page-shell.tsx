import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, ChevronLeft, UserCheck, Camera, BookOpen, RefreshCw, Menu,
} from "lucide-react";
import { OfflineBanner, SyncIndicator } from "./sync-indicator";
import { AppMenu } from "./app-menu";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { canGoBack } from "@/lib/nav-history";
import { useSidebar } from "@/lib/sidebar-context";

const NAV_ITEMS = [
  { href: "/", icon: Home, key: "nav.home" },
  { href: "/work-groups", icon: UserCheck, key: "home.attendance" },
  { href: "/daily-update", icon: Camera, key: "home.workUpdates" },
  { href: "/farm-accounts", icon: BookOpen, key: "home.farmAccounts" },
  { href: "/sync-log", icon: RefreshCw, key: "more.syncLog" },
];

// Each feature's header takes the colour of its tile on the home / hub screens,
// so a screen feels part of the same section as you drill into it. Class strings
// are kept whole (never built dynamically) so Tailwind keeps them in the build.
const HEADER_ACCENTS = {
  green:   { header: "bg-background", hover: "hover:bg-foreground/5" },
  amber:   { header: "bg-background", hover: "hover:bg-foreground/5" },
  orange:  { header: "bg-background", hover: "hover:bg-foreground/5" },
  emerald: { header: "bg-background", hover: "hover:bg-foreground/5" },
  teal:    { header: "bg-background", hover: "hover:bg-foreground/5" },
  cyan:    { header: "bg-background", hover: "hover:bg-foreground/5" },
  yellow:  { header: "bg-background", hover: "hover:bg-foreground/5" },
  slate:   { header: "bg-background", hover: "hover:bg-foreground/5" },
  purple:  { header: "bg-background", hover: "hover:bg-foreground/5" },
  lime:    { header: "bg-background", hover: "hover:bg-foreground/5" },
  rose:    { header: "bg-background", hover: "hover:bg-foreground/5" },
} as const;

// Longest / most specific prefixes first so e.g. /agri-doctor beats /agri-ai.
const ROUTE_ACCENT: Array<[string, keyof typeof HEADER_ACCENTS]> = [
  ["/daily-update", "amber"],
  ["/accounts-scan", "amber"],
  ["/farm-accounts", "orange"],
  ["/expenses", "orange"],
  ["/harvests", "lime"],
  ["/reports", "purple"],
  ["/loans", "rose"],
  ["/marketplace", "lime"],
  ["/equipment", "orange"],
  ["/shop", "emerald"],
  ["/agri-doctor", "teal"],
  ["/disease", "cyan"],
  ["/agri-ai", "amber"],
  ["/crops", "yellow"],
  ["/sync-log", "slate"],
];

function accentForPath(path: string) {
  const match = ROUTE_ACCENT.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  return HEADER_ACCENTS[match ? match[1] : "green"];
}

interface PageShellProps {
  title: string;
  children: ReactNode;
  back?: string;
  onBack?: () => void;
  action?: ReactNode;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  centerTitle?: boolean;
}

export function PageShell({ title, children, back, onBack, action, leftAction, rightAction, centerTitle }: PageShellProps) {
  const [location, setLocation] = useLocation();
  const { t } = useT();
  const accent = accentForPath(location);
  const { toggle: toggleSidebar } = useSidebar();

  // Step back through real history (4 → 3 → 2 → 1) when the user navigated
  // here inside the app; fall back to the page's fixed `back` target when the
  // app was opened directly on this page (so we never exit the app).
  const goBack = () => {
    if (canGoBack()) {
      window.history.back();
    } else if (back) {
      setLocation(back);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <OfflineBanner />

      {/* Header */}
      <header className={cn(accent.header, "text-foreground sticky top-0 z-20 border-b border-border/60")}>
        <div className="relative flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {/* Back button — mobile only. On wide/web screens the persistent
                sidebar + always-visible toggle already cover navigation, so
                a back arrow next to it is redundant clutter. */}
            {back && (
              <button
                onClick={goBack}
                className={cn("lg:hidden p-1 -ml-1 rounded-lg transition-colors", accent.hover)}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {!back && onBack && (
              <button
                onClick={onBack}
                className={cn("lg:hidden p-1 -ml-1 rounded-lg transition-colors", accent.hover)}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {/* Drawer menu on mobile — only on root pages (no back button),
                since sub-pages there are reached via the drawer itself. */}
            {!back && !onBack && (
              <div className="lg:hidden">
                <AppMenu />
              </div>
            )}
            {/* Persistent-sidebar toggle on wide/web screens — available on
                every page, not just root ones, so it can be collapsed/expanded
                no matter where you are in the app. */}
            <button
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              className={cn("hidden lg:inline-flex p-1.5 -ml-1.5 rounded-lg transition-colors", accent.hover)}
            >
              <Menu className="h-6 w-6" />
            </button>
            {leftAction}
            {!centerTitle && (
              <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>
            )}
          </div>
          {centerTitle && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center max-w-[70%]">
              <h1
                className="text-3xl truncate leading-normal font-bold uppercase tracking-[0.02em] text-primary"
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: "0 0 6px rgba(255,255,255,0.9), 0 1px 2px rgba(35,31,58,0.15)",
                }}
              >
                {title}
              </h1>
            </div>
          )}
          <div className="flex items-center gap-3">
            {/* On small screens this collides with the centered title (see
                centerTitle above) — only show it once there's room. */}
            <div className="hidden sm:block">
              <SyncIndicator />
            </div>
            {action}
            {rightAction}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        {children}
      </main>

      {/* Bottom Nav — mobile/small screens only; wide/web screens use the
          persistent sidebar instead (see components/sidebar.tsx). */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 bg-[#231F3A] rounded-[2rem] shadow-xl z-20 overflow-hidden">
        <div className="flex w-full px-2 py-2">
          {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link key={href} href={href} className="flex-1 min-w-0 flex items-center justify-center">
                <button
                  className={cn(
                    "flex items-center justify-center gap-1.5 transition-all duration-300 w-full min-w-0",
                    active
                      ? "bg-[#DDE2FF] text-[#231F3A] px-3 py-2.5 rounded-full"
                      : "text-white/60 hover:text-white/90 p-2"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
                  {active && (
                    <span className="text-[11px] font-semibold leading-none truncate min-w-0">{t(key)}</span>
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
