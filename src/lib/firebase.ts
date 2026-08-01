import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/** Fresh Firebase ID token for the signed-in user, or null if signed out. */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Sends an OTP to `phoneNumber` (E.164 format, e.g. "+91XXXXXXXXXX").
 * `containerId` must be the id of an (invisible) DOM element already mounted —
 * Firebase's invisible reCAPTCHA attaches to it to prove this is a real device.
 */
export function sendPhoneOtp(phoneNumber: string, containerId: string): Promise<ConfirmationResult> {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  }
  return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
}

export function signOutUser() {
  return firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { User, ConfirmationResult };
