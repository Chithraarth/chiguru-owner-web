import { createContext, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "sidebarOpen";

function readStored(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

interface SidebarContextValue {
  open: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Controls the persistent left sidebar shown on wide/web screens (hamburger
 * in the header toggles it). Mobile keeps the existing drawer-style AppMenu
 * instead — this state is irrelevant below the lg breakpoint.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(readStored);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // private mode / storage disabled — toggle still works for this session
      }
      return next;
    });
  }

  return <SidebarContext.Provider value={{ open, toggle }}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}
