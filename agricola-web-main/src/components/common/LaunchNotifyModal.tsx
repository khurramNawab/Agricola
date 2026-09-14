import React, { useState } from "react";
import { X, Sparkles, CheckCircle2, AlertCircle, ShieldCheck, Copy, Check, Gift } from "lucide-react";
import { BASE_URL } from "../../lib/api";

interface LaunchNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: "utensils" | "gardening" | "both";
  source?: string;
  itemInterestTitle?: string;
}

export const LaunchNotifyModal: React.FC<LaunchNotifyModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = "both",
  source = "modal",
  itemInterestTitle,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<"utensils" | "gardening" | "both">(defaultCategory);
  const [preferredChannel, setPreferredChannel] = useState<"email" | "whatsapp">("whatsapp");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const cleanPhone = phone.replace(/\D/g, "");

    if (!trimmedEmail && !cleanPhone) {
      setError("Please provide your Email address or WhatsApp phone number.");
      return;
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/subscribers/notify-launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: trimmedEmail || undefined,
          phone: cleanPhone || undefined,
          category,
          preferredChannel,
          interestTags: itemInterestTitle ? [itemInterestTitle] : [],
          source,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to register notification");
      }

      setSuccessMessage(data.message || "You're successfully registered for VIP launch access!");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyVoucher = () => {
    navigator.clipboard.writeText("AGRI-VIP-15");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121c13] text-[#faf8f5] w-full max-w-lg rounded-3xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] border border-emerald-500/30 overflow-hidden relative">
        {/* Ambient lighting spots */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#84b817]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header decoration */}
        <div className="relative p-6 sm:p-7 border-b border-white/10 bg-gradient-to-b from-[#1b2b1d] to-[#121c13]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#84b817]/20 border border-[#84b817]/40 text-[#c9ecc4] text-xs font-bold mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#bcf455] animate-pulse" />
            <span>VIP EARLY ACCESS • 15% LAUNCH DISCOUNT</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {itemInterestTitle ? `Reserve Access: ${itemInterestTitle}` : "Exclusive Launch Privilege"}
          </h3>
          <p className="text-[#c3dac0] text-xs sm:text-sm mt-1 leading-relaxed">
            Be the very first in India to experience pure bell-metal cookware and certified heirloom gardening kits with an instant 15% VIP discount voucher.
          </p>
        </div>

        <div className="relative p-6 sm:p-8">
          {successMessage ? (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 bg-[#84b817]/20 border border-[#84b817]/40 text-[#bcf455] rounded-full flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-2xl font-black text-white">
                  You&apos;re On The VIP Dispatch List!
                </h4>
                <p className="text-[#c3dac0] text-xs sm:text-sm mt-1 max-w-sm mx-auto leading-relaxed">
                  {successMessage}
                </p>
              </div>

              {/* VIP Discount Voucher Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-[#84b817]/20 border border-[#84b817]/40 text-left relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-[#bcf455]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#c9ecc4]">
                      Your VIP 15% Discount Code
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-[#bcf455] text-black px-2 py-0.5 rounded-full uppercase">
                    Unlocked
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 bg-black/40 p-2.5 rounded-xl border border-white/10">
                  <span className="font-mono text-base font-black text-[#bcf455] tracking-widest">
                    AGRI-VIP-15
                  </span>
                  <button
                    type="button"
                    onClick={copyVoucher}
                    className="inline-flex items-center gap-1 bg-[#84b817] hover:bg-[#719f12] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                  </button>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-xs text-[#c9ecc4] bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                <ShieldCheck className="w-4 h-4 text-[#84b817]" />
                <span>Zero spam guarantee. Dispatch notification will be sent direct to your phone.</span>
              </div>

              <div>
                <button
                  onClick={onClose}
                  className="w-full bg-[#84b817] hover:bg-[#719f12] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(132,184,23,0.4)] cursor-pointer"
                >
                  Return to Artisan Showcase
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Pill Radio Cards */}
              <div>
                <label className="block text-xs font-bold text-[#c9ecc4] uppercase tracking-wider mb-2">
                  Select Collection of Interest
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory("utensils")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      category === "utensils"
                        ? "bg-[#84b817]/25 border-[#84b817] text-white shadow-xs"
                        : "bg-white/5 border-white/10 text-[#c3dac0] hover:bg-white/10"
                    }`}
                  >
                    <span className="text-base block mb-0.5">🍳</span>
                    <span className="text-[11px] font-bold block leading-tight">Cookware</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory("gardening")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      category === "gardening"
                        ? "bg-[#84b817]/25 border-[#84b817] text-white shadow-xs"
                        : "bg-white/5 border-white/10 text-[#c3dac0] hover:bg-white/10"
                    }`}
                  >
                    <span className="text-base block mb-0.5">🌿</span>
                    <span className="text-[11px] font-bold block leading-tight">Gardening</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory("both")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      category === "both"
                        ? "bg-[#84b817]/25 border-[#84b817] text-white shadow-xs"
                        : "bg-white/5 border-white/10 text-[#c3dac0] hover:bg-white/10"
                    }`}
                  >
                    <span className="text-base block mb-0.5">✨</span>
                    <span className="text-[11px] font-bold block leading-tight">Both Series</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Your Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aditi Sharma"
                  className="w-full px-3.5 py-2.5 bg-white/10 border border-white/15 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                />
              </div>

              {/* Phone and Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    WhatsApp Number *
                  </label>
                  <div className="flex">
                    <span className="px-3 py-2.5 bg-white/15 border border-r-0 border-white/15 rounded-l-xl text-xs font-bold text-[#bcf455]">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="98765 43210"
                      className="w-full px-3.5 py-2.5 bg-white/10 border border-white/15 rounded-r-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aditi@example.com"
                    className="w-full px-3.5 py-2.5 bg-white/10 border border-white/15 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                  />
                </div>
              </div>

              {/* Notification Channel Preference */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                  Preferred Alert Channel
                </label>
                <div className="flex gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1.5 text-[#c3dac0] cursor-pointer">
                    <input
                      type="radio"
                      name="channel"
                      checked={preferredChannel === "whatsapp"}
                      onChange={() => setPreferredChannel("whatsapp")}
                      className="text-[#84b817] focus:ring-[#84b817]"
                    />
                    <span>WhatsApp Alert (Instant Dispatch Code)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[#c3dac0] cursor-pointer">
                    <input
                      type="radio"
                      name="channel"
                      checked={preferredChannel === "email"}
                      onChange={() => setPreferredChannel("email")}
                      className="text-[#84b817] focus:ring-[#84b817]"
                    />
                    <span>Email Only</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#84b817] to-[#719f12] hover:from-[#719f12] hover:to-[#5e840d] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-[0_4px_16px_rgba(132,184,23,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>{loading ? "Registering Privilege…" : "Unlock VIP Launch Access & 15% Code"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchNotifyModal;
