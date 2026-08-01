import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiMutate } from "@/lib/api";
import { newLocalId } from "@/lib/offline-db";
import { fmtMoney } from "@/lib/currency";
import { activePayMethods, buildUpiLink, looksLikeUpiId, type PayMethod } from "@/lib/pay-methods";

interface WorkerLite {
  id: number;
  name: string;
  upiId?: string | null;
}

interface PaySheetProps {
  /** Group this payment belongs to (null = general, no group). */
  groupId: number | null;
  groupName: string;
  /** Saved payee handle of the group contractor, if any. */
  groupUpiId?: string | null;
  /** Prefill amount (e.g. this week's due or the final balance). */
  suggestedAmount?: number;
  onClose: () => void;
}

/**
 * Bottom sheet to pay a work group's contractor or an individual worker.
 * SAFETY: this app never moves money. UPI opens the owner's own payment app
 * (PhonePe / Google Pay / Paytm / any UPI app) where the owner confirms with
 * their own PIN; every other method is paid outside and recorded here.
 */
export function PaySheet({ groupId, groupName, groupUpiId, suggestedAmount, onClose }: PaySheetProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const methods = useMemo(() => activePayMethods(), []);

  const { data: workers = [] } = useQuery<WorkerLite[]>({
    queryKey: ["workers"],
    queryFn: () => apiFetch("/workers"),
  });

  // Payee: whole group (contractor / maistry) or one worker.
  const [payeeKind, setPayeeKind] = useState<"group" | "worker">(groupId != null ? "group" : "worker");
  const [workerId, setWorkerId] = useState<number | "">("");
  const [method, setMethod] = useState<PayMethod>(methods[0]);
  const [amount, setAmount] = useState(suggestedAmount && suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : "");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [upiOpened, setUpiOpened] = useState(false);
  // One idempotency key per sheet-open: an immediate POST and a queued retry of
  // the same submit carry the same key, so the server never duplicates the row.
  const [clientId] = useState(() => newLocalId());

  const selectedWorker = workers.find((w) => w.id === workerId);
  const payeeName = payeeKind === "group" ? groupName : selectedWorker?.name ?? "";

  // Prefill the saved handle whenever the payee changes.
  useEffect(() => {
    if (payeeKind === "group") setHandle(groupUpiId ?? "");
    else setHandle(selectedWorker?.upiId ?? "");
    setUpiOpened(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payeeKind, workerId]);

  const amt = parseFloat(amount);
  const amountOk = Number.isFinite(amt) && amt > 0;
  const needsWorker = payeeKind === "worker" && !selectedWorker;
  const upiHandleOk = method.id !== "upi" || looksLikeUpiId(handle);
  const canSave = amountOk && !needsWorker && payeeName.trim().length > 0 && upiHandleOk;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const saved = await apiMutate("POST", "/worker-payments", {
        workGroupId: groupId,
        workerId: payeeKind === "worker" ? workerId : null,
        payeeName,
        amount: amt,
        method: method.id,
        methodLabel: method.label,
        payeeHandle: handle.trim() || null,
        paymentDate: new Date().toISOString().slice(0, 10),
        note: note.trim() || null,
        clientId,
      });
      qc.invalidateQueries({ queryKey: ["worker-payments"] });
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["work-groups"] });
      // apiMutate returns null when the write was queued offline — be honest
      // about that for a money record.
      if (saved == null) {
        toast({ title: "Saved offline", description: "The payment record will sync when you're back online." });
      } else {
        toast({ title: "Payment recorded", description: `${fmtMoney(amt, 0)} to ${payeeName}` });
      }
      onClose();
    } catch {
      toast({ title: "Could not save payment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-5 pb-8 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Pay Workers</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Payee */}
          <div>
            <Label>Pay to</Label>
            <div className="flex gap-2 mt-1.5">
              {groupId != null && (
                <button
                  type="button"
                  onClick={() => setPayeeKind("group")}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border text-left ${
                    payeeKind === "group" ? "bg-primary text-primary-foreground border-primary" : "border-gray-200 text-gray-700"
                  }`}
                >
                  👥 Whole group<br />
                  <span className={`text-xs font-normal ${payeeKind === "group" ? "opacity-80" : "text-gray-400"}`}>{groupName}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPayeeKind("worker")}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border text-left ${
                  payeeKind === "worker" ? "bg-primary text-primary-foreground border-primary" : "border-gray-200 text-gray-700"
                }`}
              >
                🧑‍🌾 One worker<br />
                <span className={`text-xs font-normal ${payeeKind === "worker" ? "opacity-80" : "text-gray-400"}`}>Pick by name</span>
              </button>
            </div>
            {payeeKind === "worker" && (
              <select
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">Select worker…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Amount */}
          <div>
            <Label>Amount *</Label>
            <Input
              className="mt-1"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="e.g. 2500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Method */}
          <div>
            <Label>How are you paying?</Label>
            <div className="space-y-2 mt-1.5">
              {methods.map((m) => (
                <button
                  type="button"
                  key={m.label}
                  onClick={() => { setMethod(m); setUpiOpened(false); }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left ${
                    method.label === m.label ? "border-primary bg-primary/5" : "border-gray-200"
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">{m.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-800">{m.label}</span>
                    {m.hint && <span className="block text-xs text-gray-400 mt-0.5">{m.hint}</span>}
                  </span>
                  {method.label === m.label && <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Payee handle for digital methods */}
          {method.id !== "cash" && method.handlePlaceholder && (
            <div>
              <Label>{method.id === "upi" ? "Worker's UPI ID *" : "Payee details"}</Label>
              <Input
                className="mt-1"
                placeholder={method.handlePlaceholder}
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setUpiOpened(false); }}
              />
              {method.id === "upi" && handle.trim() !== "" && !looksLikeUpiId(handle) && (
                <p className="text-xs text-amber-600 mt-1">A UPI ID looks like name@ybl or 9876543210@upi</p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">Saved with the {payeeKind === "group" ? "group" : "worker"} — next time it's already filled in.</p>
            </div>
          )}

          {/* UPI deep link */}
          {method.id === "upi" && (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-600 leading-snug">
                This opens <b>your own UPI app</b> (PhonePe, Google Pay, Paytm…) with the payee and amount filled in.
                You check everything and confirm with <b>your PIN</b> — Chiguru never touches your money.
              </p>
              <a
                href={amountOk && looksLikeUpiId(handle) ? buildUpiLink(handle, payeeName, amt) : undefined}
                onClick={(e) => {
                  if (!amountOk || !looksLikeUpiId(handle)) {
                    e.preventDefault();
                    toast({ title: "Enter amount and a valid UPI ID first", variant: "destructive" });
                    return;
                  }
                  setUpiOpened(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold"
              >
                <ExternalLink size={15} /> Open UPI app to pay {amountOk ? fmtMoney(amt, 0) : ""}
              </a>
              {upiOpened && (
                <p className="text-xs text-primary font-medium">After paying in your UPI app, come back and tap "Mark as paid" below.</p>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <Label>Note</Label>
            <Input className="mt-1" placeholder="e.g. Week of 13 Jul, harvest wages" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button className="w-full" disabled={!canSave || saving} onClick={save}>
            {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
            {method.id === "cash" ? "Record cash payment" : method.id === "upi" ? "Mark as paid & save" : "Record payment"}
          </Button>
          <p className="text-[11px] text-gray-400 text-center leading-snug">
            Chiguru keeps your payment record safe on the farm ledger. Money always moves only through your own bank / payment app.
          </p>
        </div>
      </div>
    </div>
  );
}
