import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, UserPlus, Trash2, Smartphone, Clock, CheckCircle2, Lock } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DIAL_CODES, flagEmoji } from "@/lib/dial-codes";

interface ManagerRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  status: "pending" | "active" | "removed";
  createdAt: string;
  activatedAt: string | null;
}

type ContactMode = "phone" | "email";

// Page title/copy say "Invitees" - route and file keep the historical
// "manager-devices" name to avoid a wider rename for this change.
export default function ManagerDevices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<ContactMode>("phone");
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const { data: managers = [], isLoading } = useQuery<ManagerRow[]>({
    queryKey: ["managers"],
    queryFn: () => apiFetch("/managers"),
  });

  const addManager = useMutation({
    mutationFn: () =>
      apiMutate<ManagerRow>("POST", "/managers", {
        name: name.trim(),
        ...(mode === "phone" ? { phone: `${dialCode}${phone.trim()}` } : { email: email.trim() }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managers"] });
      setAdding(false);
      setName("");
      setPhone("");
      setEmail("");
      toast({
        title: "Invitee added",
        description:
          mode === "phone"
            ? "They can now sign in with this phone number."
            : "They can now sign in with this email address.",
        variant: "success",
      });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.body?.message ?? err.message : "Could not send invite";
      toast({ title: message, variant: "destructive" });
    },
  });

  const removeManager = useMutation({
    mutationFn: (id: number) => apiMutate("DELETE", `/managers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managers"] });
      toast({ title: "Invitee removed", description: "Their seat is now free to reassign.", variant: "success" });
    },
    onError: () => toast({ title: "Could not remove invitee", variant: "destructive" }),
  });

  const visible = managers.filter((m) => m.status !== "removed");
  const activeCount = managers.filter((m) => m.status === "active").length;
  const isGated = addManager.isError && addManager.error instanceof ApiError && addManager.error.body?.code === "NO_SEATS_AVAILABLE";
  const canSubmit = name.trim() && (mode === "phone" ? phone.trim() : email.trim());

  return (
    <PageShell title="Invitees" back="/">
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary to-violet-500 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            <h2 className="font-bold">Invite someone to your farm</h2>
          </div>
          <p className="text-primary-foreground/80 text-sm mt-1 leading-relaxed">
            Add their name and a phone number or email — they sign in with that
            same phone/email from their own device, no password needed. They
            can mark attendance and post daily work; everything flows back to you.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {visible.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
                {visible.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {m.status === "active" ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.phone ?? m.email}</p>
                      <p className="text-xs mt-0.5">
                        {m.status === "active" ? (
                          <span className="text-primary font-medium">Active — signed in</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Waiting for first sign-in</span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="h-9 w-9 p-0 text-gray-400 hover:text-red-600"
                      disabled={removeManager.isPending}
                      onClick={() => removeManager.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {isGated && (
              <div className="bg-white rounded-2xl p-5 border-2 border-amber-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-amber-600" />
                  <h2 className="font-bold text-gray-900">No seats available</h2>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  You have {activeCount} active invitee{activeCount === 1 ? "" : "s"} using all your purchased seats.
                  Buy more seats to add another invitee.
                </p>
                <Button
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setLocation("/subscription")}
                >
                  Buy invitee seats
                </Button>
              </div>
            )}

            {adding ? (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                <div>
                  <Label className="text-xs text-gray-500">Their name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11 mt-1" placeholder="e.g. Ramesh" />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("phone")}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium border ${
                      mode === "phone" ? "bg-primary text-primary-foreground border-primary" : "border-input text-gray-600"
                    }`}
                  >
                    Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("email")}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium border ${
                      mode === "email" ? "bg-primary text-primary-foreground border-primary" : "border-input text-gray-600"
                    }`}
                  >
                    Email
                  </button>
                </div>

                {mode === "phone" ? (
                  <div>
                    <Label className="text-xs text-gray-500">Phone number</Label>
                    <div className="flex gap-2 mt-1">
                      <select
                        value={dialCode}
                        onChange={(e) => setDialCode(e.target.value)}
                        className="rounded-xl h-11 border border-input bg-transparent px-2 text-sm shrink-0 max-w-28 truncate"
                        aria-label="Country code"
                      >
                        {DIAL_CODES.map((d) => (
                          <option key={`${d.iso2}-${d.dial}`} value={d.dial}>
                            {flagEmoji(d.iso2)} {d.name} ({d.dial})
                          </option>
                        ))}
                      </select>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="rounded-xl h-11 flex-1"
                        placeholder="98765 43210"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-gray-500">Email address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl h-11 mt-1"
                      placeholder="name@example.com"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={addManager.isPending || !canSubmit}
                    onClick={() => addManager.mutate()}
                  >
                    {addManager.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-primary/30 text-primary"
                onClick={() => setAdding(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" /> Invite someone
              </Button>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
