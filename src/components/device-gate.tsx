import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { signOutUser, getIdToken } from "@/lib/firebase";
import { Smartphone, LogOut, Loader2, ShieldAlert } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { getDeviceId, describeDevice } from "@/lib/device";

interface DeviceInfo {
  id: number;
  deviceId: string;
  deviceName: string | null;
  lastSeenAt: string;
  createdAt: string;
}

const RECHECK_MS = 60_000;

/**
 * Enforces the 2-devices-per-account limit. While the user is signed in, this
 * device registers itself with the API; if the account is already active on 2
 * other devices, the app is replaced with a blocked screen where the farmer can
 * log one of the old devices out (so losing a phone never locks them out) or
 * sign out here.
 *
 * Offline-first: if the check can't reach the server (offline / flaky network),
 * the app stays usable — the limit is enforced whenever we're online.
 *
 * Non-blocking: the app renders immediately while the check runs in the
 * background; if the server answers "device_limit" the blocked screen replaces
 * the app. This keeps startup instant on slow rural networks.
 */
export function DeviceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isSignedIn = !!user;
  const [blocked, setBlocked] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const checkingRef = useRef(false);
  // Bumped on every auth change (sign-in/out, account switch) so responses from
  // a previous auth context can never overwrite the current blocked state.
  const epochRef = useRef(0);

  const runCheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    const epoch = epochRef.current;
    try {
      const token = await getIdToken();
      const res = await fetch(apiUrl("/me/devices/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deviceId: getDeviceId(), deviceName: describeDevice() }),
      });
      if (epoch !== epochRef.current) return; // stale response — auth changed mid-flight
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        if (epoch !== epochRef.current) return;
        if (body?.error === "device_limit") {
          setDevices(Array.isArray(body.devices) ? body.devices : []);
          setBlocked(true);
          return;
        }
      }
      if (res.ok) setBlocked(false);
      // 401 (session expired mid-flight) and other statuses: leave state as-is.
    } catch {
      // Offline or server unreachable — never lock the farmer out in the field.
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    epochRef.current += 1;
    if (!isSignedIn) {
      setBlocked(false);
      return;
    }
    // Fresh account → drop any state from the previous one before re-checking.
    setBlocked(false);
    setDevices([]);
    runCheck();
    const t = setInterval(runCheck, RECHECK_MS);
    return () => clearInterval(t);
  }, [isSignedIn, user?.uid, runCheck]);

  const removeDevice = async (id: number) => {
    setRemovingId(id);
    try {
      const token = await getIdToken();
      const res = await fetch(apiUrl(`/me/devices/${id}`), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok || res.status === 404) {
        // Slot freed — try to claim it for this device right away.
        await runCheck();
      }
    } catch {
      // Network hiccup — user can tap again.
    } finally {
      setRemovingId(null);
    }
  };

  if (!blocked) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-gray-800">Device limit reached</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your account is already open on <b>2 devices</b> — that's the maximum
            allowed at the same time. Log out one of them to use this device.
          </p>
        </div>

        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {d.deviceName || "Unknown device"}
                </p>
                <p className="text-[11px] text-gray-400">
                  Last used {new Date(d.lastSeenAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => removeDevice(d.id)}
                disabled={removingId !== null}
                className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 active:opacity-80 disabled:opacity-50"
              >
                {removingId === d.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                Log out
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => signOutUser()}
          className="w-full text-sm text-gray-500 font-medium py-2 active:opacity-80"
        >
          Sign out on this device instead
        </button>
      </div>
    </div>
  );
}
