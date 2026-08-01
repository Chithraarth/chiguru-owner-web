import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, RefreshCcw, UserCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WorkerNameInput } from "@/components/worker-name-input";
import { apiMutate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  compactDescriptor,
  descriptorDistance,
  detectFace,
  loadFaceModels,
  matchWorker,
  type FaceWorkerLike,
} from "@/lib/face";

type Phase = "loading" | "scanning" | "register" | "error";

interface FaceAttendanceProps {
  workers: FaceWorkerLike[];
  /** Workers already marked present today — recognized again, we just say so. */
  presentWorkerIds: Set<number>;
  /** Called once per newly recognized worker; parent records the attendance. */
  onMarkPresent: (workerId: number) => Promise<void>;
  onClose: () => void;
}

export function FaceAttendance({ workers, presentWorkerIds, onMarkPresent, onClose }: FaceAttendanceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const markedRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef<Phase>("loading");
  const qc = useQueryClient();
  const { toast } = useToast();

  const [phase, setPhaseState] = useState<Phase>("loading");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [errorMsg, setErrorMsg] = useState("");
  const [banner, setBanner] = useState<{ kind: "ok" | "info"; text: string } | null>(null);
  const [sessionMarked, setSessionMarked] = useState<string[]>([]);
  const [regDescriptors, setRegDescriptors] = useState<number[][]>([]);
  const [regWorker, setRegWorker] = useState<{ name: string; id: number | null }>({ name: "", id: null });
  const [saving, setSaving] = useState(false);
  // A passer-by in the background shouldn't interrupt scanning — only offer
  // registration after the SAME unknown face is seen several times in a row
  // (verified by descriptor similarity, with a short time-to-live).
  const unknownRef = useRef<{ desc: Float32Array; count: number; at: number } | null>(null);
  const lastCaptureRef = useRef(0);
  const regDescriptorsRef = useRef<number[][]>([]);
  // Sign of the head-turn for the 2nd pose, so the 3rd must be the opposite side.
  const regTurnSignRef = useRef(0);

  function setPhase(p: Phase) {
    phaseRef.current = p;
    setPhaseState(p);
  }

  // Start camera + models
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setPhase("loading");
      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false }),
          loadFaceModels(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setPhase("scanning");
      } catch {
        if (!cancelled) {
          setErrorMsg("Could not open the camera. Please allow camera access and try again.");
          setPhase("error");
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  // Recognition + registration-capture loop (fully automatic — no shutter button)
  useEffect(() => {
    const timer = setInterval(async () => {
      const currentPhase = phaseRef.current;
      if ((currentPhase !== "scanning" && currentPhase !== "register") || busyRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      busyRef.current = true;
      try {
        const face = await detectFace(video);
        if (!face) return;
        const { descriptor, yaw } = face;

        if (phaseRef.current === "register") {
          // Guided 3-pose capture, gated on actual head turn (not just time):
          //   1st: facing straight, 2nd: turned to one side, 3rd: turned to the other side.
          const count = regDescriptorsRef.current.length;
          if (count < 3 && Date.now() - lastCaptureRef.current >= 1200) {
            let poseOk = false;
            if (count === 0) {
              poseOk = Math.abs(yaw) < 0.12;
            } else if (count === 1) {
              poseOk = Math.abs(yaw) >= 0.18;
              if (poseOk) regTurnSignRef.current = Math.sign(yaw);
            } else {
              poseOk = Math.abs(yaw) >= 0.18 && Math.sign(yaw) === -regTurnSignRef.current;
            }
            if (poseOk) {
              lastCaptureRef.current = Date.now();
              const next = [...regDescriptorsRef.current, compactDescriptor(descriptor)];
              regDescriptorsRef.current = next;
              setRegDescriptors(next);
            }
          }
          return;
        }

        const match = matchWorker(descriptor, workers);
        if (match) {
          unknownRef.current = null;
          const { worker } = match;
          if (presentWorkerIds.has(worker.id) || markedRef.current.has(worker.id)) {
            setBanner({ kind: "info", text: `${worker.name} — already marked today ✔` });
          } else {
            markedRef.current.add(worker.id);
            try {
              await onMarkPresent(worker.id);
              setSessionMarked((s) => [worker.name, ...s]);
              setBanner({ kind: "ok", text: `✅ ${worker.name} marked present` });
            } catch {
              markedRef.current.delete(worker.id);
              setBanner({ kind: "info", text: `Could not save ${worker.name} — try again` });
            }
          }
        } else {
          // Unknown face — only offer registration after the SAME person is seen
          // several times in a row (descriptor similarity + short TTL), so a
          // passer-by in the background doesn't interrupt scanning.
          const now = Date.now();
          const prev = unknownRef.current;
          const samePerson =
            prev != null &&
            now - prev.at <= 5000 &&
            descriptorDistance(descriptor, prev.desc) <= 0.45;
          if (samePerson) {
            unknownRef.current = { desc: descriptor, count: prev.count + 1, at: now };
          } else {
            unknownRef.current = { desc: descriptor, count: 1, at: now };
          }
          if (unknownRef.current.count >= 3) {
            unknownRef.current = null;
            regTurnSignRef.current = 0;
            // Only count this sighting as the "straight" pose if they're facing the camera.
            const straight = Math.abs(yaw) < 0.12;
            regDescriptorsRef.current = straight ? [compactDescriptor(descriptor)] : [];
            setRegDescriptors(regDescriptorsRef.current);
            lastCaptureRef.current = Date.now();
            setRegWorker({ name: "", id: null });
            setPhase("register");
          }
        }
      } finally {
        busyRef.current = false;
      }
    }, 900);
    return () => clearInterval(timer);
  }, [workers, presentWorkerIds, onMarkPresent]);

  // Fade the banner after a moment
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2500);
    return () => clearTimeout(t);
  }, [banner]);

  async function saveFace() {
    const name = regWorker.name.trim();
    const descriptors = regDescriptorsRef.current;
    if (!name || descriptors.length === 0) return;
    setSaving(true);
    try {
      let workerId = regWorker.id
        ?? workers.find((w) => w.name.trim().toLowerCase() === name.toLowerCase())?.id
        ?? null;
      if (workerId == null) {
        const w = (await apiMutate("POST", "/workers", { name, isActive: true })) as { id: number } | undefined;
        if (!w) throw new Error("no response");
        workerId = w.id;
      }
      await apiMutate("PATCH", `/workers/${workerId}`, {
        faceDescriptor: JSON.stringify(descriptors),
      });
      qc.invalidateQueries({ queryKey: ["workers"] });
      // Mark them present right away — they just showed their face.
      if (!presentWorkerIds.has(workerId) && !markedRef.current.has(workerId)) {
        markedRef.current.add(workerId);
        try {
          await onMarkPresent(workerId);
          setSessionMarked((s) => [name, ...s]);
        } catch {
          markedRef.current.delete(workerId);
        }
      }
      setBanner({ kind: "ok", text: `✅ Face saved — ${name} marked present` });
      regDescriptorsRef.current = [];
      setRegDescriptors([]);
      setPhase("scanning");
    } catch {
      toast({ title: "Could not save the face", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          <span className="font-semibold">Face Attendance</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            aria-label="Flip camera"
          >
            <RefreshCcw className="h-5 w-5" />
          </button>
          <button onClick={onClose} aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Camera */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
        />

        {phase === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Starting camera & loading face model…</p>
            <p className="text-xs text-gray-400">First time may take a few seconds</p>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white px-8 text-center">
            <p className="text-sm">{errorMsg}</p>
            <Button onClick={onClose} variant="secondary">Close</Button>
          </div>
        )}

        {phase === "scanning" && (
          <>
            {/* Face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-72 rounded-[50%] border-2 border-white/60 border-dashed" />
            </div>
            <p className="absolute top-3 inset-x-0 text-center text-white/90 text-sm font-medium drop-shadow">
              Show your face inside the oval
            </p>
          </>
        )}

        {banner && (
          <div
            className={`absolute top-12 inset-x-4 rounded-xl px-4 py-3 text-center text-sm font-semibold shadow-lg ${
              banner.kind === "ok" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-white/95 text-gray-800"
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* Pose prompt while registering — shown over the camera, above the sheet */}
        {phase === "register" && regDescriptors.length < 3 && (
          <p className="absolute top-3 inset-x-0 text-center text-white text-base font-bold drop-shadow">
            {regDescriptors.length === 0 && "Look straight at the camera"}
            {regDescriptors.length === 1 && "Now turn your head slightly to one side"}
            {regDescriptors.length === 2 && "Now turn to the OTHER side"}
          </p>
        )}

        {/* First-time registration sheet */}
        {phase === "register" && (
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-gray-800">New face — who is this?</h3>
              </div>
              <button
                onClick={() => {
                  regDescriptorsRef.current = [];
                  setRegDescriptors([]);
                  setPhase("scanning");
                }}
                aria-label="Cancel registration"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              First time only — 3 photos are taken automatically (straight, left, right) so the face is
              recognized correctly from next time.
            </p>
            {/* 3-photo progress */}
            <div className="flex items-center gap-3">
              {["Straight", "Side 1", "Side 2"].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      regDescriptors.length > i ? "bg-primary" : "bg-gray-300 animate-pulse"
                    }`}
                  />
                  <span className={`text-xs ${regDescriptors.length > i ? "text-primary font-semibold" : "text-gray-400"}`}>
                    {label}
                  </span>
                </div>
              ))}
              <span className="ml-auto text-xs text-gray-500">
                {regDescriptors.length < 3 ? "Capturing…" : "All 3 done ✓"}
              </span>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Worker name *</Label>
              <WorkerNameInput
                workers={workers}
                value={regWorker.name}
                onChange={(name, id) => setRegWorker({ name, id })}
              />
            </div>
            <Button
              onClick={saveFace}
              disabled={saving || !regWorker.name.trim() || regDescriptors.length < 3}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : regDescriptors.length < 3 ? (
                `Taking photos… ${regDescriptors.length}/3`
              ) : (
                <span className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Save face & mark present</span>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Session summary */}
      {sessionMarked.length > 0 && phase !== "register" && (
        <div className="bg-black/90 text-white px-4 py-2 text-xs">
          Marked now: <span className="font-semibold">{sessionMarked.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
