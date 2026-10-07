import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Chiguru staff (owners.role = 'ADMIN'). Only they see operations screens -
 * doctor earnings & payouts, nursery vendor moderation - and the server
 * refuses those actions for everyone else anyway.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const { data } = useQuery<{ owner?: { role?: string } }>({
    queryKey: ["owner-me", user?.uid],
    queryFn: () => apiFetch("/owners/me"),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
  return data?.owner?.role === "ADMIN";
}
