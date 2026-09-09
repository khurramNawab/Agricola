// Firebase client — phone-auth OTP.
//
// Flow: the user enters their number, Firebase sends the SMS (no DLT setup —
// Google handles delivery), and on a correct code we get a Firebase ID token.
// That token goes to the backend (`/auth/firebase` for storefront,
// `/admin/auth/firebase-login` for admin), which verifies it and issues our own
// JWT session. See agri-backend/src/utils/firebaseAdmin.js.
//
// The web config below is public by design — it identifies the Firebase project,
// it is not a secret, and it is safe to ship in the bundle. Access is gated by
// Firebase's authorized-domains list + reCAPTCHA, not by hiding these values.
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDcCXY3U2ODcj9BKzyttXLqjIGDStrMdfE",
  authDomain: "agricola-79e74.firebaseapp.com",
  projectId: "agricola-79e74",
  storageBucket: "agricola-79e74.firebasestorage.app",
  messagingSenderId: "32355566904",
  appId: "1:32355566904:web:94dc659922256f638dadcd",
  measurementId: "G-RF4THMLEFN",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

/** Turn a 10-digit Indian mobile (any format) into E.164, e.g. +919876543210. */
export function toE164(phone: string, countryCode = "+91"): string {
  return `${countryCode}${String(phone).replace(/\D/g, "").slice(-10)}`;
}

// One invisible reCAPTCHA verifier + its own DOM host at a time. grecaptcha
// refuses to render twice into the same element, so instead of reusing the
// container we mount a FRESH child element for every send and remove it after.
// This makes retries/resends safe ("reCAPTCHA already rendered" can't happen).
let verifier: RecaptchaVerifier | null = null;
let widgetHost: HTMLElement | null = null;

function teardownRecaptcha(): void {
  if (verifier) {
    try {
      verifier.clear();
    } catch {
      // ignore — widget may already be gone
    }
    verifier = null;
  }
  if (widgetHost) {
    widgetHost.remove();
    widgetHost = null;
  }
}

/**
 * Start phone sign-in: mount a fresh invisible reCAPTCHA inside the element with
 * id `containerId` (falling back to <body>) and ask Firebase to SMS a 6-digit
 * code to `phoneE164`. Returns a ConfirmationResult for confirmPhoneOtp().
 */
export async function sendPhoneOtp(
  phoneE164: string,
  containerId: string
): Promise<ConfirmationResult> {
  teardownRecaptcha();
  const parent = document.getElementById(containerId) || document.body;
  widgetHost = document.createElement("div");
  parent.appendChild(widgetHost);
  verifier = new RecaptchaVerifier(auth, widgetHost, { size: "invisible" });
  try {
    await verifier.render();
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (err) {
    teardownRecaptcha();
    throw err;
  }
}

/** Confirm the SMS code and return the Firebase ID token for the backend. */
export async function confirmPhoneOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<string> {
  const cred = await confirmation.confirm(code);
  return cred.user.getIdToken();
}

/** Map a Firebase auth error to a user-facing message. */
export function firebaseAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  switch (code) {
    case "auth/invalid-phone-number":
      return "That phone number looks invalid. Please check and try again.";
    case "auth/invalid-verification-code":
      return "Incorrect code. Please try again.";
    case "auth/code-expired":
      return "This code has expired. Please request a new one.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a while and try again.";
    case "auth/captcha-check-failed":
    case "auth/missing-app-credential":
      return "Verification check failed. Please reload the page and try again.";
    case "auth/quota-exceeded":
      return "SMS limit reached. Please try again later.";
    default:
      return "Couldn't complete phone verification. Please try again.";
  }
}

/**
 * Best-effort message for any auth error: Firebase `auth/*` errors get a
 * friendly mapping, backend ApiErrors keep their own message.
 */
export function authErrorText(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code;
  if (typeof code === "string" && code.startsWith("auth/")) {
    return firebaseAuthErrorMessage(err);
  }
  return err instanceof Error ? err.message : fallback;
}
