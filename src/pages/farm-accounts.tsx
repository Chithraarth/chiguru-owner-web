import { Link } from "wouter";
import {
  Banknote, Leaf, BarChart3, Users, Camera, Archive
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useT } from "@/lib/i18n";

const ACCOUNTS = [
  { href: "/expenses", icon: Banknote, key: "home.expenses", chip: "bg-[#E9E6FB] text-[#6C5DD3]" },
  { href: "/harvests", icon: Leaf, key: "home.harvest", chip: "bg-[#D5F1EE] text-[#1F9E92]" },
  { href: "/reports", icon: BarChart3, key: "home.reports", chip: "bg-[#F3DBF5] text-[#B45BC7]" },
  { href: "/labour-attendance", icon: Users, key: "farmAcct.labourAttendance", chip: "bg-[#D5F1EE] text-[#1F9E92]" },
  { href: "/labour-payments", icon: Banknote, key: "farmAcct.labourPay", chip: "bg-[#E2E8FA] text-[#4F63D2]" },
  { href: "/loans", icon: Banknote, key: "more.loans", chip: "bg-[#FBE3E8] text-[#D4526E]" },
  { href: "/old-ledger", icon: Archive, key: "farmAcct.oldLedger", chip: "bg-[#FBF0DB] text-[#C08A2D]" },
];

export default function FarmAccounts() {
  const { t } = useT();

  return (
    <PageShell title={t("home.farmAccounts")} back="/">
      <div className="p-4 flex flex-col gap-3">

        <Link href="/accounts-scan">
          <div className="bg-primary rounded-3xl p-5 text-primary-foreground shadow-md active:scale-95 transition-transform">
            <div className="flex items-center gap-4">
              <div className="bg-white/15 rounded-full p-3.5">
                <Camera className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold leading-tight">{t("farmAcct.scan")}</p>
                <p className="text-primary-foreground/80 text-sm mt-1 leading-snug">{t("farmAcct.scanSub")}</p>
              </div>
            </div>
          </div>
        </Link>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">{t("farmAcct.currentRecords")}</p>

        <div className="grid grid-cols-1 min-[481px]:grid-cols-2 min-[768px]:grid-cols-5 gap-3">
          {ACCOUNTS.map(({ href, icon: Icon, key, chip }) => (
            <Link key={href} href={href}>
              <div className="bg-card rounded-3xl p-4 h-full flex items-center min-[768px]:flex-col min-[768px]:items-start gap-4 min-[768px]:gap-3 shadow-sm border border-border/60 active:scale-95 transition-transform">
                <div className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center ${chip}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-lg min-[768px]:text-base font-bold leading-tight text-foreground">{t(key)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
