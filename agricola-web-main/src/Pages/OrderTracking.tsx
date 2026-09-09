import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Package, Phone, Mail } from "lucide-react";
import { AgriWordmark } from "../assets/icons";
import { trackOrder, type TrackedOrder } from "../lib/checkout";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=200&q=70";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtTime = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export default function OrderTracking() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TrackedOrder | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!orderId.trim() || !mobile.trim()) {
      setError("Enter both your Order ID and mobile number.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      setResult(await trackOrder(orderId, mobile));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't track this order."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        {/* Top: back + wordmark */}
        <div className="relative mb-8 flex items-center justify-center">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <AgriWordmark title="AgriCola" className="h-9 w-auto" />
        </div>

        {/* Track card */}
        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-center font-serif text-3xl text-amber-500">
            Track your order
          </h1>

          {/* Illustration */}
          <div className="mb-8 flex items-center justify-center gap-1 text-amber-400">
            <MapPin className="h-9 w-9 fill-blue-900 text-blue-900" />
            <Package className="h-10 w-10 text-amber-400" />
            <MapPin className="h-9 w-9 fill-pink-500 text-pink-500" />
          </div>

          <form onSubmit={handleTrack} className="rounded-2xl bg-lime-100 p-6">
            <label className="mb-2 block font-semibold text-gray-900">
              Order ID
            </label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Eg. ORD-20250918-7342"
              className="w-full rounded-full bg-white px-5 py-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <label className="mb-2 mt-5 block font-semibold text-gray-900">
              Mobile Number
            </label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Mobile Number here"
              inputMode="numeric"
              className="w-full rounded-full bg-white px-5 py-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {error && (
              <p className="mt-4 text-center text-sm text-red-500">{error}</p>
            )}

            <div className="mt-8 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="w-full max-w-sm rounded-lg bg-gray-900 py-3.5 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Tracking…" : "Track"}
              </button>
            </div>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-gray-500">Order</p>
                <p className="font-semibold text-gray-900">{result.orderId}</p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium capitalize text-green-700">
                {result.status}
              </span>
            </div>

            {/* Timeline */}
            <h2 className="mb-4 font-semibold text-gray-900">Progress</h2>
            <div className="space-y-4">
              {result.timeline.map((ev, i) => {
                const isLast = i === result.timeline.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                          isLast ? "bg-[#84b817]" : "bg-gray-300"
                        }`}
                      />
                      {i < result.timeline.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-gray-200" />
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium text-gray-900">
                        {ev.message}
                      </p>
                      {ev.at && (
                        <p className="text-xs text-gray-400">{fmtTime(ev.at)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Items */}
            {result.items.length > 0 && (
              <>
                <h2 className="mb-4 mt-8 font-semibold text-gray-900">Items</h2>
                <div className="space-y-4">
                  {result.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={item.image || FALLBACK_IMAGE}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              FALLBACK_IMAGE;
                          }}
                        />
                      </div>
                      <div className="flex-1 text-sm">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-gray-500">
                          {item.weight ? `${item.weight} · ` : ""}Qty {item.qty}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {rupees(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Delivery address */}
            {result.address && (
              <div className="mt-8 border-t border-gray-100 pt-5 text-sm">
                <h2 className="mb-2 font-semibold text-gray-900">
                  Delivery Address
                </h2>
                <p className="font-medium text-gray-800">
                  {result.address.name}
                </p>
                <p className="text-gray-600">
                  {[
                    result.address.street,
                    result.address.city,
                    result.address.state,
                    result.address.pincode,
                    result.address.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help card */}
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            Can't Find Your Order ID?
          </h2>
          <p className="text-sm text-gray-500">
            We sent your order tracking number on your registered email address
            &amp; SMS.
          </p>
          <hr className="my-5 border-gray-100" />
          <p className="mb-3 text-sm text-gray-500">
            If still can't find, call support
          </p>
          <div className="flex flex-wrap gap-8 text-sm">
            <a
              href="tel:+919012659000"
              className="flex items-center gap-2 text-green-600 hover:underline"
            >
              <Phone className="h-4 w-4" /> +91 9012659000
            </a>
            <a
              href="mailto:support@agricola.co.in"
              className="flex items-center gap-2 text-green-600 hover:underline"
            >
              <Mail className="h-4 w-4" /> support@agricola.co.in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
