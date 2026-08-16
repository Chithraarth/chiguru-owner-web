import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserCircle2, ShieldCheck, Copy, Check, LogOut, Loader2,
  CloudUpload, CloudOff, Phone, RotateCcw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { signOutUser } from "@/lib/firebase";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate, apiUrl } from "@/lib/api";
import { useEstate } from "@/lib/use-estate";
import { useT } from "@/lib/i18n";

interface LinkedFarm {
  id: number;
  farmName: string;
  village: string | null;
  district: string | null;
}

export default function ProfilePage() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const { activeEstateId, setActiveEstate } = useEstate();

  // ── Contact phone (stored on the farm profile) ──
  const { data: farmProfile } = useQuery<{ contactPhone: string | null; alternatePhone: string | null }>({
    queryKey: ["farm-profile"],
    queryFn: () => apiFetch("/farm/profile"),
  });
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [phoneDirty, setPhoneDirty] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (!phoneDirty && farmProfile) {
      setPhone(farmProfile.contactPhone ?? "");
      setAltPhone(farmProfile.alternatePhone ?? "");
    }
  }, [farmProfile, phoneDirty]);

  async function savePhone() {
    setSavingPhone(true);
    try {
      const result = await apiMutate("PATCH", "/farm/profile", { contactPhone: phone.trim(), alternatePhone: altPhone.trim() || null });
      await qc.invalidateQueries({ queryKey: ["farm-profile"] });
      setPhoneDirty(false);
      // apiMutate returns null when the change was queued offline — be honest about it.
      toast({ title: result === null ? t("profile.savedOffline") : t("profile.saved") });
    } catch {
      toast({ title: "Could not save — check your internet.", variant: "destructive" });
    } finally {
      setSavingPhone(false);
    }
  }

  // ── Farms linked to the signed-in account ──
  const { data: myFarms, refetch: refetchFarms } = useQuery<LinkedFarm[]>({
    queryKey: ["me-farms", user?.uid],
    queryFn: () => apiFetch("/me/farms"),
    enabled: !!user,
  });

  const activeLinked = !!myFarms?.some((f) => f.id === activeEstateId);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const autoLinkTried = useRef(false);

  async function linkFarm(auto = false) {
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(apiUrl("/me/link-farm"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeEstateId != null ? { "X-Estate-Id": String(activeEstateId) } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Could not back up this farm.");
      }
      await refetchFarms();
      if (!auto) toast({ title: t("profile.farmLinked") });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not back up this farm.";
      setLinkError(msg);
      if (!auto) toast({ title: msg, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  }

  // Auto-link once: signing in should quietly tie the current farm to the account.
  useEffect(() => {
    if (user && myFarms && !activeLinked && !autoLinkTried.current) {
      autoLinkTried.current = true;
      void linkFarm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, myFarms, activeLinked]);

  // ── Backup code (moved here from Settings) ──
  const [code, setCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [restoreCode, setRestoreCode] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<{ recoveryCode: string }>("/backup/code")
      .then((r) => { if (alive) setCode(r.recoveryCode); })
      .catch(() => { if (alive) setCode(null); })
      .finally(() => { if (alive) setCodeLoading(false); });
    return () => { alive = false; };
  }, []);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy — please write it down", variant: "destructive" });
    }
  }

  async function handleRestore() {
    if (!restoreCode.trim()) return;
    setRestoring(true);
    try {
      const res = await apiFetch<{ estateId: number; farmName: string }>("/backup/restore", {
        method: "POST",
        body: JSON.stringify({ code: restoreCode.trim() }),
      });
      await qc.invalidateQueries({ queryKey: ["estates"] });
      setActiveEstate(res.estateId);
      toast({ title: `Restored: ${res.farmName}` });
      navigate("/");
    } catch {
      toast({ title: t("profile.restoreFail"), variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  }

  function openFarm(id: number) {
    setActiveEstate(id);
    toast({ title: t("profile.openFarm") });
    navigate("/");
  }

  return (
    <PageShell title={t("profile.title")} back="/">
      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Account card */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="h-14 w-14 rounded-full border border-gray-200" />
              ) : (
                <UserCircle2 className="h-14 w-14 text-gray-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-800 truncate">{user?.displayName || user?.phoneNumber || "—"}</p>
                <p className="text-sm text-gray-500 truncate">{user?.email ?? ""}</p>
              </div>
            </div>
            <button
              onClick={() => void signOutUser()}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl h-11 border border-red-200 text-red-600 font-medium hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              {t("profile.signOut")}
            </button>
          </section>
        )}

        {/* Farm backup status */}
        {user && (
          <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl p-2.5 flex-shrink-0 ${activeLinked ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                {activeLinked ? <CloudUpload className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-800">{t("profile.farmBackup")}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {activeLinked ? t("profile.farmLinked") : linkError ?? t("profile.farmNotLinked")}
                </p>
                {!activeLinked && (
                  <Button
                    onClick={() => linkFarm(false)}
                    disabled={linking}
                    className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11"
                  >
                    {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : t("profile.linkNow")}
                  </Button>
                )}
                {myFarms && myFarms.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t("profile.myFarms")}</p>
                    <div className="mt-1.5 space-y-1.5">
                      {myFarms.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate capitalize">{f.farmName}</p>
                            {(f.village || f.district) && (
                              <p className="text-xs text-gray-400 truncate">{[f.village, f.district].filter(Boolean).join(", ")}</p>
                            )}
                          </div>
                          {f.id === activeEstateId ? (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Button variant="outline" onClick={() => openFarm(f.id)} className="h-8 rounded-lg px-3 text-xs">
                              {t("profile.openFarm")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Phone number */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-xl p-2.5 flex-shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">{t("profile.phone")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("profile.phoneHint")}</p>
              <div className="mt-3 space-y-2">
                <Input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneDirty(true); }}
                  placeholder="98765 43210"
                  inputMode="tel"
                  maxLength={20}
                  className="rounded-xl h-11"
                />
                <div>
                  <Label htmlFor="alt-phone" className="text-xs text-gray-500">{t("profile.altPhone")}</Label>
                  <Input
                    id="alt-phone"
                    value={altPhone}
                    onChange={(e) => { setAltPhone(e.target.value); setPhoneDirty(true); }}
                    placeholder="98765 43210"
                    inputMode="tel"
                    maxLength={20}
                    className="rounded-xl h-11 mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-400">{t("profile.altPhoneHint")}</p>
                </div>
                <Button
                  onClick={savePhone}
                  disabled={savingPhone || !phoneDirty}
                  className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                >
                  {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : t("profile.save")}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Backup code — this farm's own recovery code, plus restoring a
            different farm by its code (e.g. claiming a farm created before
            this account existed). Independent of sign-in, which is mandatory
            now, so no longer conditional on being signed out. */}
        {!loading && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary rounded-xl p-2.5 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-800">{t("profile.backupCode")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("profile.backupCodeHint")}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-mono text-base tracking-wider text-gray-800 text-center">
                  {codeLoading ? "…" : code ?? t("profile.codeOffline")}
                </div>
                <Button
                  variant="outline"
                  onClick={copyCode}
                  disabled={!code}
                  className="rounded-xl h-12 w-12 p-0 flex-shrink-0"
                  aria-label="Copy backup code"
                >
                  {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-700">
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm font-medium">{t("profile.restoreTitle")}</span>
                </div>
                <div className="mt-2 space-y-2">
                  <Label htmlFor="restore-code" className="sr-only">Backup code</Label>
                  <Input
                    id="restore-code"
                    value={restoreCode}
                    onChange={(e) => setRestoreCode(e.target.value)}
                    placeholder="FARM-XXXX-XXXX"
                    autoCapitalize="characters"
                    className="rounded-xl h-11 font-mono tracking-wider"
                  />
                  <Button
                    onClick={handleRestore}
                    disabled={restoring || !restoreCode.trim()}
                    variant="outline"
                    className="w-full rounded-xl h-11"
                  >
                    {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : t("profile.restoreCta")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        )}
      </div>
    </PageShell>
  );
}
