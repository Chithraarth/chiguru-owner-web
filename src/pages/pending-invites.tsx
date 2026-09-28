import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, apiMutate } from "@/lib/api";

interface PendingInvite {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  farmName: string | null;
  createdAt: string;
}

// Shown right after sign-in, before the Dashboard/Choose Estate step,
// whenever this person has one or more invites addressed to their own
// phone/email that they haven't yet accepted or declined. An invite gives no
// access at all until acted on here — see the backend's routes/invites.ts.
export default function PendingInvites({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data: invites = [], isLoading } = useQuery<PendingInvite[]>({
    queryKey: ["my-invites"],
    queryFn: () => apiFetch("/me/invites"),
  });

  const accept = useMutation({
    mutationFn: (id: number) => apiMutate("POST", `/me/invites/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-invites"] });
      qc.invalidateQueries({ queryKey: ["my-estates"] });
    },
  });
  const decline = useMutation({
    mutationFn: (id: number) => apiMutate("POST", `/me/invites/${id}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-invites"] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invites.length === 0) {
    onDone();
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-16">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">You've been invited</h1>
          <p className="text-sm text-gray-500 mt-1">
            Accept to help manage their farm, or decline if this isn't for you.
          </p>
        </div>

        <div className="space-y-3">
          {invites.map((invite) => {
            const busy = accept.isPending || decline.isPending;
            return (
              <div key={invite.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {invite.ownerName ?? invite.ownerEmail ?? invite.ownerPhone ?? "Someone"} invited you
                    </p>
                    <p className="text-xs text-gray-500">
                      {invite.farmName ? `To help manage "${invite.farmName}"` : "To help manage their farm"}
                    </p>
                    {invite.ownerName && (invite.ownerEmail || invite.ownerPhone) && (
                      <p className="text-xs text-gray-400 mt-0.5">{invite.ownerEmail ?? invite.ownerPhone}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    disabled={busy}
                    onClick={() => decline.mutate(invite.id)}
                  >
                    Decline
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={busy}
                    onClick={() => accept.mutate(invite.id)}
                  >
                    {accept.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
