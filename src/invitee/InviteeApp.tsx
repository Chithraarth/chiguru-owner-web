import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEstate } from "@/lib/use-estate";
import { signOutUser } from "@/lib/firebase";
import { apiFetch, checkManagerSession, type ManagerMe } from "./api";
import { flushAll, getPendingCount } from "./offline-db";
import { refreshCurrency } from "./currency";
import type { Pairing } from "./pairing";
import { HomeScreen } from "./screens/home";
import { AttendanceScreen } from "./screens/attendance";
import { WorkUpdateScreen } from "./screens/work-update";
import { ExpenseScreen } from "./screens/expenses";
import { PlanScreen } from "./screens/plan";

type Screen = "home" | "attendance" | "work-update" | "expense" | "plan";

const LAST_SYNC_KEY = "manager_last_sync_time";

// What someone sees while working on a farm they were invited to: exactly the
// old Manager app (ported from chiguru-manager-web), nothing from the Owner
// app. The backend enforces the same limits (middlewares/inviteeAccess.ts).
// Sign-in and the active farm come from the Owner app, so picking one of your
// own farms in the switcher returns to the full Owner app.
export function InviteeApp() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { myEstates, activeEstateId: activeId, setActiveEstate, startOwnFarmSetup } = useEstate();
  const hasOwnFarm = myEstates.some((e) => e.relationship === "own");
  const activeEstateId = activeId != null ? String(activeId) : null;
  const [screen, setScreen] = useState<Screen>("home");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? new Date(raw) : null;
  });

  // Who this person is on the active farm (the name its Owner gave them).
  const meQuery = useQuery<ManagerMe>({
    queryKey: ["invitee-me", activeEstateId],
    queryFn: () => apiFetch("/manager/me"),
  });
  const pairing: Pairing | null = meQuery.data
    ? { farmName: meQuery.data.farmName, managerName: meQuery.data.name }
    : null;

  // Keep the farm's currency in sync (the Owner sets it in their app).
  useEffect(() => {
    if (activeEstateId != null) void refreshCurrency();
  }, [activeEstateId]);

  function handleSwitchEstate(id: number) {
    setScreen("home");
    setActiveEstate(id);
  }

  // Renames the farm you're working on (the Owner sees the new name too).
  // Needs a connection — name edits aren't queued offline like field records.
  async function handleRenameEstate(id: number, farmName: string): Promise<boolean> {
    try {
      await apiFetch(`/estates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ farmName }),
      });
      await qc.invalidateQueries({ queryKey: ["my-estates"] });
      await qc.invalidateQueries({ queryKey: ["invitee-me"] });
      toast({ title: "Estate renamed", description: `Now called "${farmName}".` });
      return true;
    } catch {
      toast({
        title: "Could not rename",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
      return false;
    }
  }

  // The Owner removed this invite: refresh the farm list so the app moves to
  // whatever this person can still open (their own farm, or Choose Estate).
  const handleRevoked = useCallback(() => {
    setScreen("home");
    void qc.invalidateQueries({ queryKey: ["my-estates"] });
    toast({
      title: "Access to this farm was removed",
      description: "The owner removed your invite for this farm.",
      variant: "destructive",
    });
  }, [qc, toast]);

  const refreshPending = useCallback(() => {
    getPendingCount()
      .then(setPendingCount)
      .catch(() => {});
  }, []);

  // Flush queued work to the owner. Runs automatically (mount, "online" event)
  // and on demand from the home-screen "Sync now" button (manual=true).
  const runSync = useCallback(
    async ({ manual = false }: { manual?: boolean } = {}) => {
      // Automatic sync trusts navigator.onLine and skips when offline. The
      // manual button tries anyway — navigator.onLine is unreliable on
      // rural/captive networks, so we let the actual fetch decide.
      setIsOnline(navigator.onLine);
      if (!manual && !navigator.onLine) {
        refreshPending();
        return;
      }
      if (manual) setSyncing(true);
      try {
        // Queued records must NOT upload after the owner removed this invite.
        // Only a definitive rejection counts — a connectivity hiccup just waits.
        const verdict = await checkManagerSession();
        if (verdict === "invalid") {
          handleRevoked();
          return;
        }
        if (verdict !== "valid") {
          refreshPending();
          if (manual) {
            toast({
              title: "Still no connection",
              description: "Your data is safe on this phone. Try again when you have signal.",
              variant: "destructive",
            });
          }
          return;
        }
        const flushed = await flushAll();
        refreshPending();
        setIsOnline(true);
        // null = another sync is already in flight (single-flight guard).
        if (flushed === null) {
          if (manual) toast({ title: "Sync in progress", description: "Already uploading — hang tight." });
          return;
        }
        const now = new Date();
        localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
        setLastSyncTime(now);
        if (flushed > 0) {
          toast({
            title: `${flushed} update${flushed === 1 ? "" : "s"} uploaded`,
            description: "Records saved offline are now with the owner.",
          });
        } else if (manual) {
          toast({ title: "Everything is up to date", description: "Nothing was waiting to upload." });
        }
      } catch {
        if (manual) {
          toast({
            title: "Could not sync",
            description: "Could not reach the server. Try again shortly.",
            variant: "destructive",
          });
        }
      } finally {
        if (manual) setSyncing(false);
      }
    },
    [toast, refreshPending, handleRevoked],
  );

  // Keep the "saved offline" badge fresh and auto-sync when the network returns.
  useEffect(() => {
    refreshPending();
    void runSync();
    const onOnline = () => void runSync();
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", refreshPending);
    const interval = window.setInterval(refreshPending, 5000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", refreshPending);
      window.clearInterval(interval);
    };
  }, [runSync, refreshPending]);

  function handleExit() {
    if (window.confirm("Sign out? You'll need to sign in again to use Chiguru.")) {
      void signOutUser();
    }
  }

  if (!pairing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <Sprout className="h-8 w-8 text-white" />
        </div>
        {meQuery.isError ? (
          <p className="text-sm text-gray-600">Couldn't load this farm. Check your connection and try again.</p>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
      </div>
    );
  }

  if (screen === "attendance") {
    return (
      <AttendanceScreen
        pairing={pairing}
        activeEstateId={activeEstateId}
        onBack={() => setScreen("home")}
        onRevoked={handleRevoked}
        onRecorded={() => void runSync()}
      />
    );
  }
  if (screen === "work-update") {
    return (
      <WorkUpdateScreen
        pairing={pairing}
        onBack={() => setScreen("home")}
        onRevoked={handleRevoked}
        onRecorded={() => void runSync()}
      />
    );
  }
  if (screen === "expense") {
    return (
      <ExpenseScreen
        pairing={pairing}
        activeEstateId={activeEstateId}
        onBack={() => setScreen("home")}
        onRevoked={handleRevoked}
      />
    );
  }
  if (screen === "plan") {
    return <PlanScreen activeEstateId={activeEstateId} onBack={() => setScreen("home")} />;
  }

  return (
    <HomeScreen
      pairing={pairing}
      estates={myEstates}
      activeEstateId={activeEstateId}
      onSwitchEstate={handleSwitchEstate}
      onRenameEstate={handleRenameEstate}
      pendingCount={pendingCount}
      isOnline={isOnline}
      lastSyncTime={lastSyncTime}
      syncing={syncing}
      onSync={() => runSync({ manual: true })}
      onAttendance={() => setScreen("attendance")}
      onWorkUpdate={() => setScreen("work-update")}
      onExpense={() => setScreen("expense")}
      onPlan={() => setScreen("plan")}
      onExit={handleExit}
      onSetUpOwnFarm={hasOwnFarm ? undefined : startOwnFarmSetup}
    />
  );
}
