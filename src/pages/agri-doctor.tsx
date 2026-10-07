import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stethoscope, MapPin, Phone, MessageCircle, Plus, ArrowLeft, Clock, GraduationCap, Briefcase, Languages, Loader2, BadgeCheck, Lock, CheckCircle2, ChevronRight, FileText, Upload, UserPlus
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch, apiMutate, isGateError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";

// Agri Doctor is a directory of agriculture doctors, nearest to the farm first.
// Farmers call or WhatsApp a doctor directly; the numbers unlock once per
// account for a small wallet fee and stay open for every doctor.

interface Agronomist {
  id: number;
  name: string;
  emoji: string;
  speciality: string;
  qualification: string | null;
  workplace: string | null;
  location: string | null;
  languages: string | null;
  experience: string | null;
  /** Only once this account has unlocked doctors' numbers. */
  contactPhone: string | null;
  /** The doctor has a number, hidden until unlocked. */
  contactLocked: boolean;
  /** Same district (or taluk) as the active farm. */
  nearby?: boolean;
  bio: string | null;
}

interface AppSettings {
  walletBalance: string;
  canUseAgriDoctor: boolean;
  doctorContactsUnlocked?: boolean;
  doctorContactsFee?: number;
}

type View =
  | { name: "directory" }
  | { name: "profile"; doctorId: number }
  | { name: "expert" }
  | { name: "register" };

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function whatsappHref(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}`;
}

function ContactButtons({ phone }: { phone: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={telHref(phone)} onClick={(e) => e.stopPropagation()}>
        <Button className="w-full h-11 bg-primary hover:bg-primary/90"><Phone className="h-4 w-4 mr-1.5" /> Call</Button>
      </a>
      <a href={whatsappHref(phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"><MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp</Button>
      </a>
    </div>
  );
}

function UnlockCard({ fee, pending, onUnlock, compact }: { fee: number; pending: boolean; onUnlock: () => void; compact?: boolean }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="bg-amber-100 rounded-xl p-2 flex-shrink-0"><Lock className="h-5 w-5 text-amber-600" /></div>
        <div>
          {!compact && <p className="font-bold text-amber-900">See every doctor's number</p>}
          <p className="text-sm text-amber-800">
            Pay ₹{fee} once from your wallet. All numbers stay open for you, including doctors who join later.
          </p>
        </div>
      </div>
      <Button className="w-full h-11 bg-primary hover:bg-primary/90" disabled={pending} onClick={onUnlock}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Unlock numbers · ₹${fee}`}
      </Button>
    </div>
  );
}

