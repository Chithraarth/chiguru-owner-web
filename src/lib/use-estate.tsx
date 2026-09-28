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
  const [activeId, setActiveId] = useState<number | null>(() => {
    const raw = getActiveEstateId();
    return raw ? Number(raw) : null;
  });

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
    if (myEstates.length !== 1) return;
    const only = myEstates[0].id;
    setActiveId(only);
    try {
      localStorage.setItem(ACTIVE_ESTATE_KEY, String(only));
    } catch {
      /* ignore */
    }
    // The active estate changed (e.g. the previous one was deleted), so every
    // estate-scoped query is now stale — refetch all but the estate lists.
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "estates" && q.queryKey[0] !== "my-estates" });
  }, [myEstates, myEstatesLoaded, activeId, ownFarmSetup, qc]);

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
      // Every data query carries the estate via header, so switching estates must
      // refetch everything except the estate lists themselves.
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "estates" && q.queryKey[0] !== "my-estates",
      });
    },
    [qc],
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
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "my-estates" });
  }, [qc]);

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
