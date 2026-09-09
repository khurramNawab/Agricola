import React, { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { UserCheck, Sparkles, ShieldCheck, Leaf } from "lucide-react";
import { StarIcon } from "../../assets/icons";
import {
  sendPhoneOtp,
  confirmPhoneOtp,
  toE164,
  authErrorText,
} from "../../lib/firebase";
import {
  firebaseLogin,
  requestBackendOtp,
  verifyBackendOtp,
  type CustomerSession,
} from "../../lib/storefrontAuth";

const RECAPTCHA_CONTAINER_ID = "recaptcha-storefront";
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

type AuthStep = "phone" | "otp" | "success";

const features = [
  {
    icon: Sparkles,
    title: "Loved & Trusted by Families",
    desc: "Because every product is selected with care, and our produce is sourced from farms you can trust.",
  },
  {
    icon: ShieldCheck,
    title: "Not Just Groceries. A Lifestyle",
    desc: "Because eating well isn't just a habit — it's a choice for a healthier, more balanced life.",
  },
  {
    icon: Leaf,
    title: "Make Every Meal Special",
    desc: "Curated by us — bringing farm-fresh quality to your kitchen, every single day.",
  },
];

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Persist the session as soon as the OTP verifies. */
  onLogin: (session: CustomerSession) => void;
  onAuthenticated?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  onLogin,
  onAuthenticated,
}) => {
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [accepted, setAccepted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devNotice, setDevNotice] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [useBackendOtp, setUseBackendOtp] = useState(false);
  const [notify, setNotify] = useState(false);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Firebase confirmation handle, carried from "send OTP" to "verify".
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  // Reset everything whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStep("phone");
      setPhone("");
      setOtp(Array(OTP_LENGTH).fill(""));
      setSeconds(0);
      setLoading(false);
      setError("");
      setDevNotice("");
      setUseBackendOtp(false);
      confirmationRef.current = null;
    }
  }, [open]);

  // Focus the first OTP input when transitioning to the OTP step.
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
  }, [step]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Countdown for the OTP step.
  useEffect(() => {
    if (step !== "otp" || seconds <= 0) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [step, seconds]);

  // After showing the success screen, finish logging in.
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      onAuthenticated?.();
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, onAuthenticated, onClose]);

  if (!open) return null;

  const canSendOtp = phone.trim().length >= 10 && accepted;
  const otpValue = otp.join("");
  const canVerify = otpValue.length === OTP_LENGTH;

  const handleSendOtp = async () => {
    if (!canSendOtp || loading) return;
    setError("");
    setDevNotice("");
    setLoading(true);
    try {
      try {
        confirmationRef.current = await sendPhoneOtp(
          toE164(phone),
          RECAPTCHA_CONTAINER_ID
        );
        setUseBackendOtp(false);
      } catch (fbErr) {
        console.warn("Firebase phone auth failed, falling back to backend OTP:", fbErr);
        const res = await requestBackendOtp(phone, accepted);
        setUseBackendOtp(true);
        if (res.devOtp) {
          setDevNotice(`Test OTP: ${res.devOtp}`);
        }
      }
      setOtp(Array(OTP_LENGTH).fill(""));
      setStep("otp");
      setSeconds(RESEND_SECONDS);
    } catch (err) {
      setError(authErrorText(err, "Couldn't send OTP. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (seconds > 0 || loading) return;
    setError("");
    setDevNotice("");
    setLoading(true);
    try {
      if (useBackendOtp) {
        const res = await requestBackendOtp(phone, accepted);
        if (res.devOtp) setDevNotice(`Test OTP: ${res.devOtp}`);
      } else {
        try {
          confirmationRef.current = await sendPhoneOtp(
            toE164(phone),
            RECAPTCHA_CONTAINER_ID
          );
        } catch (fbErr) {
          const res = await requestBackendOtp(phone, accepted);
          setUseBackendOtp(true);
          if (res.devOtp) setDevNotice(`Test OTP: ${res.devOtp}`);
        }
      }
      setOtp(Array(OTP_LENGTH).fill(""));
      setSeconds(RESEND_SECONDS);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(authErrorText(err, "Couldn't resend OTP. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerify = async () => {
    if (!canVerify || loading) return;
    setError("");
    setLoading(true);
    try {
      let session: CustomerSession;
      if (useBackendOtp || !confirmationRef.current) {
        session = await verifyBackendOtp(phone, otpValue);
      } else {
        const idToken = await confirmPhoneOtp(confirmationRef.current, otpValue);
        session = await firebaseLogin(idToken);
      }
      onLogin(session);
      setStep("success");
    } catch (err) {
      setError(authErrorText(err, "Invalid OTP. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const formattedTime = `00:${String(seconds).padStart(2, "0")}s`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Signup or login"
        className="relative my-auto w-full max-w-3xl rounded-2xl bg-neutral-800 p-4 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Feature cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/10 bg-neutral-700/40 p-5 text-center"
            >
              <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900">
                <StarIcon className="h-4 w-4 text-yellow-400" />
              </div>
              <h3 className="mb-3 text-sm font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-xs leading-relaxed text-gray-400">
                {feature.text}
              </p>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="mx-auto mt-6 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:mt-8">
          <h2 className="text-center text-xl font-medium text-gray-800">
            Signup/Login
          </h2>

          {/* Invisible reCAPTCHA host for Firebase phone auth. */}
          <div id={RECAPTCHA_CONTAINER_ID} />

          {step === "phone" && (
            <>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 focus-within:ring-2 focus-within:ring-green-500">
                <span className="flex items-center gap-1 text-gray-700">
                  <span aria-hidden>🇮🇳</span> +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Enter Mobile number"
                  className="w-full bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
                />
              </div>

              <label className="mt-5 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="h-4 w-4 accent-green-600"
                />
                Notify me for any updates
              </label>

              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-green-600"
                />
                <span>
                  I accept that I have read &amp; understood AgriCola's Privacy
                  Policy and T&amp;Cs.
                </span>
              </label>

              {error && (
                <p className="mt-4 text-center text-sm text-red-500">{error}</p>
              )}

              <button
                onClick={handleSendOtp}
                disabled={!canSendOtp || loading}
                className="mt-6 w-full rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                We've sent a 6 digit verification code to your number. Please
                enter that to continue
              </p>

              <div className="mt-5 flex justify-center gap-3">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    className="h-11 w-11 rounded-md border border-gray-200 bg-gray-50 text-center text-lg text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">{formattedTime}</span>
                <button
                  onClick={handleResend}
                  disabled={seconds > 0}
                  className="font-medium text-green-600 hover:text-green-700 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  Resend OTP
                </button>
              </div>

              {devNotice && (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-2 text-center text-xs font-semibold text-green-700">
                  {devNotice}
                </div>
              )}

              {error && (
                <p className="mt-4 text-center text-sm text-red-500">{error}</p>
              )}

              <button
                onClick={handleVerify}
                disabled={!canVerify || loading}
                className="mt-6 w-full rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
            </>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center py-4 text-center">
              <UserCheck className="mb-4 h-12 w-12 text-indigo-500" />
              <h3 className="text-lg font-bold text-gray-900">
                Congratulations!
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                You're successfully logged in
              </p>
              <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