export default function AgriDoctor() {
  const [view, setView] = useState<View>({ name: "directory" });
  const qc = useQueryClient();
  const { toast } = useToast();

  // Inner screens are history steps: directory (0) → profile/expert (1) → register (2).
  const viewDepth = view.name === "directory" ? 0 : view.name === "register" ? 2 : 1;
  useSubScreenHistory(viewDepth, () => {
    setView((v) => (v.name === "register" ? { name: "expert" } : { name: "directory" }));
  });

  const { data: doctors = [], isLoading } = useQuery<Agronomist[]>({
    queryKey: ["agronomists"],
    queryFn: () => apiFetch("/agronomists"),
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => apiFetch("/app-settings"),
  });
  const fee = settings?.doctorContactsFee ?? 10;

  const unlock = useMutation({
    mutationFn: () => apiFetch<{ unlocked: boolean; charged: number }>("/agronomists/contacts/unlock", { method: "POST" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["agronomists"] });
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      if (res?.charged) toast({ title: "Numbers unlocked", description: `₹${res.charged} was taken from your wallet.` });
    },
    // A short wallet is handled by the app-wide recharge prompt.
    onError: (e: unknown) => {
      if (isGateError(e)) return;
      toast({ title: "Couldn't unlock", description: "Please try again.", variant: "destructive" });
    },
  });
  const confirmUnlock = () => {
    if (window.confirm(`₹${fee} will be taken from your wallet, once. You'll see every doctor's number from then on.`)) unlock.mutate();
  };

  if (view.name === "expert") {
    return <ExpertHub onBack={() => setView({ name: "directory" })} onRegister={() => setView({ name: "register" })} />;
  }
  if (view.name === "register") {
    return <RegisterView onBack={() => setView({ name: "expert" })} onDone={() => { setView({ name: "directory" }); qc.invalidateQueries({ queryKey: ["agronomists"] }); }} />;
  }
  if (view.name === "profile") {
    const d = doctors.find((x) => x.id === view.doctorId);
    if (!d) {
      return (
        <PageShell title="Doctor Profile" onBack={() => setView({ name: "directory" })}>
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        </PageShell>
      );
    }
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
          </div>

          {d.contactPhone ? (
            <ContactButtons phone={d.contactPhone} />
          ) : d.contactLocked ? (
            <UnlockCard fee={fee} pending={unlock.isPending} onUnlock={confirmUnlock} compact />
          ) : null}
        </div>
      </PageShell>
    );
  }

  const hero = (
    <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-4 text-white">
      <div className="flex items-center gap-2">
        <div className="bg-white/20 rounded-xl p-2"><Stethoscope className="h-5 w-5" /></div>
        <div>
          <h2 className="font-bold">Agriculture Doctor</h2>
          <p className="text-primary-foreground/80 text-xs">Agronomists and crop doctors near your farm. Call them directly.</p>
        </div>
      </div>
    </div>
  );

  if (settings && !settings.canUseAgriDoctor) {
    return (
      <PageShell title="Agri Doctor" back="/">
        <div className="p-4 space-y-4">
          {hero}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <p className="font-bold text-amber-900">Subscribe to use Agri Doctor</p>
            <p className="text-sm text-amber-700 mt-1">
              Find agriculture doctors near your farm and get their numbers with a Chiguru plan.
            </p>
            <Link href="/subscription" className="inline-block mt-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-11 leading-[44px] font-bold">
              See plans
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const needsUnlock = doctors.some((d) => d.contactLocked);

  return (
    <PageShell title="Agri Doctor" back="/">
      <div className="p-4 space-y-4">
        {hero}

        {needsUnlock && <UnlockCard fee={fee} pending={unlock.isPending} onUnlock={confirmUnlock} />}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Doctors near you</h3>
            <button onClick={() => setView({ name: "expert" })} className="flex items-center gap-1 text-sm font-semibold text-primary min-h-[44px] px-1">
              <Plus className="h-4 w-4" /> I'm a doctor
            </button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : doctors.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center text-sm text-gray-500">
              No agriculture doctors are listed yet. Check back soon.
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.map((d) => (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setView({ name: "profile", doctorId: d.id })}
                  onKeyDown={(e) => { if (e.key === "Enter") setView({ name: "profile", doctorId: d.id }); }}
                  className="w-full text-left bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl bg-primary/5 rounded-xl h-14 w-14 flex items-center justify-center flex-shrink-0">{d.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900 truncate">{d.name}</h4>
                        {d.nearby && <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Near you</span>}
                      </div>
                      <p className="text-xs text-primary font-medium truncate">{d.speciality}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        {d.experience && <span>{d.experience}</span>}
                        {d.location && <><span>·</span><span className="truncate">{d.location}</span></>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 mt-1" />
                  </div>
                  {d.contactPhone ? (
                    <ContactButtons phone={d.contactPhone} />
                  ) : d.contactLocked ? (
                    <p className="flex items-center gap-1.5 text-xs text-gray-400"><Lock className="h-3.5 w-3.5" /> Number hidden · unlock above</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
    location: "", languages: "", experience: "", contactPhone: "", bio: "",
    certificateUrl: "",
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
    mutationFn: () => apiMutate("POST", "/agronomists", form),
    onSuccess: (res) => {
      toast(res
        ? { title: "Your profile is live!", description: "Farmers near you can now find and call you." }
        : { title: "Saved offline", description: "Your profile will publish when you're back online." });
      onDone();
    },
    onError: (e: unknown) => toast({
      title: "Could not save profile",
      description: e instanceof Error ? e.message : undefined,
      variant: "destructive",
    }),
  });

  const hasContact = form.contactPhone.replace(/\D/g, "").length >= 10 && Boolean(form.location.trim());
  const hasCredentials = Boolean(form.qualification.trim() && form.experience.trim() && form.certificateUrl);
  const canSubmit = form.name.trim() && form.speciality.trim() && hasCredentials && hasContact;

  return (
    <PageShell title="Add Doctor Profile">
      <div className="p-4 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <p className="text-sm text-gray-500">
          Agronomists, professors and crop doctors — add your details so farmers and planters near you can find and call you.
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
          <Field label="Town, district *"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Mudigere, Chikkamagaluru, Karnataka" /></Field>
          <Field label="Languages"><Input value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="Hindi, English" /></Field>
          <Field label="Phone number farmers can call *"><Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+91 ..." inputMode="tel" /></Field>
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


        {!hasContact && (
          <p className="text-xs text-gray-500">Add your phone number and town so nearby farmers can reach you.</p>
        )}
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

function ExpertHub({ onBack, onRegister }: { onBack: () => void; onRegister: () => void }) {
  return (
    <PageShell title="Agriculture Expert" onBack={onBack}>
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary to-violet-500 rounded-2xl p-5 text-white">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3">
            <BadgeCheck className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-lg font-bold">For agriculture experts</h2>
          <p className="text-primary-foreground/80 text-sm mt-1 leading-relaxed">
            List yourself so farmers near you can find you and call you directly.
          </p>
        </div>

        <button
          onClick={onRegister}
          className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 transition-colors"
        >
          <div className="bg-primary/10 rounded-xl p-2.5"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Add doctor profile</p>
            <p className="text-xs text-gray-500">Your credentials, phone number and town</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>

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
