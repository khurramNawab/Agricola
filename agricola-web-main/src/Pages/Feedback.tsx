import { useState, type FormEvent } from "react";
import Footer from "../components/layout/Footer";
import { StarIcon } from "../assets/icons";
import { useStorefront } from "../storefront/StorefrontContext";
import { submitFeedback } from "../lib/checkout";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#84b817]";

export default function Feedback() {
  const { user } = useStorefront();
  const [rating, setRating] = useState(0);
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1">
        <div className="container mx-auto max-w-xl px-4 py-12">
          <h1 className="mb-2 font-serif text-3xl text-gray-900 sm:text-4xl">
            Share your feedback
          </h1>
          <p className="mb-8 text-sm text-gray-500">
            We'd love to hear what you think about AgriCola — the products, the
            website, anything. It helps us improve.
          </p>

          {done ? (
            <div className="rounded-2xl border border-green-100 bg-green-50 p-8 text-center">
              <p className="text-lg font-semibold text-green-700">Thank you! 🌾</p>
              <p className="mt-1 text-sm text-green-700">
                Your feedback has reached our team.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6"
            >
              <div>
                <p className="mb-2 text-sm text-gray-600">How would you rate us?</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      <StarIcon
                        className={`h-7 w-7 ${
                          n <= rating ? "text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className={inputClass}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className={inputClass}
                />
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind…"
                rows={5}
                className={inputClass}
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="rounded-lg bg-[#84b817] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send Feedback"}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
