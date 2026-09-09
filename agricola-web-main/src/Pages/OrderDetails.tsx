import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import Footer from "../components/layout/Footer";
import { useStorefront } from "../storefront/StorefrontContext";
import { getOrder, type OrderDetail } from "../lib/checkout";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=200&q=70";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1">
        <div className="border-b border-gray-100">
          <div className="container mx-auto flex items-center gap-4 px-4 py-4 text-sm">
            <button
              onClick={() => navigate("/products")}
              aria-label="Continue shopping"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-bold text-green-600">
              Agri<span className="text-gray-700">Cola</span>
            </span>
            <span className="ml-6 flex items-center gap-2 text-gray-400">
              Homepage <ChevronRight className="h-3 w-3" />
              <span className="text-gray-800">Order Details</span>
            </span>
          </div>
        </div>
        <div className="container mx-auto max-w-3xl px-4 py-10">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

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
      <Shell>
        <div className="py-16 text-center">
          <p className="mb-6 text-gray-500">Please log in to view this order.</p>
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

  if (loading) {
    return (
      <Shell>
        <div className="py-16 text-center text-gray-500">Loading order…</div>
      </Shell>
    );
  }

  if (error || !order) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <p className="mb-6 text-gray-500">{error || "Order not found."}</p>
          <button
            onClick={() => navigate("/track")}
            className="rounded-lg bg-gray-900 px-8 py-3 font-medium text-white transition-colors hover:bg-gray-800"
          >
            Track an Order
          </button>
        </div>
      </Shell>
    );
  }

  const paid = order.paymentStatus === "paid";
  const cod = order.paymentMethod === "cod";
  const paymentNote = paid
    ? "Payment received."
    : cod
    ? "Pay cash on delivery."
    : "Payment is pending — you can complete it from Order Tracking.";

  return (
    <Shell>
      {/* Header */}
      <div className="mb-8 text-center">
        {paid || cod ? (
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-[#84b817]" />
        ) : (
          <Clock className="mx-auto mb-4 h-16 w-16 text-amber-500" />
        )}
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Order placed!</h1>
        <p className="text-gray-500">
          Order <span className="font-semibold">{order.orderId}</span> · {paymentNote}
        </p>
      </div>

      {/* Status + payment */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm">
          <p className="mb-1 text-gray-500">Order Status</p>
          <p className="font-semibold capitalize text-gray-900">{order.status}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm">
          <p className="mb-1 text-gray-500">Payment</p>
          <p className="font-semibold capitalize text-gray-900">
            {order.paymentMethod} · {order.paymentStatus}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-gray-900">Items</h2>
        <div className="space-y-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={item.image || FALLBACK_IMAGE}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-gray-500">
                  {item.weight ? `${item.weight} · ` : ""}Qty {item.qty} ·{" "}
                  {rupees(item.price)}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {rupees(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery address */}
      {order.address && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 text-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Delivery Address</h2>
          <p className="font-medium text-gray-800">{order.address.name}</p>
          <p className="text-gray-600">
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
            <p className="mt-1 text-gray-500">Mobile: {order.address.phone}</p>
          )}
        </div>
      )}

      {/* Pricing */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 text-sm">
        <div className="flex justify-between py-1 text-gray-600">
          <span>Subtotal</span>
          <span>{rupees(order.pricing.subtotal)}</span>
        </div>
        {order.pricing.discount > 0 && (
          <div className="flex justify-between py-1 text-gray-600">
            <span>Discount</span>
            <span>- {rupees(order.pricing.discount)}</span>
          </div>
        )}
        <div className="flex justify-between py-1 text-gray-600">
          <span>Delivery charges</span>
          <span>{rupees(order.pricing.charges)}</span>
        </div>
        <hr className="my-3 border-gray-100" />
        <div className="flex justify-between text-base font-bold text-gray-900">
          <span>Total</span>
          <span>{rupees(order.pricing.total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate("/track")}
          className="flex-1 rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913]"
        >
          Track Order
        </button>
        <button
          onClick={() => navigate("/products")}
          className="flex-1 rounded-lg border border-gray-200 bg-white py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Continue Shopping
        </button>
      </div>
    </Shell>
  );
}
