import { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, CreditCard, Trash2, ChevronDown, ChevronUp, Camera } from "lucide-react";
import { useForm } from "react-hook-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectOrType } from "@/components/select-or-type";
import { WorkerNameInput } from "@/components/worker-name-input";
import { GroupFolderList, buildGroupIds } from "@/components/group-folders";
import { apiFetch, apiMutate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { compressForRecord, fileToDataUrl } from "@/lib/photo";
import { LoanProofViewer, ProofBadge, type ProofLoan } from "@/components/loan-proof";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface Loan {
  id: number; workerId: number; workerName?: string; amount: number; interestPct: number;
  totalDue: number; issuedDate: string; repaidAmount: number; remainingAmount: number;
  repaymentMethod: string; status: string;
  workGroupId?: number | null; workGroupName?: string | null;
  proofPhotoUrl?: string | null; createdAt?: string;
}
interface Worker { id: number; name: string; isActive: boolean }
interface WorkGroup { id: number; name: string }

interface LoanForm {
  workerId: string; amount: string; interestPct: string;
  issuedDate: string; repaymentMethod: string; notes: string;
}
interface PaymentForm { amount: string; method: string; date: string }

const REPAYMENT_METHODS = ["salary deduction", "cash", "bank transfer", "installment"];

function fmt(n: number) {
  return fmtMoney(n, 0);
}

export default function Loans() {
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [payingLoanId, setPayingLoanId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loanWorker, setLoanWorker] = useState<{ name: string; id: number | null }>({ name: "", id: null });
  const [repayMethod, setRepayMethod] = useState("salary deduction");
  const [payMethod, setPayMethod] = useState("cash");
  const [openFolder, setOpenFolder] = useState<{ id: number | null; name: string } | null>(null);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  useSubScreenHistory(openFolder ? 1 : 0, () => setOpenFolder(null));
  const [viewProof, setViewProof] = useState<ProofLoan | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: () => apiFetch("/loans"),
  });
  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => apiFetch("/workers"),
  });
  const { data: workGroups = [] } = useQuery<WorkGroup[]>({
    queryKey: ["work-groups"],
    queryFn: () => apiFetch("/work-groups"),
  });

  const loanForm = useForm<LoanForm>({
    defaultValues: { interestPct: "0", issuedDate: new Date().toISOString().slice(0, 10), repaymentMethod: "salary deduction" }
  });
  const payForm = useForm<PaymentForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), method: "cash" }
  });

  const createLoan = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiMutate("POST", "/loans", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["group-loans"] });
      setShowLoanForm(false);
      loanForm.reset({ interestPct: "0", issuedDate: new Date().toISOString().slice(0, 10), repaymentMethod: "salary deduction" });
      setLoanWorker({ name: "", id: null }); setRepayMethod("salary deduction");
      setProofPhoto(null);
      toast({ title: "Loan recorded" });
    },
    onError: () => toast({ title: "Error saving loan", variant: "destructive" }),
  });

  const createPayment = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiMutate("POST", "/loan-payments", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["group-loans"] });
      setPayingLoanId(null);
      payForm.reset({ date: new Date().toISOString().slice(0, 10), method: "cash" });
      setPayMethod("cash");
      toast({ title: "Payment recorded" });
    },
    onError: () => toast({ title: "Error saving payment", variant: "destructive" }),
  });

  function invalidLoan() {
    toast({ title: "Please enter the loan amount", variant: "destructive" });
  }

  async function submitLoan(data: LoanForm) {
    const amt = parseFloat(data.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      invalidLoan();
      return;
    }
    const name = loanWorker.name.trim();
    if (!name) {
      toast({ title: "Please type the worker's name", variant: "destructive" });
      return;
    }
    // Prefer the picked/matched worker; otherwise create a new one by that name.
    let workerId = loanWorker.id
      ?? workers.find((w) => w.name.trim().toLowerCase() === name.toLowerCase())?.id
      ?? null;
    if (workerId == null) {
      try {
        const w = await apiMutate<Worker>("POST", "/workers", { name, isActive: true });
        if (!w) throw new Error("no response");
        qc.invalidateQueries({ queryKey: ["workers"] });
        workerId = w.id;
      } catch {
        toast({ title: "Could not add worker", variant: "destructive" });
        return;
      }
    }
    createLoan.mutate({
      workerId,
      workGroupId: openFolder?.id ?? undefined,
      amount: parseFloat(data.amount),
      interestPct: parseFloat(data.interestPct) || 0,
      issuedDate: data.issuedDate,
      repaymentMethod: repayMethod || "salary deduction",
      notes: data.notes || undefined,
      proofPhotoUrl: proofPhoto || undefined,
    });
  }

  async function onProofPicked(file: File | undefined) {
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      setProofPhoto(await compressForRecord(raw));
    } catch {
      toast({ title: "Could not read the photo", variant: "destructive" });
    }
  }

  function submitPayment(data: PaymentForm) {
    if (!payingLoanId) return;
    createPayment.mutate({
      loanId: payingLoanId,
      date: data.date,
      amount: parseFloat(data.amount),
      method: payMethod || "cash",
    });
  }

  // Folder list built automatically from Work Attendance groups (+ orphans).
  const groupList = buildGroupIds(workGroups, loans);
  const generalLoans = loans.filter((l) => l.workGroupId == null);

  // Each group folder shows the SAME loans as the group's Work Attendance
  // "Loans" tab: tagged to the group OR taken by a worker who attended it.
  const groupLoanQueries = useQueries({
    queries: groupList.map((g) => ({
      queryKey: ["group-loans", g.id],
      queryFn: async () => (await apiFetch(`/work-groups/${g.id}/loans`)) as Loan[],
    })),
  });
  const loansOfGroup = (gid: number): Loan[] => {
    const idx = groupList.findIndex((g) => g.id === gid);
    const data = idx >= 0 ? groupLoanQueries[idx]?.data : undefined;
    return data ?? loans.filter((l) => l.workGroupId === gid);
  };

  const folders = [
    ...groupList.map((g) => {
      const recs = loansOfGroup(g.id as number);
      const outstanding = recs.filter((l) => l.status === "active").reduce((s, l) => s + Number(l.remainingAmount), 0);
      return {
        id: g.id as number | null,
        name: g.name,
        subtitle: recs.length === 0 ? "No loans yet" : outstanding > 0 ? `${fmt(outstanding)} outstanding` : "All repaid",
        count: recs.length,
        emoji: "👥",
        iconBg: "bg-blue-50",
      };
    }),
    {
      id: null,
      name: "General Loans",
      subtitle: generalLoans.length === 0
        ? "Loans without a group"
        : (() => {
            const out = generalLoans.filter((l) => l.status === "active").reduce((s, l) => s + Number(l.remainingAmount), 0);
            return out > 0 ? `${fmt(out)} outstanding` : "All repaid";
          })(),
      count: generalLoans.length,
      emoji: "💰",
      iconBg: "bg-gray-100",
    },
  ];

  const folderLoans = openFolder
    ? openFolder.id != null
      ? loansOfGroup(openFolder.id)
      : generalLoans
    : loans;
  const activeLoans = folderLoans.filter((l) => l.status === "active");
  const closedLoans = folderLoans.filter((l) => l.status !== "active");
  const totalPending = activeLoans.reduce((s, l) => s + Number(l.remainingAmount), 0);
  const allOutstanding = loans.filter((l) => l.status === "active").reduce((s, l) => s + Number(l.remainingAmount), 0);

  function goToFolder(f: { id: number | null; name: string } | null) {
    setShowLoanForm(false);
    setPayingLoanId(null);
    setOpenFolder(f);
  }

  return (
    <PageShell
      title={openFolder ? openFolder.name : "Loans"}
      back={openFolder ? undefined : "/farm-accounts"}
      onBack={openFolder ? () => goToFolder(null) : undefined}
    >
      <div className="p-4 space-y-4">
        {openFolder === null ? (
          <>
            {allOutstanding > 0 && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-600 font-medium">Total outstanding loans</p>
                <p className="text-2xl font-bold text-red-700 mt-0.5">{fmt(allOutstanding)}</p>
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <GroupFolderList folders={folders} onOpen={(f) => goToFolder({ id: f.id, name: f.name })} />
            )}
          </>
        ) : (
          <>
            {activeLoans.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-600 font-medium">Outstanding for {openFolder.name}</p>
                <p className="text-2xl font-bold text-red-700 mt-0.5">{fmt(totalPending)}</p>
              </div>
            )}

            {folderLoans.length > 0 && (
              <div className="flex justify-center">
                <Button
                  onClick={() => setShowLoanForm(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Record loan
                </Button>
              </div>
            )}

            {folderLoans.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No loans for {openFolder.name} yet</p>
                <Button onClick={() => setShowLoanForm(true)} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-1" /> Record loan
                </Button>
              </div>
            )}
            {activeLoans.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">Active loans</p>
                {activeLoans.map((l) => (
                  <div key={l.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{l.workerName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Issued {l.issuedDate} · {l.repaymentMethod}
                          </p>
                          {l.workGroupName && (
                            <p className="text-xs text-blue-600 mt-0.5">👥 {l.workGroupName}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Remaining</p>
                          <p className="font-bold text-red-600">{fmt(Number(l.remainingAmount))}</p>
                        </div>
                      </div>

                      <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, (Number(l.repaidAmount) / Number(l.totalDue)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Repaid: {fmt(Number(l.repaidAmount))}</span>
                        <span>Total: {fmt(Number(l.totalDue))}</span>
                      </div>

                      <ProofBadge loan={l} onView={setViewProof} />

                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => { setPayingLoanId(l.id); payForm.reset({ date: new Date().toISOString().slice(0, 10), method: "cash" }); setPayMethod("cash"); }}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-9"
                        >
                          Record Payment
                        </Button>
                        <button
                          onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                          className="px-3 border border-gray-200 rounded-lg text-gray-400"
                        >
                          {expandedId === l.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {closedLoans.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Closed loans</p>
                {closedLoans.map((l) => (
                  <div key={l.id} className="bg-gray-50 rounded-xl px-4 py-3 opacity-60 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{l.workerName}</p>
                      <p className="text-xs text-gray-400">{l.issuedDate}{l.workGroupName ? ` · 👥 ${l.workGroupName}` : ""}</p>
                      <ProofBadge loan={l} onView={setViewProof} />
                    </div>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">Closed</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Loan Form */}
      {showLoanForm && openFolder && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">New Loan</h2>
                <p className="text-xs text-blue-600 font-semibold">{openFolder.id != null ? `👥 ${openFolder.name}` : "💰 General"}</p>
              </div>
              <button onClick={() => { setShowLoanForm(false); setLoanWorker({ name: "", id: null }); setProofPhoto(null); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Worker *</Label>
              <WorkerNameInput
                workers={workers.filter((w) => w.isActive)}
                value={loanWorker.name}
                onChange={(name, id) => setLoanWorker({ name, id })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Amount ({curSymbol()}) *</Label>
                <Input {...loanForm.register("amount", { required: true })} type="number" placeholder="5000" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Interest %</Label>
                <Input {...loanForm.register("interestPct")} type="number" step="0.5" placeholder="0" className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Issue date</Label>
                <Input {...loanForm.register("issuedDate")} type="date" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Repayment method</Label>
                <SelectOrType
                  options={REPAYMENT_METHODS}
                  value={repayMethod}
                  onChange={setRepayMethod}
                  typePlaceholder="Type method…"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Notes</Label>
              <Input {...loanForm.register("notes")} placeholder="Reason for loan (optional)" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs text-gray-500">Proof of loan (photo)</Label>
              <p className="text-[11px] text-gray-400 mb-1.5">Take a photo while handing over the money — saved with date &amp; time so no one can deny the loan later.</p>
              {proofPhoto ? (
                <div className="relative inline-block">
                  <img src={proofPhoto} alt="Proof of loan" className="h-24 w-24 rounded-xl object-cover border border-gray-200" />
                  <button
                    onClick={() => setProofPhoto(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    aria-label="Remove proof photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm text-gray-500 cursor-pointer active:bg-gray-50">
                  <Camera className="h-5 w-5 text-primary" />
                  Take photo of handover
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => { onProofPicked(e.target.files?.[0]); e.target.value = ""; }}
                  />
                </label>
              )}
            </div>

            <Button
              onClick={loanForm.handleSubmit(submitLoan, invalidLoan)}
              disabled={createLoan.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {createLoan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Loan"}
            </Button>
          </div>
        </div>
      )}

      {/* Record Payment Form */}
      {payingLoanId !== null && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Record Payment</h2>
              <button onClick={() => setPayingLoanId(null)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div>
              {(() => {
                const loan = loans.find((l) => l.id === payingLoanId);
                if (!loan) return null;
                return (
                  <div className="bg-red-50 rounded-xl p-3 mb-2">
                    <p className="text-sm font-medium text-red-700">{loan.workerName}</p>
                    <p className="text-sm text-red-600">Outstanding: {fmt(Number(loan.remainingAmount))}</p>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Amount ({curSymbol()}) *</Label>
                <Input {...payForm.register("amount", { required: true })} type="number" placeholder="1000" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Date</Label>
                <Input {...payForm.register("date")} type="date" className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Payment method</Label>
              <SelectOrType
                options={REPAYMENT_METHODS}
                value={payMethod}
                onChange={setPayMethod}
                typePlaceholder="Type method…"
              />
            </div>

            <Button
              onClick={payForm.handleSubmit(submitPayment)}
              disabled={createPayment.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {createPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}
            </Button>
          </div>
        </div>
      )}

      {viewProof && <LoanProofViewer loan={viewProof} onClose={() => setViewProof(null)} />}
    </PageShell>
  );
}
