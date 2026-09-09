import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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

// Address → editable form (drops server-only fields).
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

// Page chrome (breadcrumb + footer). Module-level so it keeps a stable identity —
// nesting it would remount the subtree each render and drop input focus.
function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1">
        <div className="border-b border-gray-100">
          <div className="container mx-auto flex items-center gap-4 px-4 py-4 text-sm">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-bold text-green-600">
              Agri<span className="text-gray-700">Cola</span>
            </span>
            <span className="ml-6 flex items-center gap-2 text-gray-400">
              Cart <ChevronRight className="h-3 w-3" />
              <span className="text-gray-800">Checkout</span>
            </span>
          </div>
        </div>
        <div className="container mx-auto max-w-6xl px-4 py-10">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
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
  const [appliedCode, setAppliedCode] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [discountChecking, setDiscountChecking] = useState(false);

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
        discountCode: appliedCode || undefined,
      },
      controller.signal
    )
      .then(setSummary)
      .catch(() => {});
    return () => controller.abort();
    // itemsKey captures the cart contents for the dependency check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, itemsKey, selectedAddressId, appliedCode]);

  // Pre-fill the email from the account once it's known (never clobber typing).
  useEffect(() => {
    if (user?.email) setEmail((cur) => cur || user.email || "");
  }, [user]);

  // Free-shipping threshold (from backend, so it's never hardcoded here).
  useEffect(() => {
    getCheckoutConfig()
      .then((c) => setFreeThreshold(c.freeShippingThreshold))
      .catch(() => {});
  }, []);

  const openAddAddress = () => {
    setAddressError("");
    setEditingAddressId(null);
    // Seed name/mobile from the signed-in user to save re-typing.
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
    const code = discountInput.trim();
    if (!code || discountChecking) return;
    setDiscountError("");
    setDiscountChecking(true);
    try {
      const subtotal = summary?.subtotal ?? cart.subtotal;
      const result = await validateDiscount(code, subtotal);
      if (result.valid) {
        setAppliedCode(code);
      } else {
        setAppliedCode("");
        setDiscountError(result.message || "Invalid discount code.");
      }
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Couldn't apply code.");
    } finally {
      setDiscountChecking(false);
    }
  };

  const finishSuccess = useCallback(
    (placed: PlacedOrder) => {
      refreshCart(); // the backend already cleared the cart server-side
      navigate(`/order/${placed.id}`); // show the persistent order details page
    },
    [refreshCart, navigate]
  );

  // Hand the Razorpay intent to Razorpay Checkout, then verify on success.
  // The order is created as PENDING (no stock reserved, cart not cleared); it only
  // becomes a real order after a verified payment. So on cancel/failure we discard
  // the pending order and never show "order placed".
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
          finishSuccess(placed); // only a verified payment places the order
        } catch {
          // Payment may have gone through but verification failed — do NOT discard
          // (the webhook will confirm it); just surface the state.
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
        discountCode: appliedCode || undefined,
      });
      if (selectedPayment === "razorpay") {
        await startRazorpay(placed);
      } else {
        finishSuccess(placed); // COD: order placed, nothing else to do
      }
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Couldn't place the order.");
    } finally {
      setPlacing(false);
    }
  };

  const total = summary?.total ?? cart.subtotal;
  const payLabel = placing
    ? "Processing…"
    : selectedPayment === "cod"
    ? "Place Order"
    : `Pay ${rupees(total)}`;

  // --- Logged out ------------------------------------------------------------
  if (!isLoggedIn) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <p className="mb-6 text-gray-500">Please log in to check out.</p>
          <button
            onClick={() => openAuth()}
            className="rounded-lg bg-[#84b817] px-8 py-3 font-medium text-white transition-colors hover:bg-[#6d9913]"
          >
            Login / Signup
          </button>
        </div>
      </Shell>
    );
  }

  // --- Empty cart ------------------------------------------------------------
  if (orderItems.length === 0) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <p className="mb-6 text-gray-500">Your cart is empty.</p>
          <button
            onClick={() => navigate("/products")}
            className="rounded-lg bg-gray-900 px-8 py-3 font-medium text-white transition-colors hover:bg-gray-800"
          >
            Browse Products
          </button>
        </div>
      </Shell>
    );
  }

  // --- Checkout form ---------------------------------------------------------
  return (
    <Shell>
      <h1 className="mb-10 text-center font-serif text-3xl text-gray-900 sm:text-4xl md:text-5xl">
        Checkout
      </h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Left column */}
        <div>
          <h2 className="mb-3 font-medium text-gray-800">Delivery Address</h2>

          {addresses.length > 0 && (
            <div className="mb-4 space-y-3">
              {addresses.map((a) => {
                const active = selectedAddressId === a.id;
                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border p-4 text-sm ${
                      active
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex gap-3">
                      <label className="flex flex-1 cursor-pointer gap-3">
                        <input
                          type="radio"
                          name="address"
                          checked={active}
                          onChange={() => setSelectedAddressId(a.id)}
                          className="mt-1 h-4 w-4 accent-green-600"
                        />
                        <span className="text-gray-700">
                          <span className="font-semibold">
                            {a.name} · {a.type}
                          </span>
                          {a.isDefault && (
                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              Default
                            </span>
                          )}
                          <br />
                          {[a.house, a.address, a.locality, a.city, a.state, a.pincode]
                            .filter(Boolean)
                            .join(", ")}
                          <br />
                          <span className="text-gray-500">Mobile: {a.mobile}</span>
                        </span>
                      </label>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditAddress(a)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(a.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={openAddAddress}
            className="mb-8 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#84b817] py-3.5 font-medium text-[#6d9913] transition-colors hover:bg-green-50"
          >
            Add New Address <Plus className="h-5 w-5" />
          </button>

          <div className="mb-8">
            <h2 className="mb-1 font-medium text-gray-800">Email Address</h2>
            <p className="mb-3 text-xs text-gray-500">
              We’ll send your order confirmation and delivery updates to this email.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              placeholder="you@example.com"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#84b817] ${
                emailError ? "border-red-400" : "border-gray-200"
              }`}
            />
            {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
          </div>

          <h2 className="mb-1 font-medium text-gray-800">Payment Method</h2>
          <p className="mb-4 text-xs text-gray-500">
            All transactions are secure and encrypted.
          </p>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            {methods.map((method, i) => {
              const active = selectedPayment === method.id;
              return (
                <label
                  key={method.id}
                  className={`flex items-center gap-3 px-4 py-4 ${
                    method.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  } ${active ? "border border-green-500 bg-green-50" : i > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    disabled={!method.enabled}
                    checked={active}
                    onChange={() => setSelectedPayment(method.id)}
                    className="h-4 w-4 accent-green-600"
                  />
                  <span className="flex-1 text-sm text-gray-700">
                    {method.label}
                    <span className="block text-xs text-gray-400">
                      {method.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Billing address same as delivery address.
          </p>

          {placeError && (
            <p className="mt-4 text-sm text-red-500">{placeError}</p>
          )}

          <button
            onClick={handlePlaceOrder}
            disabled={placing || !selectedAddressId || !selectedPayment || !email.trim()}
            className="mt-6 w-full rounded-lg bg-[#84b817] py-3.5 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {payLabel}
          </button>
        </div>

        {/* Right column: totals */}
        <div>
          <div className="rounded-2xl bg-green-50 p-6">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Cart Total</h2>

            <div className="mb-3 flex gap-2">
              <input
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="Discount Code"
                className="w-full rounded-full bg-white px-5 py-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleApplyDiscount}
                disabled={discountChecking || !discountInput.trim()}
                className="rounded-full bg-gray-900 px-5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {discountChecking ? "…" : "Apply"}
              </button>
            </div>
            {discountError && (
              <p className="mb-3 text-xs text-red-500">{discountError}</p>
            )}
            {appliedCode && (
              <p className="mb-3 text-xs text-green-700">
                Code <span className="font-semibold">{appliedCode}</span> applied.{" "}
                <button
                  onClick={() => {
                    setAppliedCode("");
                    setDiscountInput("");
                  }}
                  className="underline"
                >
                  Remove
                </button>
              </p>
            )}

            <div className="space-y-3 text-gray-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-gray-800">
                  {rupees(summary?.subtotal ?? cart.subtotal)}
                </span>
              </div>
              {!!summary && summary.discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>- {rupees(summary.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery</span>
                <span className="font-medium">
                  {!summary ? (
                    <span className="text-gray-800">—</span>
                  ) : summary.charges === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    <span className="text-gray-800">{rupees(summary.charges)}</span>
                  )}
                </span>
              </div>
              {summary &&
                summary.charges > 0 &&
                freeThreshold != null &&
                summary.subtotal < freeThreshold && (
                  <p className="text-xs text-gray-400">
                    Add {rupees(freeThreshold - summary.subtotal)} more for free delivery.
                  </p>
                )}
            </div>
            <hr className="my-5 border-gray-200" />
            <div className="flex justify-between text-lg">
              <span className="font-medium text-gray-900">Total</span>
              <span className="font-bold text-gray-900">{rupees(total)}</span>
            </div>
          </div>
        </div>
      </div>

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
        title={editingAddressId ? "Edit Address" : "Add Address"}
      />
    </Shell>
  );
}
