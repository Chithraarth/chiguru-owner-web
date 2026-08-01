import { Link } from "wouter";
import { Sprout, Store, Tractor } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useT } from "@/lib/i18n";

// Simple hub page: three tiles linking to the browse-only boards. All posting
// happens from My Ads (the central "Post an ad" chooser).

export default function Shop() {
  const { t } = useT();

  return (
    <PageShell title="Shop" back="/">
      <div className="p-4 grid grid-cols-2 gap-3">
        <Link href="/nursery">
          <div className="bg-primary/10 rounded-2xl p-4 flex flex-col items-center text-center gap-2 active:scale-95 transition-transform">
            <div className="bg-white/50 rounded-xl p-2.5">
              <Sprout className="h-7 w-7 text-primary" />
            </div>
            <span className="text-sm font-bold text-primary leading-tight">{t("more.nursery")}</span>
          </div>
        </Link>
        <Link href="/marketplace">
          <div className="bg-accent rounded-2xl p-4 flex flex-col items-center text-center gap-2 active:scale-95 transition-transform">
            <div className="bg-white/50 rounded-xl p-2.5">
              <Store className="h-7 w-7 text-accent-foreground" />
            </div>
            <span className="text-sm font-bold text-accent-foreground leading-tight">{t("more.market")}</span>
          </div>
        </Link>
        <Link href="/equipment">
          <div className="bg-secondary rounded-2xl p-4 flex flex-col items-center text-center gap-2 active:scale-95 transition-transform">
            <div className="bg-white/50 rounded-xl p-2.5">
              <Tractor className="h-7 w-7 text-secondary-foreground" />
            </div>
            <span className="text-sm font-bold text-secondary-foreground leading-tight">{t("more.equipment")}</span>
          </div>
        </Link>
      </div>
    </PageShell>
  );
}
