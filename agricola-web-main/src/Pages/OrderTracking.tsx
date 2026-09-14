import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Footer from "../components/layout/Footer";
import { trackOrder, type TrackedOrder } from "../lib/checkout";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=400&q=70";

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
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("orderId") || "");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TrackedOrder | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!orderId.trim() || !mobile.trim()) {
      setError("Please enter both your Order ID and 10-digit mobile number.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await trackOrder(orderId.trim(), mobile.trim());
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No shipment found matching those details. Please double-check your Order ID and phone number."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb & Live Status */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Track Live Shipment</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#486800] animate-pulse" />
            <span className="text-xs font-bold text-[#434936]">
              Real-Time GPS &amp; Logistics Tracking
            </span>
          </div>
        </section>

        {/* Tracking Search Card */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-gray-100 mb-8">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#c9ecc4]/60 text-[#486800] flex items-center justify-center text-3xl mx-auto mb-4 shadow-2xs">
              <span className="material-symbols-outlined text-3xl">local_shipping</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] tracking-tight mb-2">
              Track Your Farm-Fresh Order
            </h1>
            <p className="text-xs sm:text-sm text-[#434936] mb-8 leading-relaxed">
              Enter your Order Reference ID and registered phone number to track your package dispatch and cold-chain transit status.
            </p>

            <form onSubmit={handleTrack} className="bg-[#f5f3f0] rounded-3xl p-6 sm:p-8 flex flex-col gap-4 text-left border border-gray-200/70">
              <div>
                <label className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                  Order ID
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    receipt_long
                  </span>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="e.g. ORD-20250918-7342"
                    className="w-full bg-white rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817] uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                  10-Digit Mobile Number
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    phone
                  </span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                    className="w-full bg-white rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-red-500">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-sm font-extrabold py-3.5 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Searching Harvest Network…</span>
                  </>
                ) : (
                  <>
                    <span>Track Shipment</span>
                    <span className="material-symbols-outlined text-base">search</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Tracking Result Card */}
        {result && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 mb-8 flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-gray-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#486800] tracking-wider block">
                  Active Shipment Details
                </span>
                <h2 className="text-xl font-black text-[#1e3a1f]">
                  Order #{result.orderId}
                </h2>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                result.status === "delivered"
                  ? "bg-[#c9ecc4] text-[#486800]"
                  : result.status === "cancelled"
                  ? "bg-red-100 text-red-800"
                  : "bg-[#eaf3db] text-[#486800]"
              }`}>
                {result.status.replace(/_/g, " ")}
              </span>
            </div>

            {/* Visual Milestones Stepper Progress */}
            {result.status !== "cancelled" && (
              <div className="bg-[#f5f3f0] rounded-2xl p-5 border border-gray-200/60">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "placed", label: "Order Placed", active: true },
                    {
                      key: "processing",
                      label: "Packed & Assigned",
                      active: ["processing", "shipped", "out_for_delivery", "delivered"].includes(result.status),
                    },
                    {
                      key: "shipped",
                      label: "Shipped",
                      active: ["shipped", "out_for_delivery", "delivered"].includes(result.status),
                    },
                    {
                      key: "delivered",
                      label: "Delivered",
                      active: result.status === "delivered",
                    },
                  ].map((step, idx) => (
                    <div key={step.key} className="flex flex-col items-center text-center p-2 rounded-xl bg-white shadow-2xs">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mb-1.5 transition-all ${
                        step.active
                          ? "bg-[#486800] text-white"
                          : "bg-gray-200 text-gray-400"
                      }`}>
                        {step.active ? (
                          <span className="material-symbols-outlined text-sm">check</span>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span className={`text-xs font-bold ${step.active ? "text-[#1e3a1f]" : "text-gray-400"}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Carrier AWB Card */}
            {result.shipping?.trackingNumber && (
              <div className="rounded-2xl bg-linear-to-r from-[#1e3a1f] to-[#2d5a27] p-5 sm:p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#a1d73a] font-bold block mb-0.5">
                    Carrier: {result.shipping.carrier || "National Logistics Partner"}
                  </span>
                  <p className="font-mono text-sm sm:text-base font-bold text-white">
                    AWB: {result.shipping.trackingNumber}
                  </p>
                  {result.shipping.estimatedDelivery && (
                    <p className="text-xs text-white/80 mt-1">
                      Estimated Arrival: {new Date(result.shipping.estimatedDelivery).toLocaleDateString("en-IN", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>

                <a
                  href={
                    result.shipping.trackingUrl ||
                    (String(result.shipping.carrier).toLowerCase().includes("ekart")
                      ? `https://ekartlogistics.com/shipmenttrack/${result.shipping.trackingNumber}`
                      : `https://shiprocket.co/tracking/${result.shipping.trackingNumber}`)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-[#c9ecc4] text-[#1e3a1f] font-extrabold px-5 py-2.5 rounded-full text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <span>Live Courier Tracking</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              </div>
            )}

            {/* Timeline Events Activity */}
            {result.timeline && result.timeline.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-extrabold text-[#1e3a1f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#486800] text-base">history</span>
                  <span>Shipment Activity Logs</span>
                </h3>

                <div className="bg-[#f5f3f0] rounded-2xl p-5 flex flex-col gap-4 border border-gray-200/60">
                  {result.timeline.map((ev, i) => {
                    const isFirst = i === 0;
                    return (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                          <span
                            className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                              isFirst ? "bg-[#486800] ring-4 ring-[#c9ecc4]" : "bg-gray-300"
                            }`}
                          />
                          {i < result.timeline.length - 1 && (
                            <span className="mt-1 w-0.5 h-8 bg-gray-300" />
                          )}
                        </div>
                        <div className="pb-1">
                          <p className="text-xs font-bold text-[#1e3a1f]">
                            {ev.message}
                          </p>
                          {ev.at && (
                            <p className="text-[10px] text-[#434936] mt-0.5">{fmtTime(ev.at)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Items Overview */}
            {result.items.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-extrabold text-[#1e3a1f]">
                  Items in Shipment ({result.items.length})
                </h3>
                <div className="divide-y divide-gray-100 rounded-2xl bg-white border border-gray-100 p-4">
                  {result.items.map((item, i) => (
                    <div key={i} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#f5f3f0] overflow-hidden shrink-0 border border-gray-100">
                          <img
                            src={item.image || FALLBACK_IMAGE}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1e3a1f]">{item.title}</p>
                          <p className="text-[11px] text-[#434936]">
                            {item.weight ? `${item.weight} • ` : ""}Qty: {item.qty}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#1e3a1f]">
                        {rupees(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Address */}
            {result.address && (
              <div className="p-4 rounded-2xl bg-[#f5f3f0] border border-gray-200/60 text-xs text-[#434936]">
                <span className="text-[10px] font-bold uppercase text-[#486800] block mb-1">
                  Delivery Destination
                </span>
                <p className="font-extrabold text-[#1e3a1f] text-sm">{result.address.name}</p>
                <p className="mt-0.5">
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
          </section>
        )}

        {/* Customer Help Box */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-base font-extrabold text-[#1e3a1f] mb-1">
              Can't locate your Order ID?
            </h3>
            <p className="text-xs text-[#434936]">
              Your order reference was sent via SMS and Email upon order confirmation. You can also reach our customer support team directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="tel:+919012659000"
              className="px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#1e3a1f] flex items-center gap-1.5 shadow-2xs"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">phone</span>
              <span>+91 9012659000</span>
            </a>
            <a
              href="mailto:support@agricola.co.in"
              className="px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#1e3a1f] flex items-center gap-1.5 shadow-2xs"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">mail</span>
              <span>support@agricola.co.in</span>
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
