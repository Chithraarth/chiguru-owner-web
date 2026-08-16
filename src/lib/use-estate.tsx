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

interface EstateContextValue {
  estates: Estate[];
  activeEstateId: number | null;
  activeEstate: Estate | null;
  setActiveEstate: (id: number) => void;
  isLoading: boolean;
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
  const [signedIn, setSignedIn] = useState(() => auth.currentUser != null);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(u != null)), []);

  const { data: estates = [], isLoading } = useQuery<Estate[]>({
    queryKey: ["estates"],
    queryFn: () => apiFetch("/estates"),
    enabled: signedIn,
  });

  // Default the active estate to the first one once estates load and none is
  // chosen yet (or the stored id no longer exists, e.g. after a delete).
  useEffect(() => {
    if (estates.length === 0) return;
    const exists = activeId != null && estates.some((e) => e.id === activeId);
    if (!exists) {
      const first = estates[0].id;
      setActiveId(first);
      try {
        localStorage.setItem(ACTIVE_ESTATE_KEY, String(first));
      } catch {
        /* ignore */
      }
      // The active estate changed (e.g. the previous one was deleted), so every
      // estate-scoped query is now stale — refetch all but the estate list.
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "estates" });
    }
  }, [estates, activeId, qc]);

  const setActiveEstate = useCallback(
    (id: number) => {
      try {
        localStorage.setItem(ACTIVE_ESTATE_KEY, String(id));
      } catch {
        /* ignore */
      }
      setActiveId(id);
      // Every data query carries the estate via header, so switching estates must
      // refetch everything except the estate list itself.
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "estates",
      });
    },
    [qc],
  );

  const activeEstate =
    estates.find((e) => e.id === activeId) ?? null;

  return (
    <EstateContext.Provider
      value={{
        estates,
        activeEstateId: activeId,
        activeEstate,
        setActiveEstate,
        isLoading,
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
