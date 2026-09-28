import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ACTIVE_ESTATE_KEY, getActiveEstateId } from "./api";
import { setCurrentEstateId } from "./active-estate";
import { auth, onAuthStateChanged } from "./firebase";

export interface Estate {
  id: number;
  farmName: string;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  totalAcres?: string | null;
}

/** An estate as returned by /me/estates — tagged with how this person relates to it. */
export interface MyEstate extends Estate {
  ownerId: number;
  relationship: "own" | "invited";
}

interface EstateContextValue {
  estates: Estate[];
  activeEstateId: number | null;
  activeEstate: Estate | null;
  setActiveEstate: (id: number) => void;
  isLoading: boolean;
  /** Every estate this person may act on — their own + anything they're invited to. */
  myEstates: MyEstate[];
  myEstatesLoading: boolean;
  /**
   * Whether the active estate is this person's own or one they're invited
   * to — live from /me/estates, or the last-known value when that couldn't
   * load (offline), so an invitee still gets the invitee app.
   */
  activeRelationship: "own" | "invited" | null;
  /**
   * True after someone working on an invited farm chose "Set up my own farm":
   * no estate is active and the invited one isn't auto-picked again, so the
   * Owner app's own farm setup shows. Cleared by picking or creating a farm.
   */
  ownFarmSetup: boolean;
  startOwnFarmSetup: () => void;
  /** Forget the chosen farm (on sign-out / account switch) so the next sign-in asks again. */
  resetEstateChoice: () => void;
}

const ACTIVE_RELATIONSHIP_KEY = "activeEstateRelationship";
const OWN_FARM_SETUP_KEY = "ownFarmSetupRequested";

function readRememberedRelationship(): "own" | "invited" | null {
  try {
    const v = localStorage.getItem(ACTIVE_RELATIONSHIP_KEY);
    return v === "own" || v === "invited" ? v : null;
  } catch {
    return null;
  }
}

const EstateContext = createContext<EstateContextValue | null>(null);

