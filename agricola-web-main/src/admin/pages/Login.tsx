import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Lock } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { authErrorText } from "../../lib/firebase";

const RECAPTCHA_CONTAINER_ID = "recaptcha-admin";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, requestOtp, verifyOtp, bypassLogin } = useAuth();

  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Already logged in? Skip the form.
  useEffect(() => {
    if (isAuthenticated) navigate("/admin", { replace: true });
  }, [isAuthenticated, navigate]);

  // OTP countdown.
  useEffect(() => {
    if (step !== "otp" || seconds <= 0) return;
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [step, seconds]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestOtp(phone, password);
      setStep("otp");
      setSeconds(RESEND_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      setError(authErrorText(err, "Invalid phone or password. Unable to send OTP."));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (seconds > 0) return;
    try {
      await requestOtp(phone, password);
      setSeconds(RESEND_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(authErrorText(err, "Failed to resend OTP."));
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyOtp(otp.join(""));
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(authErrorText(err, "Invalid or incomplete code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const formattedTime = `00:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold">
            <span className="text-[#84b817]">Agri</span>
            <span className="text-gray-600">Cola</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Admin Portal</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Invisible reCAPTCHA host for Firebase phone auth. */}
        <div id={RECAPTCHA_CONTAINER_ID} />

        {step === "credentials" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-green-500">
                <Phone className="h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-green-500">
                <Lock className="h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
                  required
                />
              </div>
            </div>

                        <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Sending..." : "Send OTP"}
            </button>

            {(import.meta.env.DEV || window.location.hostname === "localhost") && (
              <div className="pt-2 border-t border-gray-100 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await bypassLogin();
                      navigate("/admin", { replace: true });
                    } catch (e) {
                      setError(authErrorText(e, "Dev login failed."));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  ⚡ One-Click Dev Login (Localhost)
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-center text-sm text-gray-500">
              Enter the 6-digit code sent to your phone
            </p>

            <div className="flex justify-center gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={index === 0 ? handleOtpPaste : undefined}
                  className="h-12 w-12 rounded-md border border-gray-200 bg-gray-50 text-center text-lg text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{formattedTime}</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={seconds > 0}
                className="font-medium text-green-600 hover:text-green-700 disabled:cursor-not-allowed disabled:text-gray-400 cursor-pointer"
              >
                Resend OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={busy || otp.join("").length !== OTP_LENGTH}
              className="w-full rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setError("");
              }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
