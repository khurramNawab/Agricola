import React, { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import {
  Sparkles,
  ShieldCheck,
  Leaf,
  CheckCircle2,
  X,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  Lock,
} from "lucide-react";
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
    title: "100% Farm-Direct",
    desc: "Single-origin harvests sourced directly from certified farmer cooperatives.",
    accent: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  {
    icon: Leaf,
    title: "Batch Traceable",
    desc: "Every pack verified with satellite soil logs & NABL lab reports.",
    accent: "text-lime-400 bg-lime-400/10 border-lime-400/20",
  },
  {
    icon: ShieldCheck,
    title: "Direct Farm Express",
    desc: "Dispatched from temperature-controlled certified facilities.",
    accent: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
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
  const [notify, setNotify] = useState(true);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  // Reset state on open
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

  // Focus the first OTP box when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Countdown timer for resend
  useEffect(() => {
    if (step !== "otp" || seconds <= 0) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [step, seconds]);

  // Auto-redirect on success
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      onAuthenticated?.();
      onClose();
    }, 1800);
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
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits entered
    if (digit && index === OTP_LENGTH - 1) {
      const fullCode = next.join("");
      if (fullCode.length === OTP_LENGTH) {
        setTimeout(() => handleVerifyWithCode(fullCode), 50);
      }
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
    if (pasted.length === OTP_LENGTH) {
      setTimeout(() => handleVerifyWithCode(pasted), 50);
    } else {
      otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  const handleVerifyWithCode = async (code: string) => {
    if (code.length !== OTP_LENGTH || loading) return;
    setError("");
    setLoading(true);
    try {
      let session: CustomerSession;
      if (useBackendOtp || !confirmationRef.current) {
        session = await verifyBackendOtp(phone, code);
      } else {
        const idToken = await confirmPhoneOtp(confirmationRef.current, code);
        session = await firebaseLogin(idToken);
      }
      onLogin(session);
      setStep("success");
    } catch (err) {
      setError(authErrorText(err, "Invalid OTP code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => handleVerifyWithCode(otpValue);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AgriCola Authentication Modal"
        className="relative my-auto w-full max-w-2xl rounded-3xl bg-gradient-to-b from-[#162a17] via-[#102011] to-[#0a140a] p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-[#84b817]/25 overflow-hidden text-[#faf8f5] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow Elements */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#84b817]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#d97706]/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all hover:rotate-90 duration-300 cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Branding Strip */}
        <div className="relative z-10 text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 bg-[#84b817]/15 border border-[#84b817]/30 px-3.5 py-1 rounded-full text-[#c9ecc4] text-xs font-bold tracking-wide shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#84b817] animate-ping" />
            <span className="tracking-wider uppercase text-[11px]">AgriCola Harvest Circle</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Pure Harvests • Conscious Living
          </h2>
          <p className="text-xs sm:text-sm text-[#aecfaa] max-w-md mx-auto leading-relaxed">
            Enter your mobile number to explore certified organic harvests, track dispatches &amp; unlock member benefits.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3.5 text-center transition-all duration-300 hover:border-[#84b817]/40 hover:-translate-y-0.5"
              >
                <div className={`mx-auto mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl border ${f.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white mb-1">{f.title}</h4>
                <p className="text-[11px] leading-relaxed text-[#aecfaa]/80">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Main Interactive Form Card */}
        <div className="relative z-10 mx-auto w-full max-w-lg rounded-2xl bg-white text-[#1b1c1a] p-6 sm:p-7 shadow-2xl border border-white space-y-4">
          {/* Invisible reCAPTCHA host for Firebase phone auth */}
          <div id={RECAPTCHA_CONTAINER_ID} />

          {/* STEP 1: Phone Entry */}
          {step === "phone" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-1">
                <h3 className="text-lg font-black text-[#1e3a1f] flex items-center justify-center gap-2">
                  <PhoneCall className="w-5 h-5 text-[#84b817]" />
                  Sign In / Register
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  We'll send a 6-digit one-time verification code via SMS
                </p>
              </div>

              {/* Phone Input Box */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mobile Number
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 focus-within:ring-2 focus-within:ring-[#84b817] focus-within:border-[#84b817] transition-all bg-gray-50/70 focus-within:bg-white">
                  <div className="flex items-center gap-1.5 text-gray-700 font-bold text-sm shrink-0 border-r border-gray-200 pr-2.5">
                    <span className="text-base" aria-hidden>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSendOtp) handleSendOtp();
                    }}
                    placeholder="Enter 10-digit number"
                    className="w-full bg-transparent text-gray-900 font-bold text-sm tracking-wider placeholder:font-normal placeholder:tracking-normal placeholder-gray-400 focus:outline-none"
                  />
                  {phone.length === 10 && (
                    <span className="text-xs font-bold text-[#486800] bg-lime-100 px-2 py-0.5 rounded-full shrink-0">
                      Ready ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-1 text-xs text-gray-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notify}
                    onChange={(e) => setNotify(e.target.checked)}
                    className="w-4 h-4 rounded text-[#84b817] focus:ring-[#84b817] accent-[#486800] cursor-pointer"
                  />
                  <span>Receive harvest dispatches &amp; live delivery alerts on WhatsApp</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#84b817] focus:ring-[#84b817] accent-[#486800] cursor-pointer"
                  />
                  <span className="text-[11px] leading-relaxed text-gray-500">
                    I agree to AgriCola's Terms of Service and Privacy Policy.
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 text-center">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={!canSendOtp || loading}
                className="w-full rounded-xl bg-[#486800] hover:bg-[#1e3a1f] text-white py-3.5 font-bold text-sm transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Code…</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: OTP Entry */}
          {step === "otp" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-1">
                <div className="w-10 h-10 rounded-full bg-lime-100 flex items-center justify-center mx-auto mb-2 text-[#486800]">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-[#1e3a1f]">
                  Verify Your Phone
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  We've sent a 6-digit OTP code to{" "}
                  <strong className="text-gray-800 font-bold">
                    +91 {phone.slice(0, 5)} {phone.slice(5)}
                  </strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setError("");
                  }}
                  className="text-xs text-[#486800] font-bold hover:underline mt-1 cursor-pointer"
                >
                  Change phone number
                </button>
              </div>

              {devNotice && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center font-mono font-bold">
                  {devNotice}
                </div>
              )}

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-center gap-2 sm:gap-3 py-1" onPaste={handleOtpPaste}>
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
                    className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border border-gray-200 bg-gray-50 text-center text-xl font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#84b817] focus:border-[#84b817] shadow-inner transition-all"
                  />
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 text-center">
                  {error}
                </div>
              )}

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleVerify}
                disabled={!canVerify || loading}
                className="w-full rounded-xl bg-[#486800] hover:bg-[#1e3a1f] text-white py-3.5 font-bold text-sm transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Proceed</span>
                  </>
                )}
              </button>

              {/* Resend Timer */}
              <div className="text-center pt-1 text-xs text-gray-500">
                {seconds > 0 ? (
                  <span>
                    Resend code in{" "}
                    <strong className="text-gray-800 font-mono font-bold">
                      00:{String(seconds).padStart(2, "0")}s
                    </strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-[#486800] font-bold hover:underline cursor-pointer"
                  >
                    Didn't receive code? Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Success State */}
          {step === "success" && (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-90 duration-300">
              <div className="w-16 h-16 rounded-full bg-lime-100 border-2 border-[#84b817] text-[#486800] flex items-center justify-center mx-auto text-3xl shadow-sm">
                ✓
              </div>
              <h3 className="text-xl font-black text-[#1e3a1f]">
                Welcome to AgriCola!
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Authentication successful. Connecting your harvest profile...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