export function EstateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [activeId, setActiveIdState] = useState<number | null>(() => {
    const raw = getActiveEstateId();
    return raw ? Number(raw) : null;
  });
  // State and the id API requests send must never differ - update both at once.
  const setActiveId = useCallback((id: number | null) => {
    setCurrentEstateId(id);
    setActiveIdState(id);
  }, []);

  // This provider sits above AuthProvider in the tree (so the whole app,
  // including the signed-out landing page, can render under it), so it can't
  // read useAuth() — it watches Firebase's own auth state directly instead,
  // purely to avoid firing an authenticated /estates call for a signed-out
  // visitor (who'd just get a 401 back).
  const [ownFarmSetup, setOwnFarmSetup] = useState(() => {
    try {
      return localStorage.getItem(OWN_FARM_SETUP_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [signedIn, setSignedIn] = useState(() => auth.currentUser != null);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(u != null)), []);

  const { data: estates = [], isLoading } = useQuery<Estate[]>({
    queryKey: ["estates"],
    queryFn: () => apiFetch("/estates"),
    enabled: signedIn,
  });

  // Unlike /estates (scoped to whichever owner X-Estate-Id already resolves
  // to), /me/estates lists every relationship this person has at once — used
  // by the Choose Estate page to offer "my farm" and/or "invited to" options
  // before any estate has been picked yet.
  const { data: myEstates = [], isLoading: myEstatesLoading, isSuccess: myEstatesLoaded } = useQuery<MyEstate[]>({
    queryKey: ["my-estates"],
    queryFn: () => apiFetch("/me/estates"),
    enabled: signedIn,
  });

  // Auto-pick the (only) estate when this person has exactly one
  // relationship, or self-heal a stale activeId (deleted farm, revoked
  // invite) back to it. When there's more than one, this deliberately does
  // NOT pick for them — the Choose Estate page (gated in App.tsx on
  // myEstates.length > 1 with no valid activeId) is what handles that case,
  // so this never races it into silently picking the wrong relationship.
  useEffect(() => {
    if (myEstates.length === 0) {
      // Nothing left to act on (farm deleted, invite revoked) - stop sending
      // a stale X-Estate-Id. Only after a successful load - a failed fetch
      // (e.g. offline) also leaves the list empty.
      if (myEstatesLoaded && activeId != null) {
        setActiveId(null);
        try {
          localStorage.removeItem(ACTIVE_ESTATE_KEY);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const exists = activeId != null && myEstates.some((e) => e.id === activeId);
    if (exists) return;
    if (ownFarmSetup) return;
    // Only a plain Owner with a single farm and no invites goes straight in;
    // anyone with an invited farm always picks on the Choose Estate page.
    if (myEstates.length !== 1 || myEstates[0].relationship !== "own") return;
    const only = myEstates[0].id;
    setActiveId(only);
    try {
      localStorage.setItem(ACTIVE_ESTATE_KEY, String(only));
    } catch {
      /* ignore */
    }
    // The active estate changed (e.g. the previous one was deleted), so every
    // estate-scoped query is now stale — refetch all but the estate lists.
    qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "my-estates" });
  }, [myEstates, myEstatesLoaded, activeId, ownFarmSetup, qc, setActiveId]);

  const setActiveEstate = useCallback(
    (id: number) => {
      try {
        localStorage.setItem(ACTIVE_ESTATE_KEY, String(id));
      } catch {
        /* ignore */
      }
      setActiveId(id);
      setOwnFarmSetup(false);
      try {
        localStorage.removeItem(OWN_FARM_SETUP_KEY);
      } catch {
        /* ignore */
      }
      // Every data query carries the estate via header, so switching estates
      // resets (not just refetches) everything but the /me/estates list -
      // a refetch that fails (e.g. 404, no farm) would otherwise keep showing
      // the previous farm's data.
      qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "my-estates" });
    },
    [qc, setActiveId],
  );

  const activeEstate =
    estates.find((e) => e.id === activeId) ?? null;

  const liveRelationship = myEstates.find((e) => e.id === activeId)?.relationship ?? null;
  const [rememberedRelationship, setRememberedRelationship] = useState(readRememberedRelationship);
  useEffect(() => {
    if (!liveRelationship) return;
    setRememberedRelationship(liveRelationship);
    try {
      localStorage.setItem(ACTIVE_RELATIONSHIP_KEY, liveRelationship);
    } catch {
      /* ignore */
    }
  }, [liveRelationship]);
  const activeRelationship = myEstatesLoaded ? liveRelationship : rememberedRelationship;

  const startOwnFarmSetup = useCallback(() => {
    try {
      localStorage.setItem(OWN_FARM_SETUP_KEY, "1");
      localStorage.removeItem(ACTIVE_ESTATE_KEY);
      localStorage.removeItem(ACTIVE_RELATIONSHIP_KEY);
    } catch {
      /* ignore */
    }
    setOwnFarmSetup(true);
    setActiveId(null);
    setRememberedRelationship(null);
    qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "my-estates" });
  }, [qc, setActiveId]);

  const resetEstateChoice = useCallback(() => {
    try {
      localStorage.removeItem(ACTIVE_ESTATE_KEY);
      localStorage.removeItem(ACTIVE_RELATIONSHIP_KEY);
      localStorage.removeItem(OWN_FARM_SETUP_KEY);
    } catch {
      /* ignore */
    }
    setActiveId(null);
    setRememberedRelationship(null);
    setOwnFarmSetup(false);
  }, [setActiveId]);

  // Another tab switched farm (or started own-farm setup): follow it, so two
  // tabs never show one farm while acting on another.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === ACTIVE_ESTATE_KEY) {
        setActiveId(e.newValue ? Number(e.newValue) : null);
        qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "my-estates" });
      } else if (e.key === OWN_FARM_SETUP_KEY) {
        setOwnFarmSetup(e.newValue === "1");
      } else if (e.key === ACTIVE_RELATIONSHIP_KEY) {
        setRememberedRelationship(e.newValue === "own" || e.newValue === "invited" ? e.newValue : null);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc, setActiveId]);

  return (
    <EstateContext.Provider
      value={{
        estates,
        activeEstateId: activeId,
        activeEstate,
        setActiveEstate,
        isLoading,
        myEstates,
        myEstatesLoading,
        activeRelationship,
        ownFarmSetup,
        startOwnFarmSetup,
        resetEstateChoice,
      }}
    >
      {children}
    </EstateContext.Provider>
  );
}

export function useEstate(): EstateContextValue {
  const ctx = useContext(EstateContext);
  if (!ctx) throw new Error("useEstate must be used within EstateProvider");
  return ctx;
}
