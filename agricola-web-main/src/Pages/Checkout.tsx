import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import AddressModal, {
  type AddressForm,
} from "../components/checkout/AddressModal";
import { useStorefront } from "../storefront/StorefrontContext";
import {
  type Address,
  type CheckoutSummary,
  type OrderItemInput,
  type PaymentMethod,
  type PlacedOrder,
  abandonOrder,
  createAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
  getCheckoutConfig,
  getCheckoutSummary,
  getPaymentMethods,
  loadRazorpayCheckout,
  placeOrder,
  validateDiscount,
  verifyPayment,
} from "../lib/checkout";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=400&q=70";

// Address → editable form
const toAddressForm = (a: Address): AddressForm => ({
  name: a.name,
  mobile: a.mobile,
  pincode: a.pincode,
  state: a.state,
  house: a.house,
  address: a.address,
  locality: a.locality,
  city: a.city,
  type: a.type,
});

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, openAuth, user, cart, refreshCart } = useStorefront();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressInitial, setAddressInitial] = useState<Partial<AddressForm> | null>(
    null
  );

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState("");

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);
  const [allowStacking, setAllowStacking] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [discountChecking, setDiscountChecking] = useState(false);

  // Restore and dynamically re-validate coupons from location state or localStorage
  useEffect(() => {
    let rawCodes: string[] = [];
    const stateCodes = (location.state as { couponCodes?: string[] } | null)?.couponCodes;
    if (Array.isArray(stateCodes) && stateCodes.length > 0) {
      rawCodes = stateCodes;
    } else {
      try {
        const local = localStorage.getItem("agricola_applied_coupons");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) rawCodes = parsed;
        }
      } catch {}
    }
    if (rawCodes.length === 0 || cart.subtotal <= 0) return;

    let active = true;
    (async () => {
      const validated: string[] = [];
      for (const code of rawCodes) {
        try {
          const res = await validateDiscount(code, cart.subtotal, validated);
          if (res.valid) {
            validated.push(code.toUpperCase());
          }
        } catch {}
      }
      if (active && validated.length > 0) {
        setAppliedCodes(validated);
        localStorage.setItem("agricola_applied_coupons", JSON.stringify(validated));
      }
    })();

    return () => {
      active = false;
    };
  }, [cart.subtotal, location.state]);

  // Keep localStorage in sync when appliedCodes change
  useEffect(() => {
    if (appliedCodes.length > 0) {
      localStorage.setItem("agricola_applied_coupons", JSON.stringify(appliedCodes));
    }
  }, [appliedCodes]);

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState("");
  const [freeThreshold, setFreeThreshold] = useState<number | null>(null);

  const orderItems = useMemo<OrderItemInput[]>(
    () =>
      cart.items.map((i) => ({
        productId: i.productId,
        weight: i.weight,
        qty: i.qty,
      })),
    [cart.items]
  );
  const itemsKey = JSON.stringify(orderItems);

  // Load saved addresses + payment methods once the user is known.
  useEffect(() => {
    if (!isLoggedIn) return;
    const controller = new AbortController();

    getAddresses(controller.signal)
      .then((list) => {
        setAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setSelectedAddressId((cur) => cur || def.id);
      })
      .catch(() => {});

    getPaymentMethods(controller.signal)
      .then((list) => {
        setMethods(list);
        const firstEnabled = list.find((m) => m.enabled);
        if (firstEnabled) setSelectedPayment((cur) => cur || firstEnabled.id);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [isLoggedIn]);

  // Recompute the money summary when items, address, or discount change.
  useEffect(() => {
    if (!isLoggedIn || orderItems.length === 0) {
      setSummary(null);
      return;
    }
    const controller = new AbortController();
    getCheckoutSummary(
      {
        items: orderItems,
        shippingAddressId: selectedAddressId || undefined,
        discountCode: appliedCodes.length > 0 ? appliedCodes.join(",") : undefined,
      },
      controller.signal
    )
      .then(setSummary)
      .catch(() => {});
    return () => controller.abort();
  }, [isLoggedIn, itemsKey, selectedAddressId, appliedCodes]);

  // Pre-fill the email from the account once it's known.
  useEffect(() => {
    if (user?.email) setEmail((cur) => cur || user.email || "");
  }, [user]);

  // Storefront config (free-shipping threshold & coupon stacking).
  useEffect(() => {
    getCheckoutConfig()
      .then((c) => {
        setFreeThreshold(c.freeShippingThreshold);
        if (c.allowCouponStacking !== undefined) setAllowStacking(!!c.allowCouponStacking);
      })
      .catch(() => {});
  }, []);

  const openAddAddress = () => {
    setAddressError("");
    setEditingAddressId(null);
    setAddressInitial({
      name: user?.name || "",
      mobile: (user?.phone || "").replace("+91", ""),
    });
    setAddressOpen(true);
  };

  const openEditAddress = (a: Address) => {
    setAddressError("");
    setEditingAddressId(a.id);
    setAddressInitial(toAddressForm(a));
    setAddressOpen(true);
  };

  const handleSaveAddress = async (form: AddressForm) => {
    setAddressError("");
    setAddressSaving(true);
    try {
      if (editingAddressId) {
        const updated = await updateAddress(editingAddressId, form);
        setAddresses((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
        setSelectedAddressId(updated.id);
      } else {
        const created = await createAddress(form);
        setAddresses((prev) => [created, ...prev]);
        setSelectedAddressId(created.id);
      }
      setAddressOpen(false);
      setEditingAddressId(null);
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : "Couldn't save address.");
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm("Delete this address?")) return;
    try {
      await deleteAddress(id);
      const next = addresses.filter((a) => a.id !== id);
      setAddresses(next);
      if (selectedAddressId === id) {
        setSelectedAddressId(
          next.find((a) => a.isDefault)?.id ?? next[0]?.id ?? ""
        );
      }
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Couldn't delete address.");
    }
  };

  const handleApplyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code || discountChecking) return;
    setDiscountError("");
    setDiscountChecking(true);
    try {
      const subtotal = summary?.subtotal ?? cart.subtotal;
      const result = await validateDiscount(code, subtotal, appliedCodes);
      if (result.valid) {
        setAppliedCodes((prev) => [...prev, code]);
        setDiscountInput("");
      } else {
        setDiscountError(result.message || "Invalid discount code.");
      }
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Couldn't apply code.");
    } finally {
      setDiscountChecking(false);
    }
  };

  const handleRemoveAppliedCode = (codeToRemove: string) => {
    setAppliedCodes((prev) => prev.filter((c) => c !== codeToRemove));
    setDiscountError("");
  };

  const finishSuccess = useCallback(
    (placed: PlacedOrder) => {
      localStorage.removeItem("agricola_applied_coupons");
      refreshCart();
      navigate(`/order/${placed.id}`);
    },
    [refreshCart, navigate]
  );

  const startRazorpay = async (placed: PlacedOrder) => {
    const intent = placed.payment;
    const discard = async () => {
      try {
        await abandonOrder(placed.id);
      } catch {
        /* best-effort */
      }
    };

    if (
      !intent ||
      intent.gateway !== "razorpay" ||
      !intent.razorpayOrderId ||
      !intent.key
    ) {
      await discard();
      setPlaceError("Payments are unavailable right now. Please try again shortly.");
      return;
    }

    const ok = await loadRazorpayCheckout();
    if (!ok || !window.Razorpay) {
      await discard();
      setPlaceError("Couldn't open the payment window. Please try again.");
      return;
    }

    const rzp = new window.Razorpay({
      key: intent.key,
      amount: intent.amount,
      currency: intent.currency,
      order_id: intent.razorpayOrderId,
      name: "AgriCola",
      description: `Order ${placed.orderId}`,
      prefill: {
        name: user?.name || "",
        contact: (user?.phone || "").replace("+91", ""),
      },
      theme: { color: "#84b817" },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await verifyPayment(response);
          finishSuccess(placed);
        } catch {
          setPlaceError(
            "Payment couldn't be verified. If money was deducted, your order will confirm shortly or be refunded automatically."
          );
        }
      },
      modal: {
        ondismiss: async () => {
          await discard();
          setPlaceError("Payment was cancelled — your order was not placed. Please try again.");
        },
      },
    });
    rzp.open();
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setPlaceError("Please add a delivery address first.");
      return;
    }
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setEmailError("Enter a valid email — we’ll send your order details here.");
      return;
    }
    if (!selectedPayment || orderItems.length === 0) return;

    setPlaceError("");
    setPlacing(true);
    try {
      const placed = await placeOrder({
        items: orderItems,
        shippingAddressId: selectedAddressId,
        paymentMethod: selectedPayment,
        email: trimmedEmail,
        discountCode: appliedCodes.length > 0 ? appliedCodes.join(",") : undefined,
      });
      if (selectedPayment === "razorpay") {
        await startRazorpay(placed);
      } else {
        finishSuccess(placed);
      }
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Couldn't place the order.");
    } finally {
      setPlacing(false);
    }
  };

  const total = summary?.total ?? cart.subtotal;
  const payLabel = placing
    ? "Processing Order…"
    : selectedPayment === "cod"
    ? "Place Order via Cash on Delivery"
    : `Pay ${rupees(total)} Securely`;

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  // --- Logged out state ---
  if (!isLoggedIn) {
    return (
      <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-8 pb-16">
          <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-12 border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#c9ecc4]/60 flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a1f] mb-2">Sign In to Complete Checkout</h2>
            <p className="text-sm text-[#434936] mb-6 leading-relaxed">
              Log in with your mobile number to access saved delivery addresses and secure instant checkout.
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

  // --- Empty cart state ---
  if (orderItems.length === 0) {
    return (
      <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-8 pb-16">
          <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-12 border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#c9ecc4]/60 flex items-center justify-center text-3xl mx-auto mb-4">
              🌾
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a1f] mb-2">Your Cart is Empty</h2>
            <p className="text-sm text-[#434936] mb-6 leading-relaxed">
              You don't have any items ready for checkout. Explore our GI-tagged superfoods and organic harvests.
            </p>
            <button
              onClick={() => navigate("/products")}
              className="rounded-full bg-[#486800] hover:bg-[#1e3a1f] px-8 py-3.5 text-sm font-bold text-white transition-all shadow-md cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
            <Link to="/cart" className="hover:text-[#486800] transition-colors">
              Cart
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Express Checkout</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-[#486800]">lock</span>
            <span className="text-xs font-bold text-[#434936]">
              256-Bit SSL Encrypted Checkout
            </span>
          </div>
        </section>

        {/* Stepper Progress Indicator (Stitch Design) */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100 mb-8">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto text-center">
            {/* Step 1: Cart */}
            <Link to="/cart" className="flex flex-col items-center gap-1.5 group">
              <div className="w-8 h-8 rounded-full bg-[#c9ecc4] text-[#486800] flex items-center justify-center font-bold text-xs shadow-2xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <span className="text-xs font-bold text-[#486800]">1. Harvest Basket</span>
            </Link>

            {/* Step 2: Delivery & Contact */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-[#486800] text-white flex items-center justify-center font-black text-xs shadow-xs ring-4 ring-[#c9ecc4]/50">
                2
              </div>
              <span className="text-xs font-extrabold text-[#1e3a1f]">2. Delivery &amp; Contact</span>
            </div>

            {/* Step 3: Payment */}
            <div className="flex flex-col items-center gap-1.5 opacity-60">
              <div className="w-8 h-8 rounded-full bg-[#f5f3f0] text-gray-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <span className="text-xs font-medium text-gray-500">3. Verification &amp; Dispatch</span>
            </div>
          </div>
        </section>

        {/* Main 12-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Delivery Address, Shipping, Email & Payment (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Section 1: Delivery Address */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#c9ecc4] text-[#486800] font-black text-sm flex items-center justify-center">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-[#1e3a1f]">
                      Delivery Address
                    </h2>
                    <p className="text-xs text-[#434936]">
                      Select or add where your farm-fresh package should be delivered
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openAddAddress}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#c9ecc4]/60 hover:bg-[#c9ecc4] text-[#486800] text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Add New</span>
                </button>
              </div>

              {/* Saved Addresses List */}
              {addresses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((a) => {
                    const active = selectedAddressId === a.id;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAddressId(a.id)}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                          active
                            ? "border-[#486800] bg-[#f4f8ec] shadow-xs"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-[#fbf9f6]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="address"
                              checked={active}
                              onChange={() => setSelectedAddressId(a.id)}
                              className="accent-[#486800] w-4 h-4"
                            />
                            <span className="font-extrabold text-[#1e3a1f] text-sm">
                              {a.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#eae5dc] text-[#434936] px-2 py-0.5 rounded-md">
                              {a.type}
                            </span>
                            {a.isDefault && (
                              <span className="text-[10px] font-bold bg-[#c9ecc4] text-[#486800] px-2 py-0.5 rounded-md">
                                Default
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-[#434936] leading-relaxed mb-3">
                          {[a.house, a.address, a.locality, a.city, a.state, a.pincode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>

                        <div className="flex items-center justify-between border-t border-gray-100/80 pt-2.5 text-xs text-[#434936]">
                          <span className="font-medium">📞 {a.mobile}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditAddress(a);
                              }}
                              className="font-bold text-[#486800] hover:text-[#1e3a1f] underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAddress(a.id);
                              }}
                              className="font-bold text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#f5f3f0] rounded-2xl p-6 text-center">
                  <p className="text-xs text-[#434936] mb-3">
                    No delivery address found. Please add an address to proceed.
                  </p>
                  <button
                    type="button"
                    onClick={openAddAddress}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_location_alt</span>
                    <span>Add Delivery Address</span>
                  </button>
                </div>
              )}
            </section>

            {/* Section 2: Contact & Notification Details */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#c9ecc4] text-[#486800] font-black text-sm flex items-center justify-center">
                  2
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#1e3a1f]">
                    Contact &amp; Dispatch Updates
                  </h2>
                  <p className="text-xs text-[#434936]">
                    Order invoices, tracking links, and live harvest updates are dispatched here
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 max-w-md">
                <label className="text-xs font-bold text-[#1e3a1f] flex items-center gap-1">
                  <span>Email Address for Invoices &amp; Tracking</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    placeholder="yourname@domain.com"
                    className={`w-full bg-[#f5f3f0] rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-[#1e3a1f] placeholder-gray-400 border focus:outline-none focus:ring-2 focus:ring-[#84b817] ${
                      emailError ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                </div>
                {emailError && <p className="text-[11px] text-red-500 font-bold">{emailError}</p>}
              </div>

              {/* Serviceability & Carrier Guarantee Strip */}
              {selectedAddress && (
                <div className="mt-2 bg-[#f5f3f0] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-200/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#486800] shadow-2xs shrink-0">
                      <span className="material-symbols-outlined text-xl">local_shipping</span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-[#1e3a1f] block">
                        Direct Express Cold-Chain Dispatch
                      </span>
                      <span className="text-[11px] text-[#434936]">
                        Delivering to Pincode <strong className="text-[#1e3a1f]">{selectedAddress.pincode}</strong> ({selectedAddress.city}, {selectedAddress.state})
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#486800] bg-[#c9ecc4] px-3 py-1 rounded-full shrink-0 w-fit">
                    Zero-Breakage Guarantee
                  </span>
                </div>
              )}
            </section>

            {/* Section 3: Payment Method Selection */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#c9ecc4] text-[#486800] font-black text-sm flex items-center justify-center">
                    3
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-[#1e3a1f]">
                      Payment Method
                    </h2>
                    <p className="text-xs text-[#434936]">
                      Choose your preferred payment gateway — all options are 100% secure
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#486800] text-xs font-bold bg-[#c9ecc4]/40 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">shield</span>
                  <span>PCI-DSS Level 1</span>
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {methods.map((method) => {
                  const active = selectedPayment === method.id;
                  const isOnline = method.id === "razorpay";
                  return (
                    <label
                      key={method.id}
                      className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 relative ${
                        !method.enabled
                          ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200"
                          : active
                          ? "border-[#486800] bg-[#f4f8ec] shadow-xs cursor-pointer"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-[#fbf9f6] cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment"
                            disabled={!method.enabled}
                            checked={active}
                            onChange={() => setSelectedPayment(method.id)}
                            className="accent-[#486800] w-4 h-4"
                          />
                          <div>
                            <span className="font-extrabold text-[#1e3a1f] text-sm block">
                              {method.label}
                            </span>
                            <span className="text-[11px] text-[#434936]">
                              {method.description}
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[#486800] text-xl">
                          {isOnline ? "credit_card" : "payments"}
                        </span>
                      </div>

                      {isOnline && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#486800] bg-[#c9ecc4]/70 px-2.5 py-1 rounded-lg w-fit">
                          <span>UPI • Google Pay • Cards • NetBanking</span>
                        </div>
                      )}
                      {!isOnline && (
                        <div className="text-[10px] text-gray-500">
                          Pay cash or UPI upon delivery at doorstep.
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>

              {placeError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-red-500">error</span>
                  <span>{placeError}</span>
                </div>
              )}

              {/* Main Pay / Place Order CTA Button */}
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={placing || !selectedAddressId || !selectedPayment || !email.trim()}
                className="w-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-base font-extrabold py-4 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 mt-2"
              >
                {placing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Your Order…</span>
                  </>
                ) : (
                  <>
                    <span>{payLabel}</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </section>
          </div>

          {/* Right Column: Order Items Summary & Billing Sticky (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-28">
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-lg font-black text-[#1e3a1f]">Harvest Summary</h3>
                <span className="text-xs font-bold text-[#486800] bg-[#c9ecc4] px-2.5 py-0.5 rounded-full">
                  {cart.itemCount} {cart.itemCount === 1 ? "Item" : "Items"}
                </span>
              </div>

              {/* Order Items Preview */}
              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-1">
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1e3a1f] truncate leading-tight">
                        {item.title}
                      </p>
                      <span className="text-[11px] text-[#434936]">
                        Qty: {item.qty} {item.weight ? `• ${item.weight}` : ""}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-[#1e3a1f] shrink-0">
                      ₹{item.lineTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Promo / Coupon Code Section */}
              <div className="bg-[#f5f3f0] rounded-2xl p-3.5 flex flex-col gap-2">
                {appliedCodes.length > 0 && (
                  <div className="space-y-1.5">
                    {appliedCodes.map((code) => (
                      <div key={code} className="flex items-center justify-between bg-[#c9ecc4] text-[#1e3a1f] px-3 py-1.5 rounded-xl">
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className="material-symbols-outlined text-sm text-[#486800]">check_circle</span>
                          <span className="font-mono">{code}</span>
                          <span className="text-[11px] text-[#486800]">Applied</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAppliedCode(code)}
                          className="text-gray-500 hover:text-red-500 text-xs font-bold cursor-pointer"
                          title="Remove Coupon"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(!appliedCodes.length || (allowStacking && appliedCodes.length < 2)) && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleApplyDiscount();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder={appliedCodes.length > 0 ? "Add 2nd coupon (e.g. DIWALI20)" : "Coupon (e.g. AGRIPURE)"}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="flex-1 bg-white px-3 py-2 rounded-xl text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817] uppercase"
                    />
                    <button
                      type="submit"
                      disabled={discountChecking || !discountInput.trim()}
                      className="bg-[#1e3a1f] hover:bg-[#486800] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {discountChecking ? "…" : appliedCodes.length > 0 ? "Stack" : "Apply"}
                    </button>
                  </form>
                )}
                {discountError && <p className="text-[11px] text-red-500 font-bold">{discountError}</p>}
              </div>

              {/* Calculation Breakdown */}
              <div className="flex flex-col gap-2.5 text-xs text-[#434936]">
                <div className="flex justify-between items-center">
                  <span>Cart Subtotal</span>
                  <span className="font-bold text-[#1e3a1f]">
                    {rupees(summary?.subtotal ?? cart.subtotal)}
                  </span>
                </div>

                {!!summary && summary.discount > 0 && (
                  <div className="flex justify-between items-center text-[#486800] font-bold">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">local_offer</span>
                      <span>Promo Discount ({appliedCodes.join(" + ")})</span>
                    </span>
                    <span>- {rupees(summary.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span>Cold-Chain Delivery</span>
                  <span className="font-bold">
                    {!summary ? (
                      <span className="text-gray-800">—</span>
                    ) : summary.charges === 0 ? (
                      <span className="text-[#486800]">FREE</span>
                    ) : (
                      <span className="text-[#1e3a1f]">{rupees(summary.charges)}</span>
                    )}
                  </span>
                </div>

                {summary &&
                  summary.charges > 0 &&
                  freeThreshold != null &&
                  summary.subtotal < freeThreshold && (
                    <p className="text-[11px] text-gray-400">
                      Add {rupees(freeThreshold - summary.subtotal)} more for FREE delivery.
                    </p>
                  )}

                <div className="flex justify-between items-center text-[11px] text-gray-400">
                  <span>Mandatory GST &amp; Krishi Cess</span>
                  <span>Included</span>
                </div>
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
                  {rupees(total)}
                </span>
              </div>

              {/* Direct Farmer Guarantee Footnote */}
              <div className="flex items-center gap-2 p-3 bg-[#c9ecc4]/30 rounded-2xl text-xs text-[#1e3a1f] border border-[#84b817]/20">
                <span className="material-symbols-outlined text-lg text-[#486800] shrink-0">handshake</span>
                <p className="leading-tight text-[11px]">
                  <strong>Direct Farmer Payout:</strong> Guaranteed fair compensation directly deposited to partner farmer cooperative accounts.
                </p>
              </div>
            </div>

            {/* Trust Badges */}
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
                  <span className="font-bold text-[#1e3a1f] block text-xs">Purity Guarantee</span>
                  <span className="text-[11px] text-gray-400">FSSAI Compliant &amp; Quality Certified</span>
                </div>
              </div>
              <Link
                to="/return-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-1.5 -m-1.5 rounded-2xl hover:bg-gray-50 transition-colors group"
                title="Review our 48-Hour Return & Refund Policy"
              >
                <div className="w-8 h-8 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-[#486800] shrink-0 font-bold">
                  <span className="material-symbols-outlined text-base group-hover:rotate-[-45deg] transition-transform">published_with_changes</span>
                </div>
                <div>
                  <span className="font-bold text-[#1e3a1f] block text-xs group-hover:text-[#486800]">Easy Returns &amp; Replacements</span>
                  <span className="text-[11px] text-[#486800] underline">View 48-Hour Return Policy</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Address Modal (Add / Edit) */}
        <AddressModal
          open={addressOpen}
          onClose={() => {
            setAddressOpen(false);
            setEditingAddressId(null);
          }}
          onSave={handleSaveAddress}
          saving={addressSaving}
          error={addressError}
          initial={addressInitial}
          title={editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}
        />
      </main>
      <Footer />
    </div>
  );
}
