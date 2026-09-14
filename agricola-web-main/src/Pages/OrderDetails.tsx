import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import { useStorefront } from "../storefront/StorefrontContext";
import { getOrder, type OrderDetail } from "../lib/checkout";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=400&q=70";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function OrderDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, openAuth } = useStorefront();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getOrder(id, controller.signal)
      .then(setOrder)
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Couldn't load this order.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-8 pb-16">
          <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-12 border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#c9ecc4]/60 flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a1f] mb-2">Sign In to View Order Details</h2>
            <p className="text-sm text-[#434936] mb-6 leading-relaxed">
              Please sign in with your mobile number to view batch provenance, tracking status, and invoices for this order.
            </p>
            <button
              onClick={() => openAuth()}
              className="rounded-full bg-[#486800] hover:bg-[#1e3a1f] px-8 py-3.5 text-sm font-bold text-white transition-all shadow-md cursor-pointer"
            >
              Login / Sign Up via OTP
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-20 text-center">
          <div className="w-12 h-12 border-4 border-[#486800] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-[#1e3a1f]">Loading Harvest Order Details…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-8 pb-16">
          <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-12 border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a1f] mb-2">{error || "Order Not Found"}</h2>
            <p className="text-sm text-[#434936] mb-6 leading-relaxed">
              We couldn't locate this order reference. Please check your tracking number or search active shipments.
            </p>
            <button
              onClick={() => navigate("/track")}
              className="rounded-full bg-[#486800] hover:bg-[#1e3a1f] px-8 py-3.5 text-sm font-bold text-white transition-all shadow-md cursor-pointer"
            >
              Track an Order
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const paid = order.paymentStatus === "paid";
  const cod = order.paymentMethod === "cod";

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb & Live Context Strip */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <Link to="/track" className="hover:text-[#486800] transition-colors">
              Tracking
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Order {order.orderId}</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#486800] animate-pulse" />
            <span className="text-xs font-bold text-[#434936]">
              Real-time Harvest Fulfillment Stream
            </span>
          </div>
        </section>

        {/* Order Header Card */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl ${
              paid || cod ? "bg-[#c9ecc4] text-[#486800]" : "bg-amber-100 text-amber-600"
            }`}>
              <span className="material-symbols-outlined text-3xl">
                {paid || cod ? "verified" : "pending"}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-[#1e3a1f]">
                  Order #{order.orderId}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  order.status === "delivered"
                    ? "bg-[#c9ecc4] text-[#486800]"
                    : order.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : "bg-[#eaf3db] text-[#486800]"
                }`}>
                  {order.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-[#434936]">
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#1e3a1f] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Print Invoice</span>
            </button>
            <Link
              to="/products"
              className="px-5 py-2.5 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-all"
            >
              <span className="material-symbols-outlined text-sm">shopping_bag</span>
              <span>Shop More</span>
            </Link>
          </div>
        </section>

        {/* Visual Milestones Stepper Progress */}
        {order.status !== "cancelled" && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-extrabold text-[#1e3a1f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#486800] text-xl">route</span>
                <span>Fulfillment Milestone Timeline</span>
              </h2>
              <span className="text-xs font-bold text-[#486800] bg-[#c9ecc4] px-3 py-1 rounded-full">
                Cold-Chain Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative">
              {[
                { key: "placed", label: "Harvest Reserved", sub: "Payment Confirmed", active: true },
                {
                  key: "processing",
                  label: "Graded & Packed",
                  sub: "Eco Vacuum Foil",
                  active: ["processing", "shipped", "out_for_delivery", "delivered"].includes(order.status),
                },
                {
                  key: "shipped",
                  label: "In Transit",
                  sub: order.shipping?.carrier || "Logistics Dispatch",
                  active: ["shipped", "out_for_delivery", "delivered"].includes(order.status),
                },
                {
                  key: "delivered",
                  label: "Delivered",
                  sub: "Fresh at Doorstep",
                  active: order.status === "delivered",
                },
              ].map((step, idx) => (
                <div key={step.key} className="flex flex-col items-center text-center p-3 rounded-2xl bg-[#f5f3f0]/60">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black mb-2 transition-all shadow-2xs ${
                    step.active
                      ? "bg-[#486800] text-white ring-4 ring-[#c9ecc4]/60"
                      : "bg-gray-200 text-gray-500"
                  }`}>
                    {step.active ? (
                      <span className="material-symbols-outlined text-base">check</span>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-xs font-bold ${step.active ? "text-[#1e3a1f]" : "text-gray-400"}`}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5">{step.sub}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Live Carrier AWB Card */}
        {order.shipping?.trackingNumber && (
          <section className="bg-linear-to-r from-[#1e3a1f] to-[#2d5a27] rounded-3xl p-6 sm:p-8 text-white shadow-md mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#a1d73a] text-2xl shrink-0">
                <span className="material-symbols-outlined">local_shipping</span>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-[#a1d73a] tracking-wider block mb-0.5">
                  Dispatched via {order.shipping.carrier || "National Logistics Partner"}
                </span>
                <p className="font-mono text-base sm:text-lg font-black tracking-wide">
                  AWB: {order.shipping.trackingNumber}
                </p>
                {order.shipping.estimatedDelivery && (
                  <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>
                      Estimated Arrival: {new Date(order.shipping.estimatedDelivery).toLocaleDateString("en-IN", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <a
              href={
                order.shipping.trackingUrl ||
                (String(order.shipping.carrier).toLowerCase().includes("ekart")
                  ? `https://ekartlogistics.com/shipmenttrack/${order.shipping.trackingNumber}`
                  : `https://shiprocket.co/tracking/${order.shipping.trackingNumber}`)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-[#c9ecc4] text-[#1e3a1f] font-extrabold px-6 py-3 rounded-full text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span>Live Carrier Tracking</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </section>
        )}

        {/* Main Grid: Items & Order Summary (12-Col) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Items List & Traceability Info (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Items Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <h3 className="text-lg font-black text-[#1e3a1f]">Ordered Superfoods &amp; Harvests</h3>
                  <span className="text-xs text-[#434936]">
                    {order.items.length} {order.items.length === 1 ? "Item" : "Items"} packed in nitrogen-flushed eco pouches
                  </span>
                </div>
                <span className="text-xs font-bold text-[#486800] bg-[#c9ecc4] px-3 py-1 rounded-full">
                  100% Lab Tested
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {order.items.map((item, i) => (
                  <div key={i} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#f5f3f0] overflow-hidden shrink-0 border border-gray-100">
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
                        <h4 className="font-bold text-[#1e3a1f] text-sm sm:text-base leading-snug">
                          {item.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#434936]">
                          {item.weight && (
                            <span className="bg-[#f5f3f0] px-2 py-0.5 rounded-md font-semibold">
                              Pack: {item.weight}
                            </span>
                          )}
                          <span>Qty: {item.qty}</span>
                          <span>•</span>
                          <span>{rupees(item.price)} each</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right self-end sm:self-center shrink-0">
                      <span className="text-base font-black text-[#1e3a1f]">
                        {rupees(item.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-[#f5f3f0] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#1e3a1f]">
                  <span className="material-symbols-outlined text-[#486800] text-lg">verified</span>
                  <span className="font-medium">All batches certified for purity, zero pesticides &amp; heavy metals.</span>
                </div>
                <span className="text-[#486800] font-bold">FSSAI &amp; Jaivik Bharat Traceable</span>
              </div>
            </div>

            {/* Address & Payment Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Delivery Address Card */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#486800] text-xl">location_on</span>
                  <h4 className="text-base font-extrabold text-[#1e3a1f]">Delivery Address</h4>
                </div>
                {order.address ? (
                  <div className="text-xs text-[#434936] space-y-1 leading-relaxed">
                    <p className="font-extrabold text-[#1e3a1f] text-sm">{order.address.name}</p>
                    <p>
                      {[
                        order.address.street,
                        order.address.city,
                        order.address.state,
                        order.address.pincode,
                        order.address.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {order.address.phone && (
                      <p className="font-semibold text-[#1e3a1f] pt-1">📞 {order.address.phone}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Address information unavailable.</p>
                )}
              </div>

              {/* Payment Details Card */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#486800] text-xl">account_balance_wallet</span>
                  <h4 className="text-base font-extrabold text-[#1e3a1f]">Payment Information</h4>
                </div>
                <div className="text-xs text-[#434936] space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Payment Mode</span>
                    <span className="font-bold text-[#1e3a1f] uppercase">{order.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Payment Status</span>
                    <span className={`font-bold capitalize px-2 py-0.5 rounded-md ${
                      paid ? "bg-[#c9ecc4] text-[#486800]" : "bg-amber-100 text-amber-700"
                    }`}>
                      {order.paymentStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span>Transaction Type</span>
                    <span className="font-medium text-gray-500">256-Bit Encrypted Secure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Financial Summary Sticky (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-28">
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col gap-4">
              <h3 className="text-lg font-black text-[#1e3a1f] pb-3 border-b border-gray-100">
                Payment Breakdown
              </h3>

              <div className="flex flex-col gap-2.5 text-xs text-[#434936]">
                <div className="flex justify-between items-center">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-[#1e3a1f]">{rupees(order.pricing.subtotal)}</span>
                </div>

                {order.pricing.discount > 0 && (
                  <div className="flex justify-between items-center text-[#486800] font-bold">
                    <span>Promo Discount</span>
                    <span>- {rupees(order.pricing.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span>Cold-Chain Delivery</span>
                  <span className="font-bold text-[#1e3a1f]">
                    {order.pricing.charges === 0 ? "FREE" : rupees(order.pricing.charges)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-gray-400">
                  <span>Taxes &amp; Statutory Levies</span>
                  <span>Included</span>
                </div>
              </div>

              {/* Total Paid Box */}
              <div className="bg-[#f5f3f0] rounded-2xl p-4 flex items-center justify-between border border-gray-200/60 mt-1">
                <div>
                  <span className="text-[11px] uppercase font-bold text-gray-400 block tracking-wider">
                    Total Amount
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {paid ? "Paid via Razorpay" : cod ? "Payable on Delivery" : "Payment Pending"}
                  </span>
                </div>
                <span className="text-2xl font-black text-[#1e3a1f]">
                  {rupees(order.pricing.total)}
                </span>
              </div>

              {/* Farmer Direct Settlement Notice */}
              <div className="flex items-center gap-2 p-3 bg-[#c9ecc4]/30 rounded-2xl text-xs text-[#1e3a1f] border border-[#84b817]/20">
                <span className="material-symbols-outlined text-lg text-[#486800] shrink-0">handshake</span>
                <p className="leading-tight text-[11px]">
                  <strong>Farmer Settlement:</strong> Proceeds directly support Mithila &amp; Meghalaya smallholder organic growers.
                </p>
              </div>

              {/* Customer Care Box */}
              <div className="p-4 rounded-2xl bg-white border border-gray-100 flex flex-col gap-2">
                <span className="text-xs font-bold text-[#1e3a1f]">Need help with this harvest?</span>
                <div className="flex flex-col gap-1 text-xs text-[#434936]">
                  <a href="tel:+919012659000" className="hover:text-[#486800] flex items-center gap-1.5 font-semibold">
                    <span className="material-symbols-outlined text-sm">phone</span>
                    <span>+91 9012659000</span>
                  </a>
                  <a href="mailto:support@agricola.co.in" className="hover:text-[#486800] flex items-center gap-1.5 font-semibold">
                    <span className="material-symbols-outlined text-sm">mail</span>
                    <span>support@agricola.co.in</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
