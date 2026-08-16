import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stethoscope, Star, MapPin, Phone, MessageSquare, Send, Wallet, Plus, ArrowLeft, Clock, GraduationCap, Briefcase, Languages, Loader2, PhoneOff, BadgeCheck, X, Lock, Camera, Mic, Banknote, Landmark, CheckCircle2, AlertTriangle, ChevronRight, FileText, Upload, UserPlus
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch, apiMutate, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { fmtMoney, curSymbol } from "@/lib/currency";
import { compressForAI, fileToDataUrl } from "@/lib/photo";

interface Agronomist {
  id: number;
  name: string;
  emoji: string;
  speciality: string;
  qualification: string | null;
  certificateUrl: string | null;
  workplace: string | null;
  location: string | null;
  languages: string | null;
  experience: string | null;
  contactPhone: string | null;
  rating: string;
  ratePer15Min: string;
  consultationPlan: string | null;
  bio: string | null;
  isOnline: boolean;
  payoutReady: boolean;
}

interface Payout {
  id: number;
  amount: string;
  method: string;
  reference: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface Earnings {
  id: number;
  name: string;
  totalEarnings: number;
  paidOut: number;
  pending: number;
  available: number;
  payoutReady: boolean;
  payoutMethod: {
    accountHolderName: string | null;
    bankAccountNumber: string | null;
    ifscCode: string | null;
    upiId: string | null;
    panNumber: string | null;
  };
  payouts: Payout[];
}

interface AppSettings {
  walletBalance: string;
  trialActive: boolean;
  trialDaysLeft: number;
  canUseAgriDoctor: boolean;
}

interface ConsultMessage {
  id: number;
  sender: "farmer" | "doctor";
  text: string;
  mediaType: "image" | "audio" | null;
  mediaUrl: string | null;
  createdAt: string;
}

function inr(n: number) {
  return fmtMoney(n, 0);
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      <Star className="h-3.5 w-3.5 fill-amber-400" />
      <span className="text-xs font-semibold text-gray-700">{value.toFixed(1)}</span>
    </span>
  );
}

type View =
  | { name: "directory" }
  | { name: "profile"; doctor: Agronomist }
  | { name: "chat"; doctor: Agronomist; consultationId: number }
  | { name: "call"; doctor: Agronomist; consultationId: number }
  | { name: "expert" }
  | { name: "register" }
  | { name: "earnings" };

