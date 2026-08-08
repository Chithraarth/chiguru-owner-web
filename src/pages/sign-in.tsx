import { useEffect, useRef, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BrandLogo } from "@/components/brand-logo";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendPhoneOtp,
  type ConfirmationResult,
} from "@/lib/firebase";
import { DIAL_CODES, flagEmoji } from "@/lib/dial-codes";

type Mode = "signin" | "signup";
type Tab = "email" | "phone";

const RESEND_SECONDS = 60;

interface SignInPageProps {
  initialMode?: Mode;
}

// The auth-state listener in App.tsx swaps this page out for the app itself
// the moment any of these methods succeeds — no explicit redirect needed here.
export default function SignInPage({ initialMode = "signin" }: SignInPageProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("email");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dialCode, setDialCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startResendCountdown() {
    setResendIn(RESEND_SECONDS);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  // Firebase's own error messages are raw codes like "Error (auth/invalid-credential)."
  // — map the ones this page can actually trigger to plain language instead.
  const AUTH_ERROR_MESSAGES: Record<string, string> = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "Invalid email or password.",
    "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please try again in a few minutes.",
    "auth/user-disabled": "This account has been disabled. Contact support.",
    "auth/invalid-phone-number": "Please enter a valid phone number.",
    "auth/invalid-verification-code": "Incorrect OTP. Please try again.",
    "auth/code-expired": "This OTP has expired. Request a new one.",
    "auth/network-request-failed": "Network error — check your connection and try again.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
  };

  function handleError(err: unknown) {
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : null;
    const fallback = err instanceof Error ? err.message.replace(/^Firebase:\s*/, "") : "Something went wrong";
    setError((code && AUTH_ERROR_MESSAGES[code]) || fallback);
  }

  async function handleEmailSubmit() {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") await signInWithEmail(email.trim(), password);
      else await signUpWithEmail(email.trim(), password);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp(isResend: boolean) {
    const digits = phone.trim();
    if (!digits) return;
    setError(null);
    setLoading(true);
    try {
      const result = await sendPhoneOtp(`${dialCode}${digits}`, "recaptcha-container");
      setConfirmation(result);
      startResendCountdown();
      toast({ title: isResend ? "OTP resent" : "OTP sent", variant: "success" });
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!confirmation || !otp.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await confirmation.confirm(otp.trim());
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-5">
        <div className="text-center space-y-1">
          <BrandLogo className="h-12 w-12 mx-auto" />
          <h1 className="text-lg font-bold text-gray-800">
            {mode === "signin" ? "Welcome back to Chiguru" : "Create your Chiguru account"}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === "signin" ? "Sign in to manage your farm" : "Your farm data stays safe even if you lose your phone"}
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => {
              setTab("email");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === "email" ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}
          >
            Email
          </button>
          <button
            onClick={() => {
              setTab("phone");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === "phone" ? "bg-white text-primary shadow-sm" : "text-gray-500"}`}
          >
            Phone
          </button>
        </div>

        {tab === "email" ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl h-11 mt-1"
                autoComplete="email"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl h-11 pr-11"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-gray-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              onClick={handleEmailSubmit}
              disabled={loading || !email.trim() || !password}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
            <button
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setError(null);
              }}
              className="w-full text-center text-sm text-primary font-medium"
            >
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {!confirmation ? (
              <>
                <div>
                  <Label className="text-xs text-gray-500">Mobile number</Label>
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
                      placeholder="98765 43210"
                      className="rounded-xl h-11 flex-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => sendOtp(false)}
                  disabled={loading || !phone.trim()}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs text-gray-500">Enter the OTP sent to {dialCode}{phone}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="rounded-xl h-11 mt-1"
                    autoFocus
                  />
                </div>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={loading || !otp.trim()}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
                </Button>
                <button
                  onClick={() => sendOtp(true)}
                  disabled={loading || resendIn > 0}
                  className="w-full text-center text-sm font-medium text-primary disabled:text-gray-400"
                >
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                </button>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            {error}
          </div>
        )}

        {/* Once the OTP screen is showing, this is the only path to finish signing
            in — social sign-in doesn't apply mid-verification, so hide it rather
            than offer a confusing dead-end alternative. */}
        {!(tab === "phone" && confirmation) && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="space-y-2.5">
              <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full h-11 rounded-xl">
                Continue with Google
              </Button>
            </div>
          </>
        )}

        {/* Invisible reCAPTCHA anchor required by Firebase's phone-auth flow. */}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
