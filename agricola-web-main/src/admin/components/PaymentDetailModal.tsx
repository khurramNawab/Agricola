import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { PaymentDetail, PaymentStatusLabel } from "../api/adminApi";

const STATUS_STYLE: Record<PaymentStatusLabel, string> = {
  Success: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-600",
  Pending: "bg-yellow-100 text-yellow-700",
  Refunded: "bg-blue-100 text-blue-700",
  "Partially Refunded": "bg-blue-100 text-blue-700",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900 break-all">{value}</span>
    </div>
  );
}

interface PaymentDetailModalProps {
  payment: PaymentDetail;
  onClose: () => void;
}

export default function PaymentDetailModal({ payment, onClose }: PaymentDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
            <p className="text-sm text-gray-400">{payment.orderId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[payment.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {payment.status}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 p-4">
          <Row label="Amount" value={<span className="text-base">{inr(payment.amount)}</span>} />
          <Row label="Method" value={payment.method} />
          <Row label="Transaction ID" value={payment.transactionId || "—"} />
          <Row label="Date & Time" value={fmtDateTime(payment.date)} />
        </div>

        <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Customer</h4>
        <div className="rounded-xl border border-gray-100 p-4">
          <Row label="Name" value={payment.customer?.name || payment.name} />
          <Row label="Email" value={payment.customer?.email || payment.email || "—"} />
          <Row label="Phone" value={payment.customer?.phone || "—"} />
        </div>

        {payment.items.length > 0 && (
          <>
            <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Items</h4>
            <div className="rounded-xl border border-gray-100 p-4">
              {payment.items.map((it, i) => (
                <div key={i} className="flex justify-between py-1.5 text-sm">
                  <span className="text-gray-700">
                    {it.name}
                    {it.weight ? ` · ${it.weight}` : ""} × {it.quantity}
                  </span>
                  <span className="font-medium text-gray-900">{inr(it.subtotal)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {payment.pricing && (
          <div className="mt-4 rounded-xl border border-gray-100 p-4">
            <Row label="Subtotal" value={inr(payment.pricing.subtotal)} />
            <Row label="Shipping" value={inr(payment.pricing.shipping)} />
            {payment.pricing.tax > 0 && <Row label="Tax" value={inr(payment.pricing.tax)} />}
            {payment.pricing.discount > 0 && (
              <Row label="Discount" value={`- ${inr(payment.pricing.discount)}`} />
            )}
            <div className="mt-1 border-t border-gray-100 pt-2">
              <Row label="Total" value={<span className="text-base">{inr(payment.pricing.total)}</span>} />
            </div>
          </div>
        )}

        {(payment.razorpayOrderId || payment.refundId || payment.failureReason) && (
          <div className="mt-4 rounded-xl border border-gray-100 p-4">
            {payment.razorpayOrderId && <Row label="Razorpay Order" value={payment.razorpayOrderId} />}
            {payment.refundId && <Row label="Refund ID" value={payment.refundId} />}
            {payment.refundAmount != null && <Row label="Refunded" value={inr(payment.refundAmount)} />}
            {payment.failureReason && (
              <Row label="Failure Reason" value={<span className="text-red-600">{payment.failureReason}</span>} />
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg border border-gray-200 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