export default function AgriDoctor() {
  const [view, setView] = useState<View>({ name: "directory" });
  const [topupOpen, setTopupOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Register inner screens as history steps: directory (0) → chat/call/expert/
  // profile (1) → register/earnings (2), so Back walks one screen at a time.
  const viewDepth =
    view.name === "directory" ? 0
    : view.name === "register" || view.name === "earnings" ? 2
    : 1;
  useSubScreenHistory(viewDepth, () => {
    setView(v => {
      if (v.name === "register" || v.name === "earnings") return { name: "expert" };
      if (v.name === "chat" || v.name === "call") {
        qc.invalidateQueries({ queryKey: ["app-settings"] });
      }
      return { name: "directory" };
    });
  });

  const { data: doctors = [], isLoading } = useQuery<Agronomist[]>({
    queryKey: ["agronomists"],
    queryFn: () => apiFetch("/agronomists"),
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => apiFetch("/app-settings"),
  });

  const balance = Number(settings?.walletBalance ?? 0);

  const startConsult = useMutation({
    mutationFn: (vars: { doctor: Agronomist; mode: "chat" | "call" }) =>
      apiMutate<{ id: number }>("POST", "/consultations", {
        agronomistId: vars.doctor.id,
        mode: vars.mode,
      }),
    onSuccess: (res, vars) => {
      if (!res) {
        toast({ title: "You're offline", description: "Connect to the internet to consult a doctor.", variant: "destructive" });
        return;
      }
      setView(
        vars.mode === "chat"
          ? { name: "chat", doctor: vars.doctor, consultationId: res.id }
          : { name: "call", doctor: vars.doctor, consultationId: res.id }
      );
    },
    onError: () => toast({ title: "Could not start consultation", variant: "destructive" }),
  });

  if (view.name === "chat") {
    return <ChatView view={view} balance={balance} onBack={() => { setView({ name: "directory" }); qc.invalidateQueries({ queryKey: ["app-settings"] }); }} />;
  }
  if (view.name === "call") {
    return <CallView view={view} balance={balance} onBack={() => { setView({ name: "directory" }); qc.invalidateQueries({ queryKey: ["app-settings"] }); }} />;
  }
  if (view.name === "expert") {
    return <ExpertHub onBack={() => setView({ name: "directory" })} onRegister={() => setView({ name: "register" })} onEarnings={() => setView({ name: "earnings" })} />;
  }
  if (view.name === "register") {
    return <RegisterView onBack={() => setView({ name: "expert" })} onDone={() => { setView({ name: "directory" }); qc.invalidateQueries({ queryKey: ["agronomists"] }); }} />;
  }
  if (view.name === "earnings") {
    return <EarningsView doctors={doctors} onBack={() => setView({ name: "expert" })} />;
  }
  if (view.name === "profile") {
    const d = view.doctor;
    return (
      <PageShell title="Doctor Profile" onBack={() => setView({ name: "directory" })}>
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="text-4xl bg-primary/5 rounded-2xl h-16 w-16 flex items-center justify-center">{d.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-gray-900">{d.name}</h2>
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-primary font-medium">{d.speciality}</p>
                <div className="flex items-center gap-3 mt-1">
                  <Stars value={Number(d.rating)} />
                  <span className={`text-xs font-medium ${d.isOnline ? "text-emerald-600" : "text-gray-400"}`}>
                    {d.isOnline ? "● Online" : "○ Offline"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 text-sm text-gray-700">
              {d.qualification && <Row icon={<GraduationCap className="h-4 w-4 text-primary" />} label={d.qualification} />}
              {d.experience && <Row icon={<Clock className="h-4 w-4 text-primary" />} label={`${d.experience} experience`} />}
              {d.workplace && <Row icon={<Briefcase className="h-4 w-4 text-primary" />} label={d.workplace} />}
              {d.location && <Row icon={<MapPin className="h-4 w-4 text-primary" />} label={d.location} />}
              {d.languages && <Row icon={<Languages className="h-4 w-4 text-primary" />} label={d.languages} />}
              {d.contactPhone && <Row icon={<Phone className="h-4 w-4 text-primary" />} label={d.contactPhone} />}
            </div>

            {d.bio && <p className="mt-4 text-sm text-gray-600 leading-relaxed">{d.bio}</p>}

            {d.certificateUrl && (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1.5">
                  <BadgeCheck className="h-4 w-4" /> Verified agriculture credential
                </p>
                <img src={d.certificateUrl} alt="Agriculture education certificate" className="w-full max-h-56 object-contain rounded-xl border border-primary/20 bg-white" />
              </div>
            )}

            <div className="mt-4 bg-primary/5 rounded-xl p-3">
              <p className="text-xs text-gray-500">Consultation plan</p>
              <p className="text-sm font-semibold text-primary">{d.consultationPlan ?? `${inr(Number(d.ratePer15Min))} per 15 min`}</p>
            </div>
          </div>

          {!d.payoutReady && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">This doctor hasn't finished their payout setup yet, so they can't take consultations online.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-12 bg-primary hover:bg-primary/90"
              disabled={startConsult.isPending || !d.payoutReady}
              onClick={() => startConsult.mutate({ doctor: d, mode: "chat" })}
            >
              <MessageSquare className="h-4 w-4 mr-1.5" /> Message
            </Button>
            <Button
              className="h-12 bg-amber-500 hover:bg-amber-600"
              disabled={startConsult.isPending || !d.payoutReady}
              onClick={() => startConsult.mutate({ doctor: d, mode: "call" })}
            >
              <Phone className="h-4 w-4 mr-1.5" /> Call
            </Button>
          </div>
          {d.contactPhone && (
            <a href={`tel:${d.contactPhone.replace(/\s/g, "")}`} className="block">
              <Button variant="outline" className="w-full h-11">
                <Phone className="h-4 w-4 mr-1.5" /> Dial directly: {d.contactPhone}
              </Button>
            </a>
          )}
        </div>
      </PageShell>
    );
  }

  if (settings && !settings.canUseAgriDoctor) {
    return (
      <PageShell title="Agri Doctor" back="/">
        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-br from-primary to-violet-500 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-xl p-2"><Stethoscope className="h-5 w-5" /></div>
              <div>
                <h2 className="font-bold">Agriculture Doctor</h2>
                <p className="text-primary-foreground/80 text-xs">Consult agronomists, professors & crop doctors to boost your yield</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <p className="font-bold text-amber-900">Subscribe to consult Agri Doctor</p>
            <p className="text-sm text-amber-700 mt-1">
              Agri Doctor is free during your trial. Subscribe to a plan to keep messaging and calling crop doctors.
            </p>
            <Link href="/subscription" className="inline-block mt-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-11 leading-[44px] font-bold">
              See plans
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Agri Doctor" back="/">
      <div className="p-4 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 rounded-xl p-2"><Stethoscope className="h-5 w-5" /></div>
            <div>
              <h2 className="font-bold">Agriculture Doctor</h2>
              <p className="text-primary-foreground/80 text-xs">Consult agronomists, professors & crop doctors to boost your yield</p>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-100 rounded-xl p-2"><Wallet className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-gray-400">Consultation wallet</p>
              <p className="text-lg font-bold text-gray-900">{inr(balance)}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setTopupOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Money
          </Button>
        </div>

        {/* Agriculture expert area — profile + earnings live inside, hidden from farmers browsing */}
        <button
          onClick={() => setView({ name: "expert" })}
          className="w-full text-left bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2.5 active:scale-[0.99] transition-transform"
        >
          <div className="bg-primary/10 rounded-lg p-2"><BadgeCheck className="h-5 w-5 text-primary" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">Are you an agriculture expert?</p>
            <p className="text-xs text-primary">Add your profile so farmers can consult you</p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary" />
        </button>

        {/* Directory */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Available Doctors</h3>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setView({ name: "profile", doctor: d })}
                  className="w-full text-left bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl bg-primary/5 rounded-xl h-14 w-14 flex items-center justify-center flex-shrink-0">{d.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-gray-900 truncate">{d.name}</h4>
                        <Stars value={Number(d.rating)} />
                      </div>
                      <p className="text-xs text-primary font-medium truncate">{d.speciality}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        {d.experience && <span>{d.experience}</span>}
                        {d.location && <><span>·</span><span className="truncate">{d.location}</span></>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-semibold text-gray-700">{inr(Number(d.ratePer15Min))}/15 min</span>
                        <span className={`text-[11px] font-medium ${d.isOnline ? "text-emerald-600" : "text-gray-400"}`}>
                          {d.isOnline ? "● Online" : "○ Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} onDone={() => { setTopupOpen(false); qc.invalidateQueries({ queryKey: ["app-settings"] }); }} />}
    </PageShell>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function TopupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const topup = useMutation({
    mutationFn: (amt: number) => apiMutate("POST", "/app-settings/wallet/topup", { amount: amt }),
    onSuccess: (res) => {
      toast(res ? { title: "Money added to wallet" } : { title: "Saved offline", description: "Your wallet will update when you're back online." });
      onDone();
    },
    onError: () => toast({ title: "Top-up failed", variant: "destructive" }),
  });
  // Ignore the "ghost click" (~300ms after the opening tap) that would land on
  // the fresh backdrop and close the sheet instantly, plus bubbled sheet clicks.
  const openedAtRef = useRef(Date.now());
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (Date.now() - openedAtRef.current < 500) return;
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={handleBackdrop}>
      <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Add money to wallet</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[100, 200, 500].map((a) => (
            <button key={a} onClick={() => setAmount(String(a))}
              className={`py-2.5 rounded-xl border text-sm font-semibold ${amount === String(a) ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600"}`}>
              {inr(a)}
            </button>
          ))}
        </div>
        <div>
          <Label className="text-xs text-gray-500">Or enter amount ({curSymbol()})</Label>
          <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className="mt-1" />
        </div>
        <Button
          className="w-full h-12 bg-primary hover:bg-primary/90"
          disabled={topup.isPending || !Number(amount)}
          onClick={() => topup.mutate(Number(amount))}
        >
          {topup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${amount ? inr(Number(amount)) : "money"}`}
        </Button>
        <p className="text-[11px] text-center text-gray-400">Demo top-up · no real payment is taken</p>
      </div>
    </div>
  );
}

function billing(elapsedSec: number, ratePer15: number) {
  const blocks = Math.max(1, Math.ceil(elapsedSec / (15 * 60)));
  return { blocks, cost: blocks * ratePer15 };
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Voice notes are capped at 60s so the base64 payload stays well within the
// API's upload limit on a slow rural connection.
const MAX_VOICE_SEC = 60;

function ChatView({ view, balance, onBack }: { view: { doctor: Agronomist; consultationId: number }; balance: number; onBack: () => void }) {
  const { doctor, consultationId } = view;
  const ratePer15 = Number(doctor.ratePer15Min);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState<{ cost: number; minutes: number; doctorEarning: number; platformFee: number } | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [] } = useQuery<ConsultMessage[]>({
    queryKey: ["consultation-messages", consultationId],
    queryFn: () => apiFetch(`/consultations/${consultationId}/messages`),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [ended]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // Stop any in-progress recording if the farmer navigates away mid-note.
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }, []);

  const send = useMutation({
    mutationFn: (payload: { text: string; mediaType?: "image" | "audio"; mediaUrl?: string }) =>
      apiMutate("POST", `/consultations/${consultationId}/messages`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultation-messages", consultationId] }),
    onError: (err: unknown) => {
      const tooLarge = err instanceof ApiError && err.status === 413;
      toast({
        title: "Could not send",
        description: tooLarge ? "That file is too large. Try a smaller photo or a shorter voice note." : "Please check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const end = useMutation({
    mutationFn: () => apiMutate<{ cost: number; minutes: number; doctorEarning: number; platformFee: number }>("POST", `/consultations/${consultationId}/end`, { durationSeconds: elapsed }),
    onSuccess: (res) => { if (res) setEnded({ cost: res.cost, minutes: res.minutes, doctorEarning: res.doctorEarning, platformFee: res.platformFee }); },
  });

  const { cost } = billing(elapsed, ratePer15);

  const handleSend = () => {
    const t = input.trim();
    if ((!t && !pendingImage) || send.isPending) return;
    setInput("");
    if (pendingImage) {
      const img = pendingImage;
      setPendingImage(null);
      send.mutate({ text: t, mediaType: "image", mediaUrl: img });
    } else {
      send.mutate({ text: t });
    }
  };

  // Doctors need to actually see crop symptoms clearly, so compress with the
  // same "AI-grade" profile disease.tsx uses rather than squeezing it down to
  // record-only quality.
  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const raw = await fileToDataUrl(file);
      const compressed = await compressForAI(raw);
      setPendingImage(compressed);
    } catch {
      toast({ title: "Could not read that photo", variant: "destructive" });
    } finally {
      setPhotoBusy(false);
    }
  }

  const stopRecording = () => recorderRef.current?.stop();

  async function startRecording() {
    if (recording || send.isPending) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({ title: "Microphone not available", description: "Please allow microphone access to record a voice note.", variant: "destructive" });
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
      setRecording(false);
      setRecordSec(0);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1000) return; // too short to be a real note
      const reader = new FileReader();
      reader.onload = () => send.mutate({ text: "", mediaType: "audio", mediaUrl: String(reader.result) });
      reader.readAsDataURL(blob);
    };
    recorderRef.current = rec;
    setRecording(true);
    setRecordSec(0);
    rec.start();
    recordTimerRef.current = setInterval(() => {
      setRecordSec((s) => {
        if (s + 1 >= MAX_VOICE_SEC) stopRecording();
        return s + 1;
      });
    }, 1000);
  }

  if (ended) {
    return (
      <PageShell title="Consultation ended">
        <div className="p-4 flex flex-col items-center justify-center text-center gap-3 mt-10">
          <div className="bg-primary/10 rounded-full p-4"><BadgeCheck className="h-10 w-10 text-primary" /></div>
          <h2 className="text-lg font-bold text-gray-900">Consultation complete</h2>
          <p className="text-sm text-gray-500">{doctor.name} · {ended.minutes} min</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 w-full max-w-xs">
            <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Charged</span><span className="font-semibold">{inr(ended.cost)}</span></div>
            <div className="flex justify-between text-xs py-0.5"><span className="text-gray-400 pl-2">↳ Doctor (80%)</span><span className="text-gray-600">{inr(ended.doctorEarning)}</span></div>
            <div className="flex justify-between text-xs py-0.5 border-b border-gray-100 pb-1.5 mb-0.5"><span className="text-gray-400 pl-2">↳ Platform fee (20%)</span><span className="text-gray-600">{inr(ended.platformFee)}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Wallet balance</span><span className="font-semibold">{inr(balance - ended.cost)}</span></div>
          </div>
          <Button className="mt-2 bg-primary hover:bg-primary/90" onClick={onBack}>Back to doctors</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={doctor.name}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-xs">
          <button onClick={() => end.mutate()} className="flex items-center gap-1 font-medium">
            <ArrowLeft className="h-3.5 w-3.5" /> End & bill
          </button>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtClock(elapsed)}</span>
            <span className="font-semibold">{inr(cost)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m) => {
            const isFarmer = m.sender === "farmer";
            return (
              <div key={m.id} className={`flex gap-2 ${isFarmer ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base ${isFarmer ? "bg-primary" : "bg-primary/5"}`}>
                  {isFarmer ? "🧑‍🌾" : doctor.emoji}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  isFarmer ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                }`}>
                  {m.mediaType === "image" && m.mediaUrl && (
                    <img src={m.mediaUrl} alt="Attached crop photo" className="rounded-xl max-h-56 w-full object-contain bg-black/5 mb-1.5" />
                  )}
                  {m.mediaType === "audio" && m.mediaUrl && (
                    <audio controls src={m.mediaUrl} className="w-56 max-w-full mb-1.5 h-10" />
                  )}
                  {m.text && <span>{m.text}</span>}
                </div>
              </div>
            );
          })}
          {send.isPending && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-base">{doctor.emoji}</div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-200 bg-white p-3">
          {pendingImage && (
            <div className="mb-2 relative inline-block">
              <img src={pendingImage} alt="Photo to send" className="h-20 rounded-xl border border-gray-200 object-cover" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {recording ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 h-11">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-600">Recording… {fmtClock(recordSec)}</span>
              </div>
              <Button size="icon" className="h-11 w-11 bg-red-500 hover:bg-red-600 flex-shrink-0" onClick={stopRecording} aria-label="Stop and send voice note">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoFile} />
              <Button
                size="icon" variant="outline" className="h-11 w-11 flex-shrink-0 text-gray-600"
                disabled={send.isPending || photoBusy} onClick={() => photoRef.current?.click()} aria-label="Attach a photo"
              >
                {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" />}
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Describe your crop problem…"
                rows={1}
                className="resize-none min-h-[44px] max-h-32"
              />
              {input.trim() || pendingImage ? (
                <Button size="icon" className="h-11 w-11 bg-primary hover:bg-primary/90 flex-shrink-0" disabled={send.isPending} onClick={handleSend} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" className="h-11 w-11 bg-primary hover:bg-primary/90 flex-shrink-0" disabled={send.isPending} onClick={startRecording} aria-label="Record a voice note">
                  <Mic className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function CallView({ view, balance, onBack }: { view: { doctor: Agronomist; consultationId: number }; balance: number; onBack: () => void }) {
  const { doctor, consultationId } = view;
  const ratePer15 = Number(doctor.ratePer15Min);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState<{ cost: number; minutes: number; doctorEarning: number; platformFee: number } | null>(null);

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [ended]);

  const end = useMutation({
    mutationFn: () => apiMutate<{ cost: number; minutes: number; doctorEarning: number; platformFee: number }>("POST", `/consultations/${consultationId}/end`, { durationSeconds: elapsed }),
    onSuccess: (res) => { if (res) setEnded({ cost: res.cost, minutes: res.minutes, doctorEarning: res.doctorEarning, platformFee: res.platformFee }); },
  });

  const { cost } = billing(elapsed, ratePer15);

  if (ended) {
    return (
      <PageShell title="Call ended">
        <div className="p-4 flex flex-col items-center justify-center text-center gap-3 mt-10">
          <div className="bg-primary/10 rounded-full p-4"><BadgeCheck className="h-10 w-10 text-primary" /></div>
          <h2 className="text-lg font-bold text-gray-900">Call complete</h2>
          <p className="text-sm text-gray-500">{doctor.name} · {ended.minutes} min</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 w-full max-w-xs">
            <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Charged</span><span className="font-semibold">{inr(ended.cost)}</span></div>
            <div className="flex justify-between text-xs py-0.5"><span className="text-gray-400 pl-2">↳ Doctor (80%)</span><span className="text-gray-600">{inr(ended.doctorEarning)}</span></div>
            <div className="flex justify-between text-xs py-0.5 border-b border-gray-100 pb-1.5 mb-0.5"><span className="text-gray-400 pl-2">↳ Platform fee (20%)</span><span className="text-gray-600">{inr(ended.platformFee)}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-gray-500">Wallet balance</span><span className="font-semibold">{inr(balance - ended.cost)}</span></div>
          </div>
          <Button className="mt-2 bg-primary hover:bg-primary/90" onClick={onBack}>Back to doctors</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="On call">
      <div className="flex flex-col items-center justify-between h-[calc(100vh-3.5rem)] bg-gradient-to-b from-primary to-violet-600 text-white py-12">
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="text-6xl bg-white/15 rounded-full h-28 w-28 flex items-center justify-center">{doctor.emoji}</div>
          <h2 className="text-xl font-bold">{doctor.name}</h2>
          <p className="text-primary-foreground/80 text-sm">{doctor.speciality}</p>
          <p className="text-primary-foreground/80 text-xs mt-2">Connected · {fmtClock(elapsed)}</p>
        </div>

        <div className="text-center">
          <p className="text-primary-foreground/80 text-xs">Current charge</p>
          <p className="text-3xl font-bold">{inr(cost)}</p>
          <p className="text-primary-foreground/80 text-[11px] mt-1">{inr(ratePer15)} per 15 minutes</p>
        </div>

        <button
          onClick={() => end.mutate()}
          disabled={end.isPending}
          className="bg-red-500 hover:bg-red-600 rounded-full h-16 w-16 flex items-center justify-center shadow-lg"
        >
          {end.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <PhoneOff className="h-7 w-7" />}
        </button>
      </div>
    </PageShell>
  );
}

const SPECIALITIES = [
  "Crop Disease & Pest Management",
  "Soil Health & Nutrition",
  "Horticulture & High-Value Crops",
  "Irrigation & Water Management",
  "Organic Farming",
  "Dairy & Livestock",
  "Seeds & Plant Breeding",
  "Other",
];

function RegisterView({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const certRef = useRef<HTMLInputElement>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [form, setForm] = useState({
    name: "", speciality: SPECIALITIES[0], qualification: "", workplace: "",
    location: "", languages: "", experience: "", contactPhone: "", ratePer15Min: "100", bio: "",
    certificateUrl: "",
    accountHolderName: "", bankAccountNumber: "", ifscCode: "", upiId: "", panNumber: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onCertFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compressed = await compressCertificate(dataUrl);
      if (compressed.length > 3.5 * 1024 * 1024) {
        toast({ title: "That photo is too large", description: "Please try a smaller or clearer photo of your certificate.", variant: "destructive" });
        return;
      }
      set("certificateUrl", compressed);
    } catch {
      toast({ title: "Could not read that image", variant: "destructive" });
    } finally {
      setCertUploading(false);
      if (certRef.current) certRef.current.value = "";
    }
  }

  const create = useMutation({
    mutationFn: () => apiMutate("POST", "/agronomists", {
      ...form,
      consultationPlan: `${inr(Number(form.ratePer15Min) || 0)} per 15 min`,
    }),
    onSuccess: (res) => {
      toast(res
        ? { title: "Your profile is live!", description: "Farmers can now consult you." }
        : { title: "Saved offline", description: "Your profile will publish when you're back online." });
      onDone();
    },
    onError: (e: unknown) => toast({
      title: "Could not save profile",
      description: e instanceof Error ? e.message : undefined,
      variant: "destructive",
    }),
  });

  const hasBank = form.accountHolderName.trim() && form.bankAccountNumber.trim() && form.ifscCode.trim();
  const hasPayout = Boolean(hasBank || form.upiId.trim());
  const hasCredentials = Boolean(form.qualification.trim() && form.experience.trim() && form.certificateUrl);
  const canSubmit = form.name.trim() && form.speciality.trim() && hasCredentials && hasPayout;

  return (
    <PageShell title="Add Doctor Profile">
      <div className="p-4 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-sm text-gray-500">
          Agronomists, professors and crop doctors — add your details so farmers and planters can find and consult you.
        </p>

        <div className="space-y-3">
          <Field label="Full name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Dr. Suresh Kumar" /></Field>
          <Field label="Speciality *">
            <select value={form.speciality} onChange={(e) => set("speciality", e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {SPECIALITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Agriculture qualification *"><Input value={form.qualification} onChange={(e) => set("qualification", e.target.value)} placeholder="B.Sc. / M.Sc. / Ph.D. Agriculture" /></Field>
          <Field label="Years of experience *"><Input value={form.experience} onChange={(e) => set("experience", e.target.value)} placeholder="12 years" /></Field>
          <Field label="Where do you work"><Input value={form.workplace} onChange={(e) => set("workplace", e.target.value)} placeholder="Agricultural University / KVK / Private" /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="District, State" /></Field>
          <Field label="Languages"><Input value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="Hindi, English" /></Field>
          <Field label="Contact phone"><Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+91 ..." inputMode="tel" /></Field>
          <Field label={`Consultation fee per 15 min (${curSymbol()})`}><Input type="number" inputMode="numeric" value={form.ratePer15Min} onChange={(e) => set("ratePer15Min", e.target.value)} /></Field>
          <Field label="About you"><Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} placeholder="How you help farmers improve their yield…" /></Field>
        </div>

        {/* Education certificate — required proof of agricultural credentials */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">Agriculture education certificate *</p>
              <p className="text-xs text-primary">Upload a clear photo of your agriculture degree or certificate. This is required to become an Agri Doctor so farmers can trust your credentials.</p>
            </div>
          </div>
          <input ref={certRef} type="file" accept="image/*" className="hidden" onChange={onCertFile} />
          {form.certificateUrl ? (
            <div className="space-y-2">
              <img src={form.certificateUrl} alt="Certificate preview" className="w-full max-h-56 object-contain rounded-lg border border-primary/20 bg-white" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-primary font-medium"><CheckCircle2 className="h-4 w-4" /> Certificate added</span>
                <button type="button" onClick={() => certRef.current?.click()} className="text-xs text-primary underline">Replace</button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-primary/30 text-primary"
              disabled={certUploading}
              onClick={() => certRef.current?.click()}
            >
              {certUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" /> Upload certificate photo</>}
            </Button>
          )}
        </div>

        {/* Payout details — required so the 80% consultation share can be deposited */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
          <div className="flex items-start gap-2">
            <Landmark className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Payout details</p>
              <p className="text-xs text-amber-700">Where should we deposit your 80% share? Add a bank account or a UPI ID. This is required before you can consult online and is never shown to farmers.</p>
            </div>
          </div>
          <Field label="Account holder name"><Input value={form.accountHolderName} onChange={(e) => set("accountHolderName", e.target.value)} placeholder="As per bank records" /></Field>
          <Field label="Bank account number"><Input inputMode="numeric" value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} placeholder="e.g. 123456789012" /></Field>
          <Field label="IFSC code"><Input value={form.ifscCode} onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" /></Field>
          <div className="flex items-center gap-2 text-xs text-amber-700"><span className="h-px flex-1 bg-amber-200" />OR<span className="h-px flex-1 bg-amber-200" /></div>
          <Field label="UPI ID"><Input value={form.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder="e.g. name@bank" /></Field>
          <Field label="PAN (optional, for tax)"><Input value={form.panNumber} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} placeholder="e.g. ABCDE1234F" /></Field>
          {!hasPayout && <p className="text-xs text-amber-800 font-medium">Add full bank details or a UPI ID to publish your profile.</p>}
        </div>

        {!hasCredentials && (
          <p className="text-xs text-gray-500">Add your qualification, experience and education certificate to publish your profile.</p>
        )}
        <Button className="w-full h-12 bg-primary hover:bg-primary/90" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish my profile"}
        </Button>
      </div>
    </PageShell>
  );
}

// Compress a certificate photo to keep the base64 payload well under the API's
// ~3.5MB cap (base64 in a text column bloats the DB otherwise).
function compressCertificate(dataUrl: string, maxW = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, maxW / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ExpertHub({ onBack, onRegister, onEarnings }: { onBack: () => void; onRegister: () => void; onEarnings: () => void }) {
  return (
    <PageShell title="Agriculture Expert" onBack={onBack}>
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary to-violet-500 rounded-2xl p-5 text-white">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3">
            <BadgeCheck className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-bold">For agriculture experts</h2>
          <p className="text-primary-foreground/80 text-sm mt-1 leading-relaxed">
            Offer paid consultations to farmers, and track and withdraw your earnings — all in one place.
          </p>
        </div>

        <button
          onClick={onRegister}
          className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 transition-colors"
        >
          <div className="bg-primary/10 rounded-xl p-2.5"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Add doctor profile</p>
            <p className="text-xs text-gray-500">Register with your credentials so farmers can consult you</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>

        <button
          onClick={onEarnings}
          className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 transition-colors"
        >
          <div className="bg-amber-100 rounded-xl p-2.5"><Banknote className="h-5 w-5 text-amber-600" /></div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Earnings &amp; payouts</p>
            <p className="text-xs text-gray-500">Track your 80% share and withdraw to your bank</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>
      </div>
    </PageShell>
  );
}

function EarningsView({ doctors, onBack }: { doctors: Agronomist[]; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const { data: earnings, isLoading } = useQuery<Earnings>({
    queryKey: ["earnings", selectedId],
    queryFn: () => apiFetch(`/agronomists/${selectedId}/earnings`),
    enabled: selectedId != null,
  });

  const requestPayout = useMutation({
    mutationFn: (amt: number) => apiMutate("POST", `/agronomists/${selectedId}/payouts`, { amount: amt }),
    onSuccess: () => {
      toast({ title: "Payout requested", description: "It will move to your account once processed." });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["earnings", selectedId] });
    },
    onError: (e: unknown) => toast({ title: "Could not request payout", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });

  const markPaid = useMutation({
    mutationFn: (payoutId: number) => apiMutate("POST", `/agronomists/${selectedId}/payouts/${payoutId}/paid`, {}),
    onSuccess: () => {
      toast({ title: "Marked as paid" });
      qc.invalidateQueries({ queryKey: ["earnings", selectedId] });
    },
    onError: (e: unknown) => toast({ title: "Could not update payout", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });

  if (selectedId == null) {
    return (
      <PageShell title="Earnings & Payouts">
        <div className="p-4 space-y-4">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <p className="text-sm text-gray-500">Select your doctor profile to see your consultation earnings and request a payout.</p>
          <div className="space-y-2">
            {doctors.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className="w-full text-left bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 transition-colors"
              >
                <div className="text-2xl bg-primary/5 rounded-lg h-11 w-11 flex items-center justify-center flex-shrink-0">{d.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{d.name}</p>
                  <p className="text-xs text-primary truncate">{d.speciality}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            ))}
            {doctors.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No doctor profiles yet.</p>}
          </div>
        </div>
      </PageShell>
    );
  }

  const pm = earnings?.payoutMethod;
  const amt = Number(amount);
  const canRequest = amt > 0 && earnings != null && amt <= earnings.available && earnings.payoutReady;

  return (
    <PageShell title="Earnings & Payouts">
      <div className="p-4 space-y-4">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft className="h-4 w-4" /> All doctors
        </button>

        {isLoading || !earnings ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-primary to-violet-700 rounded-2xl p-5 text-white shadow-sm">
              <p className="text-xs text-primary-foreground/80">Available to withdraw</p>
              <div className="mt-0.5">
                <span className="text-3xl font-bold">{fmtMoney(earnings.available)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="bg-white/10 rounded-lg py-2">
                  <p className="text-[11px] text-primary-foreground/80">Total earned</p>
                  <p className="text-sm font-semibold">{inr(earnings.totalEarnings)}</p>
                </div>
                <div className="bg-white/10 rounded-lg py-2">
                  <p className="text-[11px] text-primary-foreground/80">Paid out</p>
                  <p className="text-sm font-semibold">{inr(earnings.paidOut)}</p>
                </div>
                <div className="bg-white/10 rounded-lg py-2">
                  <p className="text-[11px] text-primary-foreground/80">Pending</p>
                  <p className="text-sm font-semibold">{inr(earnings.pending)}</p>
                </div>
              </div>
            </div>

            {/* Payout method */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-gray-900">Payout method</h3>
              </div>
              {earnings.payoutReady && pm ? (
                <div className="space-y-1 text-sm text-gray-700">
                  {pm.accountHolderName && <div className="flex justify-between"><span className="text-gray-400">Holder</span><span className="font-medium">{pm.accountHolderName}</span></div>}
                  {pm.bankAccountNumber && <div className="flex justify-between"><span className="text-gray-400">Account</span><span className="font-medium">{pm.bankAccountNumber}</span></div>}
                  {pm.ifscCode && <div className="flex justify-between"><span className="text-gray-400">IFSC</span><span className="font-medium">{pm.ifscCode}</span></div>}
                  {pm.upiId && <div className="flex justify-between"><span className="text-gray-400">UPI</span><span className="font-medium">{pm.upiId}</span></div>}
                  {pm.panNumber && <div className="flex justify-between"><span className="text-gray-400">PAN</span><span className="font-medium">{pm.panNumber}</span></div>}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span>No payout details on file. Edit this profile to add a bank account or UPI ID before withdrawing.</span>
                </div>
              )}
            </div>

            {/* Request payout */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Request a payout</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max ${inr(earnings.available)}`}
                  className="flex-1"
                />
                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={!canRequest || requestPayout.isPending}
                  onClick={() => requestPayout.mutate(amt)}
                >
                  {requestPayout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request"}
                </Button>
              </div>
              {amount !== "" && amt > earnings.available && (
                <p className="text-xs text-red-600">Amount can't be more than your available balance.</p>
              )}
            </div>

            {/* History */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Payout history</h3>
              {earnings.payouts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No payouts yet.</p>
              ) : (
                <div className="space-y-2">
                  {earnings.payouts.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.status === "paid"
                            ? <CheckCircle2 className="h-4 w-4 text-primary" />
                            : <Clock className="h-4 w-4 text-amber-500" />}
                          <div>
                            <p className="font-semibold text-gray-900">{inr(Number(p.amount))}</p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(p.createdAt).toLocaleDateString("en-IN")} · {p.method.toUpperCase()}
                              {p.reference ? ` · ${p.reference}` : ""}
                            </p>
                          </div>
                        </div>
                        {p.status === "paid" ? (
                          <span className="text-[11px] font-medium text-primary bg-primary/5 rounded-full px-2 py-0.5">Paid</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={markPaid.isPending}
                            onClick={() => markPaid.mutate(p.id)}
                          >
                            Mark paid
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-gray-500 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
