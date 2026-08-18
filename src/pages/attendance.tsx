import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Loader2, Plus, X, Banknote, Check, Calendar,
  Camera, Sparkles, Users, TrendingDown, Wallet, FileText, CreditCard, ScanFace, Trash2, UserMinus
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerNameInput } from "@/components/worker-name-input";
import { FaceAttendance } from "@/components/face-attendance";
import { SelectOrType } from "@/components/select-or-type";
import { apiFetch, apiMutate, apiUrl, estateHeaders } from "@/lib/api";
import { compressForAI, compressForRecord, fileToDataUrl } from "@/lib/photo";
import { cacheMedia } from "@/lib/offline-db";
import { useToast } from "@/hooks/use-toast";
import { LoanProofViewer, ProofBadge, type ProofLoan } from "@/components/loan-proof";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface WorkGroup {
  id: number; name: string; category: string; labourType: string;
  paymentType: string; rate: number; cropName?: string; targetUnit?: string;
  advancePerUnit?: number; payFrequency?: string;
  seasonClosed?: boolean; seasonSummary?: string;
  loanTaken?: number | string | null; loanNotes?: string | null;
  harvestThresholdKg?: number | string | null; harvestBonusPerKg?: number | string | null;
}
interface Worker { id: number; name: string; type: string; wageRate: number; wageUnit: string; isActive: boolean; faceDescriptor?: string | null }
interface Attendance { id: number; workerId: number; workerName?: string; date: string; hoursWorked: number; overtimeHours?: number | null; overtimeRate?: number | null; wageAmount: number; harvestedKg?: number | null; harvestCrop?: string | null; createdAt?: string }
interface AdvancePayment {
  id: number; workGroupId: number; paymentDate: string; periodLabel: string;
  daysCount: number; workerCount: number; advancePerWorkerPerDay: number;
  totalAdvancePaid: number; notes?: string; createdAt: string;
}
interface WorkSession {
  id: number; workGroupId: number; date: string;
  checkInAt: string; checkInPhoto?: string | null; headcountIn?: number | null;
  updatePhotos: { takenAt: string; photo: string }[];
  checkOutAt?: string | null; checkOutPhoto?: string | null; headcountOut?: number | null;
}
interface GroupLoan {
  id: number; workerId: number; workerName?: string;
  amount: number; totalDue: number; repaidAmount: number;
  issuedDate: string; dueDate?: string; status: string; notes?: string;
  repaymentMethod: string;
  proofPhotoUrl?: string | null; createdAt?: string;
}

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function sessionDuration(startIso: string, endIso: string): string {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m worked` : `${m}m worked`;
}

const PAY_FREQ_LABELS: Record<string, string> = {
  "daily": "Daily",
  "weekly-5": "Every 5 days",
  "weekly-6": "Every 6 days",
  "weekly-7": "Every 7 days",
  "monthly": "Monthly",
};

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id);
  const today = localDateStr();
  const [activeTab, setActiveTab] = useState<"attendance" | "payments" | "loans">("attendance");
  const [selectedDate, setSelectedDate] = useState(today);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showFaceAtt, setShowFaceAtt] = useState(false);
  const [loanProofPhoto, setLoanProofPhoto] = useState<string | null>(null);
  const [viewProof, setViewProof] = useState<ProofLoan | null>(null);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<number>>(new Set());
  const [confirmRemoveWorker, setConfirmRemoveWorker] = useState<Worker | null>(null);
  const [hours, setHours] = useState("8");
  const [otHours, setOtHours] = useState("0");
  const [otRate, setOtRate] = useState("");
  // Per-person overtime (mirrors harvest picking): toggle on, then type each
  // person's extra hours next to their name — only they get overtime pay.
  const [otMode, setOtMode] = useState(false);
  const [otPerWorker, setOtPerWorker] = useState<Record<number, string>>({});
  const [totalPeople, setTotalPeople] = useState("");
  // Harvest picking: kg weighed per person + the group's bonus rule
  // (threshold kg per person, extra pay per kg above it) set at weighing time.
  const [pickMode, setPickMode] = useState(false);
  const [pickKg, setPickKg] = useState<Record<number, string>>({});
  const [pickThreshold, setPickThreshold] = useState("");
  const [pickBonus, setPickBonus] = useState("");
  const [pickCrop, setPickCrop] = useState("");
  const [paymentForm, setPaymentForm] = useState({ periodLabel: "", daysCount: "", workerCount: "", advancePerWorkerPerDay: "", paymentDate: today, notes: "" });
  const [loanForm, setLoanForm] = useState({ amount: "", issuedDate: today, notes: "" });
  const [loanWorker, setLoanWorker] = useState<{ name: string; id: number | null }>({ name: "", id: null });
  const [payLoanId, setPayLoanId] = useState<number | null>(null);
  const [repayForm, setRepayForm] = useState({ amount: "", method: "cash", date: today });
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResult, setAiResult] = useState<{ count: number; confidence: string; notes: string; imagePreview: string } | null>(null);
  const [seasonEndLoading, setSeasonEndLoading] = useState(false);
  const [seasonResult, setSeasonResult] = useState<{ aiSummary: string; totals: { totalEarned: number; totalAdvancePaid: number; totalRemaining: number } } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const updatePhotoRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLInputElement>(null);
  const [updateUploading, setUpdateUploading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: group } = useQuery<WorkGroup>({
    queryKey: ["work-group", groupId],
    queryFn: () => apiFetch(`/work-groups/${groupId}`),
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => apiFetch("/workers"),
  });

  // Crops list for the harvest-picking "which crop?" selector.
  const { data: crops = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["crops"],
    queryFn: () => apiFetch("/crops"),
  });

  const { data: attendance = [], isLoading: attLoading } = useQuery<Attendance[]>({
    queryKey: ["attendance", groupId, selectedDate],
    queryFn: () => apiFetch(`/attendance?workGroupId=${groupId}&date=${selectedDate}`),
  });

  const { data: sessions = [] } = useQuery<WorkSession[]>({
    queryKey: ["work-sessions", groupId, selectedDate],
    queryFn: () => apiFetch(`/work-groups/${groupId}/sessions?date=${selectedDate}`),
  });
  const session = sessions[0] ?? null;

  const { data: otSummary } = useQuery<{ overtimeSettlement: string; pendingHours: number; pendingAmount: number; clearedAmount: number }>({
    queryKey: ["overtime-summary", groupId],
    queryFn: () => apiFetch(`/work-groups/${groupId}/overtime-summary`),
  });

  const { data: pickSummary } = useQuery<{ harvestBonusSettlement: string; pendingKg: number; pendingAmount: number; clearedAmount: number }>({
    queryKey: ["harvest-bonus-summary", groupId],
    queryFn: () => apiFetch(`/work-groups/${groupId}/harvest-bonus-summary`),
  });

  const { data: advancePayments = [], isLoading: apLoading } = useQuery<AdvancePayment[]>({
    queryKey: ["advance-payments", groupId],
    queryFn: () => apiFetch(`/work-groups/${groupId}/advance-payments`),
  });

  const { data: groupLoans = [], isLoading: loansLoading } = useQuery<GroupLoan[]>({
    queryKey: ["group-loans", groupId],
    queryFn: () => apiFetch(`/work-groups/${groupId}/loans`),
  });

  const createAtt = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/attendance", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", groupId] });
      qc.invalidateQueries({ queryKey: ["overtime-summary", groupId] });
      qc.invalidateQueries({ queryKey: ["harvest-bonus-summary", groupId] });
      setShowAddForm(false);
      setSelectedWorkers(new Set());
      setOtHours("0");
      setOtRate("");
      setPickMode(false);
      setPickKg({});
      setPickCrop("");
      setOtMode(false);
      setOtPerWorker({});
      toast({ title: "Attendance saved" });
    },
  });

  const settleOvertime = useMutation({
    mutationFn: (clientId: string) => apiMutate("POST", `/work-groups/${groupId}/overtime/settle`, { clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overtime-summary", groupId] });
      qc.invalidateQueries({ queryKey: ["advance-payments", groupId] });
      toast({ title: "Overtime marked as paid" });
    },
  });

  const setOtSettlement = useMutation({
    mutationFn: (mode: string) => apiMutate("PATCH", `/work-groups/${groupId}`, { overtimeSettlement: mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overtime-summary", groupId] });
      qc.invalidateQueries({ queryKey: ["work-group", groupId] });
    },
  });

  const settlePickBonus = useMutation({
    mutationFn: (clientId: string) => apiMutate("POST", `/work-groups/${groupId}/harvest-bonus/settle`, { clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["harvest-bonus-summary", groupId] });
      qc.invalidateQueries({ queryKey: ["advance-payments", groupId] });
      toast({ title: "Picking bonus marked as paid" });
    },
  });

  const setPickSettlement = useMutation({
    mutationFn: (mode: string) => apiMutate("PATCH", `/work-groups/${groupId}`, { harvestBonusSettlement: mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["harvest-bonus-summary", groupId] });
      qc.invalidateQueries({ queryKey: ["work-group", groupId] });
    },
  });

  const removeAtt = useMutation({
    mutationFn: (attId: number) => apiMutate("DELETE", `/attendance/${attId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", groupId] }),
  });

  const removeWorker = useMutation({
    mutationFn: (workerId: number) => apiMutate("DELETE", `/workers/${workerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      setConfirmRemoveWorker(null);
      toast({ title: "Worker removed" });
    },
    onError: () => toast({ title: "Could not remove worker", variant: "destructive" }),
  });

  const recordPayment = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiMutate("POST", `/work-groups/${groupId}/advance-payments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advance-payments", groupId] });
      qc.invalidateQueries({ queryKey: ["work-group", groupId] });
      setShowPaymentForm(false);
      setPaymentForm({ periodLabel: "", daysCount: "", workerCount: "", advancePerWorkerPerDay: group?.advancePerUnit ? String(group.advancePerUnit) : "", paymentDate: today, notes: "" });
      toast({ title: "Advance payment recorded" });
    },
    onError: () => toast({ title: "Error recording payment", variant: "destructive" }),
  });

  const removePayment = useMutation({
    mutationFn: (payId: number) => apiMutate("DELETE", `/work-groups/${groupId}/advance-payments/${payId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advance-payments", groupId] }),
  });

  const createLoan = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/loans", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-loans", groupId] });
      setShowLoanForm(false);
      setLoanForm({ amount: "", issuedDate: today, notes: "" });
      setLoanWorker({ name: "", id: null });
      setLoanProofPhoto(null);
      toast({ title: "Loan recorded" });
    },
    onError: () => toast({ title: "Error recording loan", variant: "destructive" }),
  });

  const recordRepayment = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiMutate("POST", "/loan-payments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-loans", groupId] });
      setPayLoanId(null);
      setRepayForm({ amount: "", method: "cash", date: today });
      toast({ title: "Payment recorded" });
    },
    onError: () => toast({ title: "Error recording payment", variant: "destructive" }),
  });

  async function saveLoan() {
    const amt = parseFloat(loanForm.amount);
    const name = loanWorker.name.trim();
    if (!name || isNaN(amt)) return;
    // Prefer the picked/matched worker; otherwise create a new one by that name.
    let workerId = loanWorker.id
      ?? activeWorkers.find((w) => w.name.trim().toLowerCase() === name.toLowerCase())?.id
      ?? null;
    if (workerId == null) {
      try {
        const w = await apiMutate<{ id: number }>("POST", "/workers", { name, isActive: true });
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
      workGroupId: groupId,
      amount: amt,
      totalDue: amt,
      interestPct: 0,
      issuedDate: loanForm.issuedDate,
      repaymentMethod: "salary",
      notes: loanForm.notes || undefined,
      proofPhotoUrl: loanProofPhoto || undefined,
    });
  }

  async function onLoanProofPicked(file: File | undefined) {
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      setLoanProofPhoto(await compressForRecord(raw));
    } catch {
      toast({ title: "Could not read the photo", variant: "destructive" });
    }
  }

  // Prefill "Total people working" each time the form opens: AI headcount
  // first, then the day's session count. Reset on close so a stale value
  // never carries over to another day/session.
  useEffect(() => {
    if (showAddForm) {
      setTotalPeople(String(aiResult?.count ?? session?.headcountIn ?? ""));
    } else {
      setTotalPeople("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm]);

  function toggleWorker(wId: number) {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(wId)) next.delete(wId);
      else next.add(wId);
      return next;
    });
  }

  async function handleCameraScan(file: File) {
    setAiScanning(true);
    setAiResult(null);
    try {
      const raw = await fileToDataUrl(file);
      const dataUrl = await compressForAI(raw);
      const res = await fetch(apiUrl("/ai/count-workers"), {
        method: "POST",
        headers: await estateHeaders(),
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI failed");
      const count: number = data.count ?? 0;
      setAiResult({ count, confidence: data.confidence, notes: data.notes, imagePreview: dataUrl });
      // Keep a local copy of the headcount photo (pruned yearly). Server keeps the original.
      void cacheMedia("attendance", "photo", dataUrl);
      const unmarked = activeWorkers.filter(w => !presentIds.has(w.id));
      const toSelect = unmarked.slice(0, count);
      setSelectedWorkers(new Set(toSelect.map(w => w.id)));
      // Start today's work session (check-in time + arrival photo). Idempotent
      // on the server: an open session for the day is reused, not duplicated.
      let sessionSaved = !!session;
      if (!session) {
        try {
          const recordPhoto = await compressForRecord(raw);
          await apiMutate("POST", `/work-groups/${groupId}/sessions`, {
            date: selectedDate,
            checkInPhoto: recordPhoto,
            headcountIn: count,
          });
          qc.invalidateQueries({ queryKey: ["work-sessions", groupId, selectedDate] });
          sessionSaved = true;
        } catch {
          sessionSaved = false;
        }
      }
      if (activeWorkers.length > 0) setShowAddForm(true);
      if (sessionSaved) {
        toast({ title: `AI counted ${count} worker${count !== 1 ? "s" : ""} — work started` });
      } else {
        toast({
          title: `AI counted ${count} worker${count !== 1 ? "s" : ""}, but work start could not be saved — tap the purple card to retry`,
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI scan failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setAiScanning(false);
    }
  }

  async function handleUpdatePhoto(file: File) {
    if (!session) return;
    setUpdateUploading(true);
    try {
      const raw = await fileToDataUrl(file);
      const photo = await compressForRecord(raw);
      await apiMutate("POST", `/work-sessions/${session.id}/update-photo`, { photo });
      qc.invalidateQueries({ queryKey: ["work-sessions", groupId, selectedDate] });
      toast({ title: "Work photo added" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not save the photo";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setUpdateUploading(false);
    }
  }

  async function handleCheckout(file: File) {
    if (!session) return;
    setCheckingOut(true);
    try {
      const raw = await fileToDataUrl(file);
      const photo = await compressForRecord(raw);
      // Best-effort AI headcount of the leaving photo — checkout still goes
      // through even if the count fails.
      let headcountOut: number | null = null;
      try {
        const aiPhoto = await compressForAI(raw);
        const res = await fetch(apiUrl("/ai/count-workers"), {
          method: "POST",
          headers: await estateHeaders(),
          body: JSON.stringify({ imageBase64: aiPhoto }),
        });
        const data = await res.json();
        if (res.ok) headcountOut = data.count ?? null;
      } catch { /* count is optional */ }
      await apiMutate("POST", `/work-sessions/${session.id}/checkout`, {
        checkOutPhoto: photo,
        headcountOut,
      });
      qc.invalidateQueries({ queryKey: ["work-sessions", groupId, selectedDate] });
      toast({
        title: headcountOut != null
          ? `Work ended — ${headcountOut} ${headcountOut === 1 ? "person" : "people"} leaving`
          : "Work ended",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not end work";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleSeasonEnd() {
    setSeasonEndLoading(true);
    try {
      const res = await fetch(apiUrl(`/work-groups/${groupId}/season-end`), {
        method: "POST",
        headers: await estateHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Season end failed");
      setSeasonResult(data);
      qc.invalidateQueries({ queryKey: ["work-group", groupId] });
      qc.invalidateQueries({ queryKey: ["work-groups"] });
      toast({ title: "Season account generated!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate season account";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSeasonEndLoading(false);
    }
  }

  async function saveAttendance() {
    const rate = group ? Number(group.rate) : 0;
    const h = parseFloat(hours) || 8;
    const wage = group?.paymentType === "Per hour" ? rate * h : rate;
    // Harvest-picking bonus rule (set/updated by owner or manager at weighing
    // time): pay pickBonus extra for every kg above pickThreshold per person.
    const threshold = Math.max(0, parseFloat(pickThreshold) || 0);
    const bonusPerKg = Math.max(0, parseFloat(pickBonus) || 0);
    if (pickMode && (threshold !== Number(group?.harvestThresholdKg ?? 0) || bonusPerKg !== Number(group?.harvestBonusPerKg ?? 0))) {
      try {
        await apiMutate("PATCH", `/work-groups/${groupId}`, {
          harvestThresholdKg: threshold > 0 ? String(threshold) : null,
          harvestBonusPerKg: bonusPerKg > 0 ? String(bonusPerKg) : null,
        });
        qc.invalidateQueries({ queryKey: ["work-group", groupId] });
      } catch {
        toast({ title: "Could not save the picking bonus rule, but attendance will still be saved", variant: "destructive" });
      }
    }
    // Overtime is paid per hour, at the rate the owner types in. If left
    // blank, it falls back to the group's hourly rate (day rate ÷ 8 for
    // per-day groups).
    const defaultOtRate = group?.paymentType === "Per hour" ? rate : rate / 8;
    for (const wId of selectedWorkers) {
      const worker = workers.find((w) => w.id === wId);
      if (!worker) continue;
      const base = wage || Number(worker.wageRate);
      const perHour = Math.max(0, parseFloat(otRate) || 0) || defaultOtRate || Number(worker.wageRate) / 8;
      const kg = pickMode ? Math.max(0, parseFloat(pickKg[wId] ?? "") || 0) : 0;
      // Extra money for kg picked above the per-person threshold.
      const pickExtra = kg > 0 && threshold > 0 && bonusPerKg > 0 ? Math.max(0, kg - threshold) * bonusPerKg : 0;
      // Per-person overtime hours (typed next to the name); only workers with
      // hours entered get overtime pay.
      const wOt = otMode ? Math.max(0, parseFloat(otPerWorker[wId] ?? "") || 0) : Math.max(0, parseFloat(otHours) || 0);
      await createAtt.mutateAsync({
        workGroupId: groupId,
        workerId: wId,
        date: selectedDate,
        hoursWorked: h,
        overtimeHours: wOt > 0 ? wOt : undefined,
        overtimeRate: wOt > 0 ? Math.round(perHour * 100) / 100 : undefined,
        harvestedKg: kg > 0 ? kg : undefined,
        harvestCrop: pickMode && kg > 0 && pickCrop.trim() !== "" ? pickCrop.trim() : undefined,
        wageAmount: Math.round((base + wOt * perHour + pickExtra) * 100) / 100,
        deviceLabel: "Owner",
      });
    }
    // Save "Total people working" on the day's work session (creates or
    // updates the session's headcount for that date).
    const count = parseInt(totalPeople);
    if (!isNaN(count) && count > 0 && count !== session?.headcountIn) {
      try {
        await apiMutate("POST", `/work-groups/${groupId}/sessions`, {
          date: selectedDate,
          headcountIn: count,
        });
        qc.invalidateQueries({ queryKey: ["work-sessions", groupId, selectedDate] });
      } catch {
        toast({ title: "Attendance saved, but total people count could not be saved", variant: "destructive" });
      }
    }
  }

  async function markFacePresent(workerId: number) {
    const worker = workers.find((w) => w.id === workerId);
    const rate = group ? Number(group.rate) : 0;
    const h = 8;
    const wage = group?.paymentType === "Per hour" ? rate * h : rate;
    await createAtt.mutateAsync({
      workGroupId: groupId,
      workerId,
      date: selectedDate,
      hoursWorked: h,
      wageAmount: wage || Number(worker?.wageRate ?? 0),
      deviceLabel: "Face",
    });
  }

  function savePayment() {
    const adv = parseFloat(paymentForm.advancePerWorkerPerDay) || (group?.advancePerUnit ? Number(group.advancePerUnit) : 0);
    recordPayment.mutate({
      periodLabel: paymentForm.periodLabel,
      daysCount: parseInt(paymentForm.daysCount),
      workerCount: parseInt(paymentForm.workerCount),
      advancePerWorkerPerDay: adv,
      paymentDate: paymentForm.paymentDate,
      notes: paymentForm.notes || undefined,
    });
  }

  const activeWorkers = workers.filter((w) => w.isActive);
  const presentIds = new Set(attendance.map((a) => a.workerId));
  // Server-recorded timestamp per marked worker — the DB sets createdAt, so a
  // device with a wrong/cheated clock can't fake when attendance was marked.
  const markedAtByWorker = new Map(
    attendance.filter((a) => a.createdAt).map((a) => [a.workerId, a.createdAt as string]),
  );
  const todayWage = attendance.reduce((s, a) => s + Number(a.wageAmount), 0);
  const todayKg = attendance.reduce((s, a) => s + Number(a.harvestedKg ?? 0), 0);

  const totalAdvancePaid = advancePayments.reduce((s, p) => s + Number(p.totalAdvancePaid), 0);
  const advancePerDay = group?.advancePerUnit ? Number(group.advancePerUnit) : 0;
  const remainingPerDay = advancePerDay > 0 ? Number(group?.rate ?? 0) - advancePerDay : 0;

  const payFormTotal = (() => {
    const d = parseInt(paymentForm.daysCount) || 0;
    const w = parseInt(paymentForm.workerCount) || 0;
    const a = parseFloat(paymentForm.advancePerWorkerPerDay) || advancePerDay;
    return d * w * a;
  })();

  function openPaymentForm() {
    setPaymentForm(f => ({
      ...f,
      advancePerWorkerPerDay: group?.advancePerUnit ? String(Number(group.advancePerUnit)) : "",
    }));
    setShowPaymentForm(true);
  }

  const DatePicker = () => (
    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100">
      <Calendar className="h-4 w-4 text-gray-400" />
      <input
        type="date"
        value={selectedDate}
        max={today}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="flex-1 text-sm font-medium text-gray-700 border-none outline-none bg-transparent"
      />
    </div>
  );

  return (
    <PageShell
      title={group?.name ?? "Work Group"}
      back="/work-groups"
      action={
        <button
          onClick={() => {
            if (activeTab === "attendance") setShowAddForm(true);
            else if (activeTab === "payments") openPaymentForm();
            else setShowLoanForm(true);
          }}
          className="flex items-center gap-1 bg-white text-primary rounded-full pl-2 pr-3 h-8 text-xs font-semibold"
        >
          <Plus className="h-4 w-4" />
          {activeTab === "attendance" ? "Add Attendance" : activeTab === "payments" ? "Add Advance" : "Add Loan"}
        </button>
      }
    >
      <div className="p-4 space-y-4">
        {group && (
          <div className={`rounded-xl p-3 border ${group.seasonClosed ? "bg-gray-50 border-gray-200" : "bg-primary/5 border-primary/20"}`}>
            <p className={`text-xs font-medium ${group.seasonClosed ? "text-gray-600" : "text-primary"}`}>
              {group.category} · {group.labourType}
              {group.seasonClosed && <span className="ml-2 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">Season Closed</span>}
            </p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <p className={`text-xs ${group.seasonClosed ? "text-gray-500" : "text-primary"}`}>
                {fmtMoney(Number(group.rate))} {group.paymentType.toLowerCase()}
                {group.cropName ? ` · ${group.cropName}` : ""}
              </p>
              {advancePerDay > 0 && (
                <p className="text-xs text-orange-600 font-medium">
                  {fmtMoney(advancePerDay)} advance + {fmtMoney(remainingPerDay)} held
                  {group.payFrequency && group.payFrequency !== "daily" && ` · ${PAY_FREQ_LABELS[group.payFrequency] ?? group.payFrequency}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 4-tab toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === "attendance" ? "bg-white text-primary shadow-sm" : "text-gray-500"
            }`}
          >
            <Banknote className="h-3 w-3" /> Attend
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === "payments" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500"
            }`}
          >
            <Wallet className="h-3 w-3" /> Advance
          </button>
          <button
            onClick={() => setActiveTab("loans")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === "loans" ? "bg-white text-red-600 shadow-sm" : "text-gray-500"
            }`}
          >
            <CreditCard className="h-3 w-3" /> Loans
          </button>
        </div>

        {/* Only Attendance tab uses date picker */}
        {activeTab === "attendance" && <DatePicker />}

        {/* ── Attendance tab ── */}
        {activeTab === "attendance" && (
          <>
            {/* Two ways to mark attendance — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowFaceAtt(true)}
                className="rounded-xl bg-gradient-to-b from-primary to-violet-500 text-white p-3.5 flex flex-col items-start gap-2 shadow-sm active:opacity-90 text-left"
              >
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <ScanFace className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Single Person Face Attendance</p>
                  <p className="text-[11px] text-white/80 mt-1 leading-snug">Regular workers — each face marks itself, one by one</p>
                </div>
              </button>
              <button
                onClick={() => !session && cameraRef.current?.click()}
                disabled={aiScanning || !!session}
                className="rounded-xl bg-gradient-to-b from-purple-700 to-purple-500 text-white p-3.5 flex flex-col items-start gap-2 shadow-sm active:opacity-90 text-left disabled:opacity-80"
              >
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  {aiScanning ? <Loader2 className="h-5 w-5 animate-spin" /> : session ? <Check className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Group Attendance</p>
                  <p className="text-[11px] text-white/80 mt-1 leading-snug">
                    {aiScanning
                      ? "AI is counting heads…"
                      : session
                        ? session.checkOutAt
                          ? "Work done for this day ✔"
                          : `Work started at ${fmtTime(session.checkInAt)}`
                        : "Coming to work? Arrival photo — AI counts heads & time is noted"}
                  </p>
                </div>
              </button>
            </div>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCameraScan(f); e.target.value = ""; }}
            />
            <input
              ref={updatePhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpdatePhoto(f); e.target.value = ""; }}
            />
            <input
              ref={checkoutRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCheckout(f); e.target.value = ""; }}
            />

            {/* Today's work session: arrival → work photos → leaving */}
            {session && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Work session</p>
                  {session.checkOutAt && (
                    <span className="text-xs font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                      {sessionDuration(session.checkInAt, session.checkOutAt)}
                    </span>
                  )}
                </div>

                {/* Came to work */}
                <div className="flex items-center gap-3">
                  {session.checkInPhoto ? (
                    <img src={session.checkInPhoto} alt="arrival" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">Came to work · {fmtTime(session.checkInAt)}</p>
                    {session.headcountIn != null && (
                      <p className="text-xs text-gray-500">{session.headcountIn} {session.headcountIn === 1 ? "person" : "people"} working</p>
                    )}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                </div>

                {/* Work update photos */}
                {(session.updatePhotos ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <img src={p.photo} alt={`work update ${i + 1}`} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Work update {i + 1} · {fmtTime(p.takenAt)}</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                  </div>
                ))}

                {/* Left work */}
                {session.checkOutAt ? (
                  <div className="flex items-center gap-3">
                    {session.checkOutPhoto ? (
                      <img src={session.checkOutPhoto} alt="leaving" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-orange-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Left work · {fmtTime(session.checkOutAt)}</p>
                      {session.headcountOut != null && (
                        <p className="text-xs text-gray-500">{session.headcountOut} {session.headcountOut === 1 ? "person" : "people"} counted leaving</p>
                      )}
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => updatePhotoRef.current?.click()}
                      disabled={updateUploading || (session.updatePhotos ?? []).length >= 2}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 py-2.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {updateUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      Work photo ({(session.updatePhotos ?? []).length}/2)
                    </button>
                    <button
                      onClick={() => checkoutRef.current?.click()}
                      disabled={checkingOut}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 text-white py-2.5 text-xs font-semibold disabled:opacity-60"
                    >
                      {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {checkingOut ? "Ending…" : "Leaving — end work"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {attendance.length > 0 && (
              <div className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs text-gray-500">Workers today</p>
                  <p className="text-xl font-bold text-gray-800">{attendance.length}</p>
                </div>
                {todayKg > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Picked today</p>
                    <p className="text-xl font-bold text-emerald-600">{todayKg.toLocaleString("en-IN")} kg</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500">Labour cost</p>
                  <p className="text-xl font-bold text-primary">
                    {fmtMoney(todayWage)}
                  </p>
                </div>
              </div>
            )}

            {attLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No attendance for {selectedDate}</p>
                <Button onClick={() => setShowAddForm(true)} className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm">
                  <Plus className="h-4 w-4 mr-1" /> Mark attendance
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {attendance.map((a) => (
                  <div key={a.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold text-xs">{(a.workerName ?? "?")[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{a.workerName}</p>
                        <p className="text-xs text-gray-400">{a.hoursWorked} hrs</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-700">{fmtMoney(Number(a.wageAmount))}</span>
                      <button onClick={() => removeAtt.mutate(a.id)} className="text-gray-300 hover:text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Payments tab ── */}
        {activeTab === "payments" && (
          <>
            {/* Rate breakdown */}
            {advancePerDay > 0 ? (
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-200 space-y-2">
                <p className="text-xs font-semibold text-orange-700">Advance Payment Structure</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-400">Total rate</p>
                    <p className="text-sm font-bold text-gray-800">{fmtMoney(Number(group?.rate ?? 0))}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-400">Advance</p>
                    <p className="text-sm font-bold text-orange-600">{fmtMoney(advancePerDay)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-gray-400">Held</p>
                    <p className="text-sm font-bold text-primary">{fmtMoney(remainingPerDay)}</p>
                  </div>
                </div>
                {group?.payFrequency && group.payFrequency !== "daily" && (
                  <p className="text-xs text-orange-600">Pay schedule: {PAY_FREQ_LABELS[group.payFrequency] ?? group.payFrequency}</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-center">
                <TrendingDown className="h-8 w-8 mx-auto text-gray-300 mb-1" />
                <p className="text-xs text-gray-400">No advance setup for this group</p>
                <p className="text-xs text-gray-300 mt-0.5">Edit the group to add advance payment settings</p>
              </div>
            )}

            {/* Overtime money status */}
            {otSummary && (otSummary.pendingAmount > 0 || otSummary.clearedAmount > 0) && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-800">Overtime payment</p>
                  {otSummary.pendingAmount > 0 ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">Pending</span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Cleared ✓</span>
                  )}
                </div>
                {otSummary.pendingAmount > 0 && (
                  <p className="text-sm text-amber-900">
                    <span className="font-bold">{fmtMoney(otSummary.pendingAmount)}</span> pending for {otSummary.pendingHours} overtime hr{otSummary.pendingHours !== 1 ? "s" : ""}
                  </p>
                )}
                {otSummary.clearedAmount > 0 && (
                  <p className="text-xs text-amber-700">{fmtMoney(otSummary.clearedAmount)} overtime already paid out</p>
                )}
                <div>
                  <Label className="text-[11px] text-amber-700">Settle overtime</Label>
                  <select
                    value={otSummary.overtimeSettlement}
                    onChange={(e) => setOtSettlement.mutate(e.target.value)}
                    className="mt-1 w-full border border-amber-200 bg-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="weekly">Weekly — with each payment</option>
                    <option value="monthly">Monthly — payments clear finished months</option>
                    <option value="final">In the final season account</option>
                  </select>
                </div>
                {otSummary.pendingAmount > 0 && (
                  <Button
                    onClick={() => settleOvertime.mutate(crypto.randomUUID())}
                    disabled={settleOvertime.isPending}
                    variant="outline"
                    className="w-full h-10 border-amber-300 text-amber-800 rounded-lg text-sm"
                  >
                    {settleOvertime.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark overtime as paid now"}
                  </Button>
                )}
              </div>
            )}

            {/* Picking bonus money status */}
            {pickSummary && (pickSummary.pendingAmount > 0 || pickSummary.clearedAmount > 0) && (
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-emerald-800">Picking bonus payment</p>
                  {pickSummary.pendingAmount > 0 ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">Pending</span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Cleared ✓</span>
                  )}
                </div>
                {pickSummary.pendingAmount > 0 && (
                  <p className="text-sm text-emerald-900">
                    <span className="font-bold">{fmtMoney(pickSummary.pendingAmount)}</span> pending for {pickSummary.pendingKg.toLocaleString("en-IN")} kg picked
                  </p>
                )}
                {pickSummary.clearedAmount > 0 && (
                  <p className="text-xs text-emerald-700">{fmtMoney(pickSummary.clearedAmount)} bonus already paid out</p>
                )}
                <div>
                  <Label className="text-[11px] text-emerald-700">Settle picking bonus</Label>
                  <select
                    value={pickSummary.harvestBonusSettlement}
                    onChange={(e) => setPickSettlement.mutate(e.target.value)}
                    className="mt-1 w-full border border-emerald-200 bg-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="weekly">Weekly — with each payment</option>
                    <option value="monthly">Monthly — payments clear finished months</option>
                    <option value="final">In the final season account</option>
                  </select>
                </div>
                {pickSummary.pendingAmount > 0 && (
                  <Button
                    onClick={() => settlePickBonus.mutate(crypto.randomUUID())}
                    disabled={settlePickBonus.isPending}
                    variant="outline"
                    className="w-full h-10 border-emerald-300 text-emerald-800 rounded-lg text-sm"
                  >
                    {settlePickBonus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark picking bonus as paid now"}
                  </Button>
                )}
              </div>
            )}

            {/* Totals summary */}
            {advancePayments.length > 0 && (
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total advance paid</span>
                  <span className="text-sm font-bold text-orange-600">{fmtMoney(totalAdvancePaid)}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <p className="text-xs text-gray-400">{advancePayments.length} payment{advancePayments.length !== 1 ? "s" : ""} recorded</p>
              </div>
            )}

            {/* Payment history */}
            {apLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : advancePayments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No advance payments recorded yet</p>
                <Button
                  onClick={openPaymentForm}
                  className="mt-3 bg-orange-500 hover:bg-orange-600 text-white text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" /> Record advance payment
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {advancePayments.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{p.periodLabel}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.workerCount} workers × {p.daysCount} days × {fmtMoney(Number(p.advancePerWorkerPerDay))}/day
                        </p>
                        <p className="text-xs text-gray-400">{p.paymentDate}</p>
                        {p.notes && <p className="text-xs text-gray-400 italic mt-0.5">{p.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-orange-600">
                          {fmtMoney(Number(p.totalAdvancePaid))}
                        </span>
                        <button onClick={() => removePayment.mutate(p.id)} className="text-gray-300 hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Season End Account button */}
            {!group?.seasonClosed && advancePayments.length > 0 && (
              <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary rounded-xl p-1.5">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">Season End Account</p>
                    <p className="text-xs text-primary">AI generates final settlement for all workers</p>
                  </div>
                </div>
                <Button
                  onClick={handleSeasonEnd}
                  disabled={seasonEndLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11"
                >
                  {seasonEndLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating account…</>
                  ) : (
                    <><FileText className="h-4 w-4 mr-2" /> Generate Season Account</>
                  )}
                </Button>
              </div>
            )}

            {/* Show AI season summary */}
            {(seasonResult || group?.seasonSummary) && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-primary">Final Season Account</p>
                  {group?.seasonClosed && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Closed</span>}
                </div>
                {seasonResult && (
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Total earned</p>
                      <p className="text-xs font-bold text-gray-800">{fmtMoney(seasonResult.totals.totalEarned)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Advance paid</p>
                      <p className="text-xs font-bold text-orange-600">{fmtMoney(seasonResult.totals.totalAdvancePaid)}</p>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Remaining</p>
                      <p className="text-xs font-bold text-primary">{fmtMoney(seasonResult.totals.totalRemaining)}</p>
                    </div>
                  </div>
                )}
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {seasonResult?.aiSummary ?? group?.seasonSummary}
                </pre>
              </div>
            )}
          </>
        )}

        {/* ── Loans tab ── */}
        {activeTab === "loans" && (
          <>
            {/* Loan recorded when the group was created */}
            {group?.loanTaken != null && Number(group.loanTaken) > 0 && (
              <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900">Loan taken by group (upfront)</p>
                      {group.loanNotes && (
                        <p className="text-xs text-amber-700 truncate">{group.loanNotes}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-amber-900 shrink-0">{fmtMoney(Number(group.loanTaken))}</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {groupLoans.length > 0 && (() => {
              const totalLoaned = groupLoans.reduce((s, l) => s + Number(l.totalDue), 0);
              const totalRepaid = groupLoans.reduce((s, l) => s + Number(l.repaidAmount), 0);
              const outstanding = totalLoaned - totalRepaid;
              const rate = Number(group?.rate ?? 0);
              const daysToRepay = rate > 0 && outstanding > 0 ? Math.ceil(outstanding / rate) : null;
              // paymentType holds values like "Per day", "Per hour", "Per acre", "Per kg"
              const unit = (group?.paymentType ?? "").toLowerCase().replace(/^per\s+/, "").trim() || "day";
              const unitPlural = unit === "kg" ? "kg" : `${unit}s`;
              return (
                <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400">Total loaned</p>
                      <p className="text-sm font-bold text-gray-800">{fmtMoney(totalLoaned)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400">Repaid</p>
                      <p className="text-sm font-bold text-primary">{fmtMoney(totalRepaid)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-xs text-gray-400">Outstanding</p>
                      <p className="text-sm font-bold text-red-600">{fmtMoney(outstanding)}</p>
                    </div>
                  </div>
                  {daysToRepay != null && (
                    <p className="text-xs text-red-700 text-center mt-2">
                      ≈ {daysToRepay} {unitPlural} of work at {fmtMoney(rate)}/{unit} to repay
                    </p>
                  )}
                </div>
              );
            })()}

            {loansLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>
            ) : groupLoans.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No loans for workers in this group</p>
                <Button
                  onClick={() => setShowLoanForm(true)}
                  className="mt-3 bg-red-500 hover:bg-red-600 text-white text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" /> Record loan
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {groupLoans.map((loan) => {
                  const outstanding = Number(loan.totalDue) - Number(loan.repaidAmount);
                  const isPaying = payLoanId === loan.id;
                  return (
                    <div key={loan.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-red-600 font-bold text-xs">{(loan.workerName ?? "?")[0]}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{loan.workerName ?? "Worker"}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              loan.status === "repaid" || loan.status === "closed" ? "bg-emerald-50 text-emerald-700" :
                              loan.status === "overdue" ? "bg-red-100 text-red-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>{loan.status}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-9">
                            Loaned {fmtMoney(Number(loan.amount))} · {loan.issuedDate}
                          </p>
                          {Number(loan.repaidAmount) > 0 && (
                            <p className="text-xs text-primary ml-9">
                              Repaid {fmtMoney(Number(loan.repaidAmount))}
                            </p>
                          )}
                          {loan.notes && <p className="text-xs text-gray-400 italic ml-9 mt-0.5">{loan.notes}</p>}
                          <div className="ml-9">
                            <ProofBadge loan={loan} onView={setViewProof} />
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="text-sm font-bold text-red-600">{fmtMoney(outstanding)}</p>
                          <p className="text-xs text-gray-400">outstanding</p>
                          {loan.status !== "repaid" && loan.status !== "closed" && outstanding > 0 && (
                            <button
                              onClick={() => {
                                if (isPaying) { setPayLoanId(null); }
                                else { setPayLoanId(loan.id); setRepayForm({ amount: "", method: "cash", date: today }); }
                              }}
                              className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                            >
                              {isPaying ? "Cancel" : "Record payment"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline repayment form */}
                      {isPaying && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <p className="text-xs font-semibold text-gray-600">Record repayment</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">Amount ({curSymbol()})</Label>
                              <Input
                                type="number"
                                placeholder={`max ${fmtMoney(outstanding)}`}
                                value={repayForm.amount}
                                onChange={e => setRepayForm(f => ({ ...f, amount: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Date</Label>
                              <Input
                                type="date"
                                value={repayForm.date}
                                onChange={e => setRepayForm(f => ({ ...f, date: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Method</Label>
                            <SelectOrType
                              options={["cash", "salary deduction", "bank transfer", "installment"]}
                              labels={{ cash: "Cash", "salary deduction": "Salary deduction", "bank transfer": "Bank transfer", installment: "Installment" }}
                              value={repayForm.method}
                              onChange={(v) => setRepayForm(f => ({ ...f, method: v }))}
                              typePlaceholder="Type method…"
                            />
                          </div>
                          <Button
                            size="sm"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-8"
                            disabled={!repayForm.amount || recordRepayment.isPending}
                            onClick={() => {
                              const amt = parseFloat(repayForm.amount);
                              if (isNaN(amt) || amt <= 0) return;
                              recordRepayment.mutate({ loanId: loan.id, amount: amt, method: repayForm.method, date: repayForm.date });
                            }}
                          >
                            {recordRepayment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save payment"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Attendance form ── */}
      {showAddForm && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Mark Attendance</h2>
              <button onClick={() => { setShowAddForm(false); setAiResult(null); setPickMode(false); setPickKg({}); setPickCrop(""); setOtMode(false); setOtPerWorker({}); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            {(aiScanning || aiResult) && (
              <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary rounded-xl p-1.5">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">Group Attendance — AI Headcount</p>
                    <p className="text-xs text-primary">AI counted heads from your group photo</p>
                  </div>
                </div>

                {aiScanning ? (
                  <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-primary font-medium">AI is counting workers…</span>
                  </div>
                ) : aiResult ? (
                  <div className="bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <img src={aiResult.imagePreview} alt="scan" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="text-2xl font-black text-primary">{aiResult.count}</span>
                          <span className="text-sm text-gray-500 font-medium">people found</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            aiResult.confidence === "high" ? "bg-primary/10 text-primary" :
                            aiResult.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{aiResult.confidence}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{aiResult.notes}</p>
                      </div>
                    </div>
                    <p className="text-xs text-primary font-medium">✓ {Math.min(aiResult.count, activeWorkers.filter(w => !presentIds.has(w.id)).length)} workers auto-selected below — adjust if needed</p>
                  </div>
                ) : null}

                {aiResult && (
                  <button
                    onClick={() => cameraRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-primary/30 text-primary bg-white rounded-xl py-2.5 font-medium text-sm"
                  >
                    <Camera className="h-4 w-4" />
                    Retake Photo
                  </button>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs text-gray-500">Date</Label>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Hours worked</Label>
              <Input value={hours} onChange={(e) => setHours(e.target.value)} type="number" step="0.5" min="0.5" max="12" className="mt-1" />
            </div>
            {/* ── Overtime (per-person hours, like harvest picking) ── */}
            <div className={`rounded-xl border p-3 ${otMode ? "bg-amber-50/60 border-amber-200" : "border-gray-200"}`}>
              <button
                type="button"
                onClick={() => {
                  const on = !otMode;
                  setOtMode(on);
                  if (!on) { setOtPerWorker({}); setOtRate(""); }
                }}
                className="w-full flex items-center justify-between"
              >
                <span className="text-sm font-semibold text-gray-700">Overtime today?</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${otMode ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {otMode ? "Yes" : "No"}
                </span>
              </button>
              {otMode && (
                <div className="mt-3 space-y-2">
                  <div>
                    <Label className="text-xs text-gray-500">Overtime pay (per hour)</Label>
                    <Input
                      value={otRate}
                      onChange={(e) => setOtRate(e.target.value)}
                      type="number"
                      step="1"
                      min="0"
                      placeholder={String(Math.round(((group?.paymentType === "Per hour" ? Number(group?.rate ?? 0) : Number(group?.rate ?? 0) / 8) || 0) * 100) / 100)}
                      className="mt-1 bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Type the overtime hours next to each person who stayed longer — only they get the extra pay. Others stay at normal wage.
                  </p>
                </div>
              )}
            </div>
            {/* ── Harvest picking (kg weighed per person + bonus rule) ── */}
            <div className={`rounded-xl border p-3 ${pickMode ? "bg-emerald-50/60 border-emerald-200" : "border-gray-200"}`}>
              <button
                type="button"
                onClick={() => {
                  const on = !pickMode;
                  setPickMode(on);
                  if (on) {
                    setPickThreshold(group?.harvestThresholdKg != null ? String(Number(group.harvestThresholdKg)) : "");
                    setPickBonus(group?.harvestBonusPerKg != null ? String(Number(group.harvestBonusPerKg)) : "");
                  }
                }}
                className="w-full flex items-center justify-between"
              >
                <span className="text-sm font-semibold text-gray-700">Harvest picking today?</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pickMode ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {pickMode ? "Yes — weighing" : "No"}
                </span>
              </button>
              {pickMode && (
                <div className="mt-3 space-y-2">
                  <div>
                    <Label className="text-xs text-gray-500">Which crop did they pick?</Label>
                    <div className="mt-1">
                      <SelectOrType
                        options={crops.map((c) => c.name)}
                        value={pickCrop}
                        onChange={setPickCrop}
                        placeholder="Select crop"
                        typePlaceholder="Type crop name…"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Target per person (kg)</Label>
                      <Input value={pickThreshold} onChange={(e) => setPickThreshold(e.target.value)} type="number" step="1" min="0" placeholder="e.g. 80" className="mt-1 bg-white" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Extra pay per kg above ({curSymbol()})</Label>
                      <Input value={pickBonus} onChange={(e) => setPickBonus(e.target.value)} type="number" step="0.5" min="0" placeholder="e.g. 5" className="mt-1 bg-white" />
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Type each person's weighed kg next to their name below. Anyone above{" "}
                    {parseFloat(pickThreshold) > 0 ? `${parseFloat(pickThreshold)} kg` : "the target"} gets the extra pay added automatically.
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500">Total people working</Label>
              <Input
                value={totalPeople}
                onChange={(e) => setTotalPeople(e.target.value)}
                type="number"
                min="1"
                placeholder="e.g. 12"
                className="mt-1"
              />
              <p className="text-[11px] text-gray-400 mt-1">Full gang size for the day — including people not in the worker list</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Select workers {aiResult ? <span className="text-primary font-semibold">(AI pre-selected {selectedWorkers.size})</span> : ""}</Label>
              <p className="text-[11px] text-gray-400 -mt-1 mb-2">
                Already-marked workers can be selected again to update their day — e.g. add picked kg or overtime after work is done. The new values replace the old ones.
              </p>
              {activeWorkers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">No workers added yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activeWorkers.map((w) => {
                    const alreadyPresent = presentIds.has(w.id);
                    const selected = selectedWorkers.has(w.id);
                    return (
                      <div
                        key={w.id}
                        className={`w-full flex items-center rounded-xl border transition-colors ${
                          selected ? "bg-primary/10 border-primary"
                            : alreadyPresent ? "bg-primary/5 border-primary/20"
                            : "bg-white border-gray-200 hover:border-primary/30"
                        }`}
                      >
                        <button
                          onClick={() => toggleWorker(w.id)}
                          className="flex-1 flex items-center justify-between pl-4 pr-2 py-3 min-w-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${alreadyPresent || selected ? "bg-primary border-primary" : "border-gray-300"}`}>
                              {(alreadyPresent || selected) && <Check className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate">{w.name}</span>
                            {alreadyPresent && (
                              <span className="text-xs text-primary flex-shrink-0">
                                marked{markedAtByWorker.has(w.id) ? ` · ${fmtTime(markedAtByWorker.get(w.id)!)}` : ""}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">{fmtMoney(Number(w.wageRate))}/{w.wageUnit}</span>
                        </button>
                        {pickMode && selected && (
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            placeholder="kg"
                            value={pickKg[w.id] ?? ""}
                            onChange={(e) => setPickKg((m) => ({ ...m, [w.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 flex-shrink-0 border border-emerald-300 bg-white rounded-lg px-2 py-1.5 text-sm text-center"
                          />
                        )}
                        {otMode && selected && (
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            placeholder="OT hr"
                            value={otPerWorker[w.id] ?? ""}
                            onChange={(e) => setOtPerWorker((m) => ({ ...m, [w.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 flex-shrink-0 border border-amber-300 bg-white rounded-lg px-2 py-1.5 text-sm text-center ml-1"
                          />
                        )}
                        <button
                          aria-label={`Remove ${w.name}`}
                          onClick={() => setConfirmRemoveWorker(w)}
                          className="flex-shrink-0 p-3 text-gray-300 active:text-red-500"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedWorkers.size > 0 && (() => {
              const baseEach = group?.paymentType === "Per hour" ? Number(group.rate) * parseFloat(hours || "8") : Number(group?.rate ?? 0);
              const perHr = Math.max(0, parseFloat(otRate) || 0) || (group?.paymentType === "Per hour" ? Number(group?.rate ?? 0) : Number(group?.rate ?? 0) / 8);
              const otTotalHrs = otMode
                ? [...selectedWorkers].reduce((s, id) => s + Math.max(0, parseFloat(otPerWorker[id] ?? "") || 0), 0)
                : 0;
              const otCount = otMode ? [...selectedWorkers].filter((id) => (parseFloat(otPerWorker[id] ?? "") || 0) > 0).length : 0;
              return (
                <div className="bg-primary/5 rounded-xl p-3">
                  <p className="text-sm text-primary">
                    {selectedWorkers.size} worker{selectedWorkers.size > 1 ? "s" : ""} ·{" "}
                    {fmtMoney(selectedWorkers.size * baseEach + otTotalHrs * perHr)} total
                    {otCount > 0 && <> · {otCount} with overtime ({otTotalHrs} hr × {fmtMoney(perHr)})</>}
                  </p>
                </div>
              );
            })()}
            <Button
              onClick={saveAttendance}
              disabled={selectedWorkers.size === 0 || createAtt.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {createAtt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Attendance"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Confirm remove worker ── */}
      {confirmRemoveWorker && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2.5 bg-red-100 text-red-600 flex-shrink-0">
                <UserMinus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">Remove this worker?</h2>
                <p className="text-sm text-gray-500 truncate">{confirmRemoveWorker.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Remove when a worker has left the job or their final account is settled.
              They will no longer appear in any group's worker list. Past attendance,
              wages and loan records are kept, and you can bring the worker back from
              the Recycle Bin (in the menu).
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmRemoveWorker(null)}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={() => removeWorker.mutate(confirmRemoveWorker.id)}
                disabled={removeWorker.isPending}
                className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700 text-white"
              >
                {removeWorker.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove worker"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Advance Payment form ── */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Record Advance Payment</h2>
              <button onClick={() => setShowPaymentForm(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Period label *</Label>
              <Input
                value={paymentForm.periodLabel}
                onChange={(e) => setPaymentForm(f => ({ ...f, periodLabel: e.target.value }))}
                placeholder="e.g. Week 1 (Days 1–5)"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Days covered *</Label>
                <Input
                  value={paymentForm.daysCount}
                  onChange={(e) => setPaymentForm(f => ({ ...f, daysCount: e.target.value }))}
                  type="number" min="1" placeholder="5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Workers *</Label>
                <Input
                  value={paymentForm.workerCount}
                  onChange={(e) => setPaymentForm(f => ({ ...f, workerCount: e.target.value }))}
                  type="number" min="1" placeholder="12"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Advance/worker/day ({curSymbol()})</Label>
                <Input
                  value={paymentForm.advancePerWorkerPerDay}
                  onChange={(e) => setPaymentForm(f => ({ ...f, advancePerWorkerPerDay: e.target.value }))}
                  type="number" placeholder={advancePerDay > 0 ? String(advancePerDay) : "200"}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Payment date</Label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  max={today}
                  onChange={(e) => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            {payFormTotal > 0 && (
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                <p className="text-sm text-orange-700 font-semibold">
                  Total advance: {fmtMoney(payFormTotal)}
                </p>
                <p className="text-xs text-orange-500 mt-0.5">
                  {paymentForm.workerCount || "?"} workers × {paymentForm.daysCount || "?"} days × {fmtMoney(paymentForm.advancePerWorkerPerDay || advancePerDay)}/day
                </p>
              </div>
            )}

            <div>
              <Label className="text-xs text-gray-500">Notes</Label>
              <Input
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes…"
                className="mt-1"
              />
            </div>

            <Button
              onClick={savePayment}
              disabled={recordPayment.isPending || !paymentForm.periodLabel || !paymentForm.daysCount || !paymentForm.workerCount}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12"
            >
              {recordPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save — ${fmtMoney(payFormTotal)} advance`}
            </Button>
          </div>
        </div>
      )}
      {/* ── Record Loan form ── */}
      {showLoanForm && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Record Loan</h2>
              <button onClick={() => { setShowLoanForm(false); setLoanWorker({ name: "", id: null }); setLoanProofPhoto(null); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Worker *</Label>
              <WorkerNameInput
                workers={activeWorkers}
                value={loanWorker.name}
                onChange={(name, id) => setLoanWorker({ name, id })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Loan amount ({curSymbol()}) *</Label>
                <Input
                  value={loanForm.amount}
                  onChange={(e) => setLoanForm(f => ({ ...f, amount: e.target.value }))}
                  type="number" min="1" placeholder="e.g. 2000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Date issued</Label>
                <input
                  type="date"
                  value={loanForm.issuedDate}
                  max={today}
                  onChange={(e) => setLoanForm(f => ({ ...f, issuedDate: e.target.value }))}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            {loanForm.amount && parseFloat(loanForm.amount) > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-sm text-red-700 font-semibold">
                  {fmtMoney(parseFloat(loanForm.amount))} will be deducted from final settlement
                </p>
              </div>
            )}

            <div>
              <Label className="text-xs text-gray-500">Notes</Label>
              <Input
                value={loanForm.notes}
                onChange={(e) => setLoanForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Reason for loan…"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-500">Proof of loan (photo)</Label>
              <p className="text-[11px] text-gray-400 mb-1.5">Take a photo while handing over the money — saved with date &amp; time so no one can deny the loan later.</p>
              {loanProofPhoto ? (
                <div className="relative inline-block">
                  <img src={loanProofPhoto} alt="Proof of loan" className="h-24 w-24 rounded-xl object-cover border border-gray-200" />
                  <button
                    onClick={() => setLoanProofPhoto(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    aria-label="Remove proof photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm text-gray-500 cursor-pointer active:bg-gray-50">
                  <Camera className="h-5 w-5 text-red-500" />
                  Take photo of handover
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => { onLoanProofPicked(e.target.files?.[0]); e.target.value = ""; }}
                  />
                </label>
              )}
            </div>

            <Button
              onClick={saveLoan}
              disabled={createLoan.isPending || !loanWorker.name.trim() || !loanForm.amount}
              className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl h-12"
            >
              {createLoan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Loan"}
            </Button>
          </div>
        </div>
      )}

      {viewProof && <LoanProofViewer loan={viewProof} onClose={() => setViewProof(null)} />}
      {showFaceAtt && (
        <FaceAttendance
          workers={activeWorkers}
          presentWorkerIds={presentIds}
          onMarkPresent={markFacePresent}
          onClose={() => setShowFaceAtt(false)}
        />
      )}
    </PageShell>
  );
}
