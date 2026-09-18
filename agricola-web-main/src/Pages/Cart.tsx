import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import PincodeCheck from "../components/delivery/PincodeCheck";
import { useStorefront } from "../storefront/StorefrontContext";
import { getCheckoutConfig, validateDiscount, type DeliveryQuote } from "../lib/checkout";
import { clearCart } from "../lib/cart";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=400&q=70";

export default function Cart() {
  const navigate = useNavigate();
  const { isLoggedIn, cart, refreshCart, updateItem, removeItem, openAuth } =
    useStorefront();
  const [busy, setBusy] = useState(false);
  const [freeThreshold, setFreeThreshold] = useState<number>(799);
  const [standardDeliveryFee, setStandardDeliveryFee] = useState<number>(50);
  const [delivery, setDelivery] = useState<DeliveryQuote | null>(null);
  const [couponCode, setCouponCode] = useState("");
  // appliedCoupons stores { code, discount } from the backend
  const [appliedCoupons, setAppliedCoupons] = useState<{ code: string; discount: number }[]>([]);
  const [allowStacking, setAllowStacking] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const canCheckout = !!delivery && (delivery.serviceable || !!delivery.unverified);

  const handleDeliveryResult = useCallback((result: DeliveryQuote | null) => {
    setDelivery(result);
  }, []);

  useEffect(() => {
    if (isLoggedIn) refreshCart();
  }, [isLoggedIn, refreshCart]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("agricola_applied_coupons");
      if (raw && cart.subtotal > 0 && appliedCoupons.length === 0) {
        const codes: string[] = JSON.parse(raw);
        if (Array.isArray(codes) && codes.length > 0) {
          (async () => {
            const revalidated: { code: string; discount: number }[] = [];
            for (const code of codes) {
              const res = await validateDiscount(code, cart.subtotal, revalidated.map((r) => r.code));
              if (res.valid) {
                revalidated.push({ code, discount: res.discount });
              }
            }
            if (revalidated.length > 0) {
              setAppliedCoupons(revalidated);
            }
          })();
        }
      }
    } catch {}
  }, [cart.subtotal]);

  useEffect(() => {
    if (appliedCoupons.length > 0) {
      localStorage.setItem(
        "agricola_applied_coupons",
        JSON.stringify(appliedCoupons.map((c) => c.code))
      );
    }
  }, [appliedCoupons]);

  useEffect(() => {
    getCheckoutConfig()
      .then((c) => {
        if (c.freeShippingThreshold) setFreeThreshold(c.freeShippingThreshold);
        if (typeof c.standardDeliveryCharge === "number") setStandardDeliveryFee(c.standardDeliveryCharge);
        if (c.allowCouponStacking !== undefined) setAllowStacking(!!c.allowCouponStacking);
      })
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const changeQty = (id: string, qty: number) => {
    if (qty < 1) return run(() => removeItem(id));
    return run(() => updateItem(id, qty));
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = couponCode.trim().toUpperCase();
    if (!clean) return;

    if (appliedCoupons.some((c) => c.code === clean)) {
      setCouponError("This coupon is already applied.");
      return;
    }

    if (appliedCoupons.length >= 1 && !allowStacking) {
      setCouponError("Coupon stacking is currently disabled by store policy. Remove current coupon to use another.");
      return;
    }

    if (appliedCoupons.length >= 2) {
      setCouponError("Maximum of 2 coupons can be applied per order.");
      return;
    }

    setCouponLoading(true);
    setCouponError("");
    try {
      const result = await validateDiscount(
        clean,
        cart.subtotal,
        appliedCoupons.map((c) => c.code)
      );
      if (result.valid) {
        setAppliedCoupons((prev) => [...prev, { code: clean, discount: result.discount }]);
        setCouponCode("");
        setCouponError("");
      } else {
        setCouponError(result.message || "Invalid or expired coupon code.");
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = (codeToRemove: string) => {
    setAppliedCoupons((prev) => prev.filter((c) => c.code !== codeToRemove));
    setCouponError("");
  };

  const handleClearCart = async () => {
    if (!window.confirm("Are you sure you want to clear your harvest cart?")) return;
    run(async () => {
      localStorage.removeItem("agricola_applied_coupons");
      setAppliedCoupons([]);
      await clearCart();
      await refreshCart();
    });
  };

  // Calculations — discount amounts come from the backend (real values)
  const discountAmount = appliedCoupons.reduce((sum, c) => sum + (c.discount || 0), 0);
  const isFreeDelivery = cart.subtotal >= freeThreshold;
  const shippingCharge = isFreeDelivery
    ? 0
    : delivery?.delivery && !delivery.delivery.free
    ? delivery.delivery.charge
    : standardDeliveryFee;
  const totalPayable = Math.max(0, cart.subtotal - discountAmount + shippingCharge);
  const progressPercent = Math.min(100, Math.round((cart.subtotal / freeThreshold) * 100));
  const remainingForFree = Math.max(0, freeThreshold - cart.subtotal);

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb & Live Context Strip (Stitch Design) */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Shopping Cart</span>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-gray-400">Checkout &amp; Verification</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#486800] animate-pulse" />
            <span className="text-xs font-semibold text-[#434936]">
              Lab-Verified Batches Reserved in Session
            </span>
          </div>
        </section>

        {/* Header & Dynamic Shipping Progress Bar */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 mb-8 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] tracking-tight">
                Your Harvest Cart
              </h1>
              <span className="text-xs font-bold text-[#486800] bg-[#c9ecc4] px-3 py-1 rounded-full">
                {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[#486800] text-xs font-bold bg-[#c9ecc4]/40 px-3 py-1.5 rounded-xl">
              <span className="material-symbols-outlined text-base">verified_user</span>
              <span>100% Pure &amp; Quality Tested</span>
            </div>
          </div>

          {/* Free Shipping Progress Tracker */}
          <div className="bg-[#f5f3f0] rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#486800] text-xl">local_shipping</span>
                <p className="text-xs sm:text-sm font-semibold text-[#1e3a1f]">
                  {isFreeDelivery ? (
                    <span>🎉 Your order qualifies for <strong className="text-[#486800]">FREE Standard Shipping</strong> across India!</span>
                  ) : (
                    <span>
                      Add <strong className="text-[#486800]">₹{remainingForFree.toLocaleString("en-IN")} more</strong> for <strong className="text-[#486800]">FREE Standard Shipping</strong>!
                    </span>
                  )}
                </p>
              </div>
              <span className="text-xs font-extrabold text-[#434936] bg-white px-3 py-1 rounded-lg shadow-2xs">
                Current: ₹{cart.subtotal.toLocaleString("en-IN")} / Target: ₹{freeThreshold.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="w-full bg-white h-2.5 rounded-full overflow-hidden relative shadow-inner">
              <div
                className="h-full bg-[#486800] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>

        {/* Empty Cart State vs Full Cart Items Grid */}
        {cart.items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-8 border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#c9ecc4]/60 flex items-center justify-center text-3xl mx-auto mb-4">
              🌾
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a1f] mb-2">Your Harvest Cart is Empty</h2>
            <p className="text-sm text-[#434936] mb-6 leading-relaxed">
              Discover farm-direct Mithila Makhana, whole leaf teas, and fresh harvests directly from Indian farms.
            </p>
            <button
              onClick={() => navigate("/products")}
              className="rounded-full bg-[#486800] hover:bg-[#1e3a1f] px-8 py-3.5 text-sm font-bold text-white transition-all shadow-md cursor-pointer"
            >
              Explore Organic Harvests
            </button>
          </div>
        ) : (
          /* Main 12-Column Cart Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Items List (8 Cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-white rounded-3xl shadow-xs border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {cart.items.map((item) => (
                  <article
                    key={item.id}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between hover:bg-[#fbf9f6]/80 transition-colors"
                  >
                    {/* Item Details */}
                    <div className="flex gap-4 items-center w-full sm:w-auto">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#f5f3f0] shrink-0 overflow-hidden relative shadow-2xs border border-gray-100">
                        <img
                          src={item.image || FALLBACK_IMAGE}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#486800]">
                          100% Soil Tested • Single Origin
                        </span>
                        <h3 className="font-bold text-[#1e3a1f] text-sm sm:text-base mt-0.5 leading-snug">
                          {item.title}
                        </h3>
                        {item.weight && (
                          <span className="text-xs text-[#434936] font-semibold mt-0.5">
                            Pack: {item.weight}
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-[#1e3a1f] sm:hidden mt-1">
                          ₹{item.price} each
                        </span>
                      </div>
                    </div>

                    {/* Stepper + Price + Remove */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                      {/* Unit Price (Desktop) */}
                      <div className="hidden sm:flex flex-col text-right">
                        <span className="text-[11px] text-gray-400">Unit Price</span>
                        <span className="text-xs font-bold text-[#1e3a1f]">₹{item.price}</span>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-[#f5f3f0] rounded-full p-1 border border-gray-200 shadow-2xs">
                        <button
                          onClick={() => changeQty(item.id, item.qty - 1)}
                          disabled={busy}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 rounded-full bg-white text-[#1e3a1f] hover:bg-gray-100 flex items-center justify-center font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <span className="w-8 text-center text-xs font-black text-[#1e3a1f]">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => changeQty(item.id, item.qty + 1)}
                          disabled={busy}
                          aria-label="Increase quantity"
                          className="w-8 h-8 rounded-full bg-white text-[#1e3a1f] hover:bg-gray-100 flex items-center justify-center font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="flex flex-col text-right min-w-[70px]">
                        <span className="text-[11px] text-gray-400 hidden sm:block">Line Total</span>
                        <span className="text-sm sm:text-base font-black text-[#1e3a1f]">
                          ₹{item.lineTotal.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => run(() => removeItem(item.id))}
                        disabled={busy}
                        aria-label={`Remove ${item.title}`}
                        className="w-8 h-8 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                        title="Remove Item"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#486800] hover:text-[#1e3a1f] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Continue Shopping</span>
                </Link>
                <button
                  onClick={handleClearCart}
                  disabled={busy}
                  className="text-xs font-bold text-red-500 hover:text-red-700 underline cursor-pointer disabled:opacity-50"
                >
                  Clear Entire Basket
                </button>
              </div>
            </div>

            {/* Right Column: Order Summary Sticky (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-28">
              {/* Order Summary Card */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="text-lg font-black text-[#1e3a1f]">Order Summary</h3>
                  <span className="text-[11px] font-bold text-[#486800] bg-[#c9ecc4] px-2.5 py-0.5 rounded-full">
                    INR (₹)
                  </span>
                </div>

                {/* Calculation Lines */}
                <div className="flex flex-col gap-2.5 text-xs text-[#434936]">
                  <div className="flex justify-between items-center">
                    <span>Cart Subtotal ({cart.itemCount} items)</span>
                    <span className="font-bold text-[#1e3a1f] text-sm">₹{cart.subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  {appliedCoupons.length > 0 && (
                    <div className="flex justify-between items-center text-[#486800] font-bold">
                      <span className="flex items-center gap-1 flex-wrap">
                        <span className="material-symbols-outlined text-sm">local_offer</span>
                        <span>Promo Discounts ({appliedCoupons.map((c) => c.code).join(" + ")})</span>
                      </span>
                      <span>-₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <span>Standard Dispatch</span>
                      <span className="material-symbols-outlined text-xs text-gray-400" title="Free on orders above threshold">
                        info
                      </span>
                    </span>
                    <span className="font-bold text-[#1e3a1f]">
                      {shippingCharge === 0 ? (
                        <span className="text-[#486800]">FREE</span>
                      ) : (
                        `₹${shippingCharge.toLocaleString("en-IN")}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-gray-400">
                    <span>Mandatory GST &amp; Krishi Cess</span>
                    <span>Included</span>
                  </div>
                </div>

                {/* Promo Code Section */}
                <div className="bg-[#f5f3f0] rounded-2xl p-3.5 flex flex-col gap-2">
                  {appliedCoupons.length > 0 && (
                    <div className="space-y-1.5">
                      {appliedCoupons.map(({ code, discount }) => (
                        <div key={code} className="flex items-center justify-between bg-[#c9ecc4] text-[#1e3a1f] px-3 py-1.5 rounded-xl text-xs font-bold">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#486800]">check_circle</span>
                            <span className="font-mono">{code}</span>
                            <span className="text-[10px] text-[#486800]">-₹{discount.toLocaleString("en-IN")} off</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCoupon(code)}
                            className="text-gray-500 hover:text-red-500 text-xs font-bold cursor-pointer"
                            title="Remove coupon"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(!appliedCoupons.length || (allowStacking && appliedCoupons.length < 2)) && (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={appliedCoupons.length > 0 ? "Add 2nd coupon code" : "Enter coupon code"}
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={couponLoading}
                        className="flex-1 bg-white px-3 py-2 rounded-xl text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817] uppercase disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={couponLoading || !couponCode.trim()}
                        className="bg-[#1e3a1f] hover:bg-[#486800] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-w-[52px]"
                      >
                        {couponLoading ? "…" : appliedCoupons.length > 0 ? "Stack" : "Apply"}
                      </button>
                    </form>
                  )}
                  {couponError && <p className="text-[11px] text-red-500 font-bold">{couponError}</p>}
                </div>

                {/* Total Payable Box */}
                <div className="bg-[#f5f3f0] rounded-2xl p-4 flex items-center justify-between border border-gray-200/60">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-gray-400 block tracking-wider">
                      Total Payable
                    </span>
                    <span className="text-[10px] text-gray-500">All taxes &amp; levies included</span>
                  </div>
                  <span className="text-2xl font-black text-[#1e3a1f]">
                    ₹{totalPayable.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Direct Farmer Guarantee Footnote */}
                <div className="flex items-center gap-2 p-3 bg-[#c9ecc4]/30 rounded-2xl text-xs text-[#1e3a1f] border border-[#84b817]/20">
                  <span className="material-symbols-outlined text-lg text-[#486800] shrink-0">handshake</span>
                  <p className="leading-tight text-[11px]">
                    <strong>100% Direct Settlement:</strong> Fair compensation is directly settled to farmer cooperative accounts upon harvest dispatch.
                  </p>
                </div>

                {/* Pincode & Delivery Checker Card */}
                <div className="pt-1">
                  <PincodeCheck
                    variant="cart"
                    items={cart.items.map((i) => ({
                      productId: i.productId,
                      qty: i.qty,
                      weight: i.weight,
                    }))}
                    onResult={handleDeliveryResult}
                  />
                </div>

                {/* Proceed to Checkout CTA */}
                <button
                  type="button"
                  onClick={() => {
                    const codes = appliedCoupons.map((c) => c.code);
                    localStorage.setItem("agricola_applied_coupons", JSON.stringify(codes));
                    if (!isLoggedIn) {
                      openAuth(() =>
                        navigate("/checkout", { state: { couponCodes: codes } })
                      );
                    } else {
                      navigate("/checkout", { state: { couponCodes: codes } });
                    }
                  }}
                  disabled={!canCheckout}
                  className="w-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-sm font-bold py-4 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Proceed to Checkout</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
                {!canCheckout && (
                  <p className="text-center text-[11px] text-gray-500">
                    {delivery && !delivery.serviceable
                      ? "Delivery is unavailable for this pincode — please try another."
                      : "Check delivery availability for your pincode above to proceed."}
                  </p>
                )}
              </div>

              {/* Trust Badges Under Summary */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 flex flex-col gap-3 text-xs text-[#434936]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-[#486800] shrink-0 font-bold">
                    <span className="material-symbols-outlined text-base">lock</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#1e3a1f] block text-xs">256-Bit Encrypted Payments</span>
                    <span className="text-[11px] text-gray-400">Razorpay, UPI, Netbanking &amp; Cards</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-[#486800] shrink-0 font-bold">
                    <span className="material-symbols-outlined text-base">verified</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#1e3a1f] block text-xs">Zero-Friction Replacements</span>
                    <span className="text-[11px] text-gray-400">7-Day Crunch &amp; Purity Guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
