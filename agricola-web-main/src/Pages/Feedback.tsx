import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import { useStorefront } from "../storefront/StorefrontContext";
import { submitFeedback } from "../lib/checkout";

export default function Feedback() {
  const { user } = useStorefront();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || busy) return;
    setError("");
    setBusy(true);
    try {
      await submitFeedback({
        message: message.trim(),
        rating: rating || undefined,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        page: window.location.pathname,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit feedback.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Share Feedback</span>
          </nav>
        </section>

        <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-gray-100 max-w-2xl mx-auto">
          <div className="text-center max-w-lg mx-auto mb-8">
            <div className="w-16 h-16 rounded-3xl bg-[#c9ecc4]/60 text-[#486800] flex items-center justify-center text-3xl mx-auto mb-4 shadow-2xs">
              <span className="material-symbols-outlined text-3xl">rate_review</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] tracking-tight mb-2">
              Share Your Harvest Experience
            </h1>
            <p className="text-xs sm:text-sm text-[#434936] leading-relaxed">
              We'd love to hear your thoughts on our farm-direct superfoods, packaging freshness, or website experience. Your voice shapes future harvests.
            </p>
          </div>

          {done ? (
            <div className="bg-[#c9ecc4]/40 rounded-3xl p-8 text-center border border-[#84b817]/30 my-4">
              <div className="w-14 h-14 rounded-full bg-[#486800] text-white flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm">
                🌾
              </div>
              <h2 className="text-xl font-black text-[#1e3a1f] mb-1">Thank You for Your Feedback!</h2>
              <p className="text-xs text-[#434936] max-w-md mx-auto leading-relaxed">
                Your feedback has reached our product and agricultural quality team. We deeply appreciate your support for clean, ethical farming.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  to="/products"
                  className="px-6 py-2.5 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold transition-all shadow-xs"
                >
                  Explore Organic Harvests
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-[#f5f3f0] rounded-3xl p-6 sm:p-8 flex flex-col gap-4 border border-gray-200/70">
              {/* Star Rating Bar */}
              <div className="text-center pb-2">
                <label className="text-xs font-extrabold text-[#1e3a1f] block mb-2">
                  Overall Harvest Rating
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star rating`}
                      className="p-1 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                    >
                      <span className={`material-symbols-outlined text-3xl ${
                        n <= rating ? "text-amber-400 font-variation-fill" : "text-gray-300"
                      }`}>
                        star
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full bg-white rounded-2xl px-4 py-3 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ananya@domain.com"
                    className="w-full bg-white rounded-2xl px-4 py-3 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                  Your Thoughts &amp; Feedback <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you loved about our superfoods, crunch freshness, or what we can do better…"
                  className="w-full bg-white rounded-2xl p-4 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817] resize-none"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-red-500">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="w-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-sm font-extrabold py-3.5 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Feedback…</span>
                  </>
                ) : (
                  <>
                    <span>Submit Feedback</span>
                    <span className="material-symbols-outlined text-base">send</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
