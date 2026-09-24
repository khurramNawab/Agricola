import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import { useStorefront } from "../storefront/StorefrontContext";
import {
  getOrder,
  downloadOrderInvoice,
  emailOrderInvoice,
  cancelCustomerOrder,
  updateOrderShippingAddress,
  type OrderDetail
} from "../lib/checkout";

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
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [emailingInvoice, setEmailingInvoice] = useState(false);
  const [emailSentMsg, setEmailSentMsg] = useState("");

  // Customer cancellation state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("Ordered by mistake");
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState("");

  // Delivery details edit state (allowed before carrier accepts/books shipment)
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [addressError, setAddressError] = useState("");
  const [addressSuccessMsg, setAddressSuccessMsg] = useState("");

  const canCancel = Boolean(
    order &&
    ["pending", "confirmed", "processing"].includes(order.status) &&
    !order.shipping?.shippedAt &&
    order.status !== "shipped" &&
    order.status !== "delivered" &&
    order.status !== "cancelled" &&
    order.status !== "refunded"
  );

  const canEditAddress = Boolean(
    order &&
    order.address &&
    !order.shipping?.trackingNumber &&
    !order.shipping?.providerOrderId &&
    !order.shipping?.shippedAt &&
    ["pending", "confirmed"].includes(order.status)
  );

  const openAddressEditModal = () => {
    if (!order?.address) return;
    setAddressForm({
      name: order.address.name || "",
      phone: String(order.address.phone || "").replace(/\D/g, "").slice(-10),
      street: order.address.street || "",
      city: order.address.city || "",
      state: order.address.state || "",
      pincode: String(order.address.pincode || "").replace(/\D/g, "").slice(0, 6),
    });
    setAddressError("");
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || updatingAddress) return;
    setUpdatingAddress(true);
    setAddressError("");
    try {
      const updated = await updateOrderShippingAddress(order.id || id, addressForm);
      setOrder(updated);
      setAddressModalOpen(false);
      setAddressSuccessMsg("Delivery details updated successfully!");
      setTimeout(() => setAddressSuccessMsg(""), 6000);
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : "Failed to update delivery address");
    } finally {
      setUpdatingAddress(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const finalReason =
        cancelReason === "Other"
          ? (customReason.trim() || "Cancelled by customer")
          : cancelReason;
      const updated = await cancelCustomerOrder(order.id || id, finalReason);
      setOrder(updated);
      setCancelModalOpen(false);
      setCancelSuccessMsg("Your order has been cancelled successfully.");
      setTimeout(() => setCancelSuccessMsg(""), 8000);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order || downloadingInvoice) return;
    setDownloadingInvoice(true);
    try {
      await downloadOrderInvoice(order.id || id, order.orderId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download invoice");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!order || emailingInvoice) return;
    setEmailingInvoice(true);
    setEmailSentMsg("");
    try {
      const res = await emailOrderInvoice(order.id || id);
      setEmailSentMsg(res.message || "Tax invoice sent to your email!");
      setTimeout(() => setEmailSentMsg(""), 6000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to email invoice");
    } finally {
      setEmailingInvoice(false);
    }
  };

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

          <div className="flex flex-wrap items-center gap-3">
            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  setCancelError("");
                  setCancelModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-full border border-red-200 bg-red-50/80 hover:bg-red-100 text-xs font-bold text-red-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Cancel your order before pickup/dispatch"
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                <span>Cancel Order</span>
              </button>
            )}
            <button
              type="button"
              disabled={downloadingInvoice}
              onClick={handleDownloadInvoice}
              className="px-4 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#1e3a1f] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Download official GST Tax Invoice PDF"
            >
              <span className={`material-symbols-outlined text-sm ${downloadingInvoice ? "animate-spin" : ""}`}>
                {downloadingInvoice ? "sync" : "download"}
              </span>
              <span>{downloadingInvoice ? "Generating PDF…" : "Tax Invoice (PDF)"}</span>
            </button>
            <button
              type="button"
              disabled={emailingInvoice}
              onClick={handleEmailInvoice}
              className="px-4 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#1e3a1f] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Email official Tax Invoice PDF to your email"
            >
              <span className={`material-symbols-outlined text-sm ${emailingInvoice ? "animate-spin" : ""}`}>
                {emailingInvoice ? "sync" : "mail"}
              </span>
              <span>{emailingInvoice ? "Sending Email…" : "Email Invoice"}</span>
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

        {addressSuccessMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-[#c9ecc4]/70 border border-[#84b817]/40 text-[#1e3a1f] text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs animate-in fade-in">
            <span className="material-symbols-outlined text-[#486800]">check_circle</span>
            <span>{addressSuccessMsg}</span>
          </div>
        )}

        {cancelSuccessMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs animate-in fade-in">
            <span className="material-symbols-outlined text-amber-700">check_circle</span>
            <span>{cancelSuccessMsg}</span>
          </div>
        )}

        {emailSentMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-[#c9ecc4]/60 border border-[#84b817]/40 text-[#1e3a1f] text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs animate-in fade-in">
            <span className="material-symbols-outlined text-[#486800]">mark_email_read</span>
            <span>{emailSentMsg}</span>
          </div>
        )}

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
                  <span className="font-medium">All batches lab-tested for purity, zero pesticides &amp; heavy metals.</span>
                </div>
                <span className="text-[#486800] font-bold">100% Farm Pure &amp; Quality Verified</span>
              </div>
            </div>

            {/* Address & Payment Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Delivery Address Card */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#486800] text-xl">location_on</span>
                      <h4 className="text-base font-extrabold text-[#1e3a1f]">Delivery Address</h4>
                    </div>
                    {canEditAddress ? (
                      <button
                        type="button"
                        onClick={openAddressEditModal}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#486800] hover:text-[#1e3a1f] px-3 py-1 rounded-full bg-[#f5f3f0] hover:bg-[#eaf3db] transition-colors cursor-pointer border border-[#486800]/20"
                        title="Edit recipient name, phone or address"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                        <span>Change</span>
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full"
                        title="Delivery details are locked once the order is accepted/booked with the courier."
                      >
                        <span className="material-symbols-outlined text-xs">lock</span>
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  {order.address ? (
                    <div className="text-xs text-[#434936] space-y-1.5 leading-relaxed">
                      <p className="font-extrabold text-[#1e3a1f] text-sm flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-gray-400">person</span>
                        <span>{order.address.name}</span>
                      </p>
                      <p className="flex items-start gap-1.5 text-gray-600">
                        <span className="material-symbols-outlined text-sm text-gray-400 shrink-0 mt-0.5">home_pin</span>
                        <span>
                          {[
                            order.address.street,
                            order.address.city,
                            order.address.state,
                            order.address.pincode,
                            order.address.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </p>
                      {order.address.phone && (
                        <p className="font-bold text-[#1e3a1f] pt-0.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-gray-400">call</span>
                          <span>+91 {order.address.phone.replace(/\D/g, '').slice(-10)}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Address information unavailable.</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 text-[11px]">
                  {canEditAddress ? (
                    <p className="text-[#486800] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-xs">info</span>
                      <span>You can edit address until carrier dispatch.</span>
                    </p>
                  ) : (
                    <p className="text-gray-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">lock</span>
                      <span>Locked with courier partner.</span>
                    </p>
                  )}
                </div>
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

        {/* Customer Cancel Order Modal */}
        {cancelModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 id="cancel-modal-title" className="text-lg font-black text-[#1e3a1f]">
                    Cancel Order #{order.orderId}?
                  </h3>
                  <p className="text-xs text-[#434936] mt-1 leading-relaxed">
                    You can cancel this order before our logistics team picks up and ships the parcel. This will release the reserved items and halt carrier dispatch.
                  </p>
                </div>
              </div>

              {cancelError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <label className="block text-xs font-bold text-[#1e3a1f]">
                  Please let us know the reason for cancellation:
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                >
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Need to change shipping address or mobile">Need to change shipping address or mobile</option>
                  <option value="Want to change items or add coupon">Want to change items or add coupon</option>
                  <option value="Delivery time is too long">Delivery time is too long</option>
                  <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                  <option value="Other">Other reason</option>
                </select>

                {cancelReason === "Other" && (
                  <textarea
                    rows={2}
                    placeholder="Tell us more about why you're cancelling (optional)..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full text-xs text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                  />
                )}

                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0 text-amber-600 mt-0.5">info</span>
                  <p>
                    {order.paymentMethod === "cod"
                      ? "This is a Cash on Delivery order. No payment will be charged upon cancellation."
                      : "For prepaid orders, any initiated refund will be credited back to your original payment method in 3–5 working days."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => {
                    setCancelModalOpen(false);
                    setCancelError("");
                  }}
                  className="px-4 py-2.5 rounded-full border border-gray-200 text-xs font-bold text-[#434936] hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancelOrder}
                  className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cancelling && (
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  )}
                  <span>{cancelling ? "Cancelling Order…" : "Yes, Cancel Order"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Edit Delivery Details Modal */}
        {addressModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-modal-title"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#c9ecc4]/60 text-[#486800] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">home_pin</span>
                  </div>
                  <div>
                    <h3 id="address-modal-title" className="text-base font-black text-[#1e3a1f]">
                      Edit Delivery Details
                    </h3>
                    <p className="text-xs text-[#434936]">
                      Order #{order.orderId} • Allowed before courier dispatch
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {addressError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{addressError}</span>
                </div>
              )}

              <form onSubmit={handleSaveAddress} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1e3a1f] mb-1">
                    Recipient Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.name}
                    onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1e3a1f] mb-1">
                    Contact Mobile Number (10 digits) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-gray-400 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={addressForm.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setAddressForm({ ...addressForm, phone: val });
                      }}
                      placeholder="9876543210"
                      className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl pl-11 pr-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1e3a1f] mb-1">
                    Flat, House No., Building, Street, Landmark <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    placeholder="e.g. Flat 402, Green Valley Apts, Prempura Street"
                    className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1e3a1f] mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      placeholder="e.g. Kaithal"
                      className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1e3a1f] mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      placeholder="e.g. Haryana"
                      className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1e3a1f] mb-1">
                    PIN Code (6 digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={addressForm.pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setAddressForm({ ...addressForm, pincode: val });
                    }}
                    placeholder="e.g. 136027"
                    className="w-full text-xs font-medium text-[#1e3a1f] bg-[#fbf9f6] border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#486800]/20 focus:border-[#486800]"
                  />
                </div>

                <div className="p-3 bg-[#f5f3f0] rounded-xl text-[11px] text-[#434936] flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#486800]">verified</span>
                  <span>Once updated, our logistics system will direct your package to this new address.</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={updatingAddress}
                    onClick={() => {
                      setAddressModalOpen(false);
                      setAddressError("");
                    }}
                    className="px-4 py-2.5 rounded-full border border-gray-200 text-xs font-bold text-[#434936] hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingAddress}
                    className="px-5 py-2.5 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {updatingAddress && (
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    )}
                    <span>{updatingAddress ? "Saving Address…" : "Save Delivery Details"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
