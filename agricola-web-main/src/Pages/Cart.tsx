import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Footer from "../components/layout/Footer";
import PincodeCheck from "../components/delivery/PincodeCheck";
import { useStorefront } from "../storefront/StorefrontContext";
import { getCheckoutConfig, type DeliveryQuote } from "../lib/checkout";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=400&q=70";

export default function Cart() {
  const navigate = useNavigate();
  const { isLoggedIn, cart, refreshCart, updateItem, removeItem, openAuth } =
    useStorefront();
  const [busy, setBusy] = useState(false);
  const [freeThreshold, setFreeThreshold] = useState<number | null>(null);
  const [delivery, setDelivery] = useState<DeliveryQuote | null>(null);

  // Checkout is gated on a confirmed delivery answer so nobody fills a cart only to be
  // refused at order creation. `unverified` (we couldn't reach a carrier) passes — our
  // own outage must not cost a sale.
  const canCheckout = !!delivery && (delivery.serviceable || !!delivery.unverified);

  const handleDeliveryResult = useCallback((result: DeliveryQuote | null) => {
    setDelivery(result);
  }, []);

  // Pull the freshest cart whenever the page is opened by a logged-in user.
  useEffect(() => {
    if (isLoggedIn) refreshCart();
  }, [isLoggedIn, refreshCart]);

  // Free-shipping threshold (from backend, so it's never hardcoded here).
  useEffect(() => {
    getCheckoutConfig()
      .then((c) => setFreeThreshold(c.freeShippingThreshold))
      .catch(() => {});
  }, []);

  // Wrap a cart mutation so the row controls disable while it's in flight.
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
    // Backend removes a line when qty hits 0; mirror that for the minus button.
    if (qty < 1) return run(() => removeItem(id));
    return run(() => updateItem(id, qty));
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1">
        {/* Breadcrumb */}
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
              Homepage <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-gray-800">Your Cart</span>
            </span>
          </div>
        </div>

        <div className="container mx-auto max-w-5xl px-4 py-10">
          <h1 className="mb-10 text-center font-serif text-3xl text-gray-900 sm:text-4xl md:text-5xl">
            Your Cart
          </h1>

          {/* Logged-out visitors must sign in to have a cart. */}
          {!isLoggedIn ? (
            <div className="py-16 text-center">
              <p className="mb-6 text-gray-500">
                Please log in to view your cart.
              </p>
              <button
                onClick={() => openAuth()}
                className="rounded-lg bg-[#84b817] px-8 py-3 font-medium text-white transition-colors hover:bg-[#6d9913]"
              >
                Login / Signup
              </button>
            </div>
          ) : cart.items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="mb-6 text-gray-500">Your cart is empty.</p>
              <button
                onClick={() => navigate("/products")}
                className="rounded-lg bg-gray-900 px-8 py-3 font-medium text-white transition-colors hover:bg-gray-800"
              >
                Browse Products
              </button>
            </div>
          ) : (
            <>
              {/* Column headers (desktop only) */}
              <div className="mb-4 hidden grid-cols-[2.5fr_1fr_1fr_1fr_auto] items-center gap-4 px-6 text-sm text-gray-500 md:grid">
                <span>Products</span>
                <span className="text-center">Price</span>
                <span className="text-center">Quantity</span>
                <span className="text-center">Total</span>
                <span className="w-6" />
              </div>

              <div className="space-y-5">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="relative flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 md:grid md:grid-cols-[2.5fr_1fr_1fr_1fr_auto] md:items-center md:gap-4 md:px-6 md:py-5"
                  >
                    <div className="flex items-center gap-4 pr-8 md:pr-0">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
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
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {item.title}
                        </h3>
                        {item.weight && (
                          <p className="text-sm text-gray-500">{item.weight}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:block md:text-center">
                      <span className="text-sm text-gray-500 md:hidden">
                        Price
                      </span>
                      <span className="text-lg text-gray-900">
                        &#8377;{item.price}
                      </span>
                    </div>

                    <div className="flex items-center justify-between md:justify-center">
                      <span className="text-sm text-gray-500 md:hidden">
                        Quantity
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => changeQty(item.id, item.qty + 1)}
                          disabled={busy}
                          aria-label="Increase quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                        >
                          +
                        </button>
                        <span className="w-4 text-center text-gray-900">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => changeQty(item.id, item.qty - 1)}
                          disabled={busy}
                          aria-label="Decrease quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                        >
                          −
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:block md:text-center">
                      <span className="text-sm text-gray-500 md:hidden">
                        Total
                      </span>
                      <span className="text-lg text-gray-900">
                        &#8377;{item.lineTotal}
                      </span>
                    </div>

                    <button
                      onClick={() => run(() => removeItem(item.id))}
                      disabled={busy}
                      aria-label={`Remove ${item.title}`}
                      className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center text-red-500 hover:text-red-600 disabled:opacity-50 md:static md:right-auto md:top-auto"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-10 flex flex-col items-end">
                <div className="flex w-full max-w-sm items-center justify-between">
                  <span className="text-2xl text-gray-900">Subtotal</span>
                  <span className="text-2xl text-gray-900">
                    &#8377;{cart.subtotal}
                  </span>
                </div>
                {/* Delivery total comes from the quote once a pincode is checked; until
                    then, keep the free-delivery nudge. */}
                {delivery?.delivery ? (
                  <div className="mt-3 flex w-full max-w-sm items-center justify-between text-sm">
                    <span className="text-gray-500">Delivery</span>
                    <span className="font-medium text-gray-900">
                      {delivery.delivery.free
                        ? "FREE"
                        : `₹${delivery.delivery.charge.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                ) : freeThreshold != null && cart.subtotal >= freeThreshold ? (
                  <p className="mt-3 text-sm font-medium text-green-600">
                    🎉 Your order qualifies for FREE delivery.
                  </p>
                ) : freeThreshold != null ? (
                  <p className="mt-3 text-sm text-gray-500">
                    Add ₹{(freeThreshold - cart.subtotal).toLocaleString("en-IN")} more
                    for <span className="font-medium text-gray-700">free delivery</span>.
                  </p>
                ) : null}

                <PincodeCheck
                  variant="cart"
                  items={cart.items.map((i) => ({
                    productId: i.productId,
                    qty: i.qty,
                    weight: i.weight,
                  }))}
                  onResult={handleDeliveryResult}
                  className="mt-4 w-full max-w-sm"
                />

                <button
                  onClick={() => navigate("/checkout")}
                  disabled={!canCheckout}
                  className="mt-4 w-full max-w-sm rounded-lg bg-gray-900 py-3.5 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proceed to Checkout
                </button>
                {!canCheckout && (
                  <p className="mt-2 w-full max-w-sm text-xs text-gray-500">
                    {delivery && !delivery.serviceable
                      ? "We don’t deliver to that pincode yet — try another one to continue."
                      : "Check delivery to your pincode to continue."}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
