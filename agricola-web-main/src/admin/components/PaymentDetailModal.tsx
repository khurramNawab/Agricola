import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { PaymentDetail, PaymentStatusLabel } from "../api/adminApi";

const STATUS_STYLE: Record<PaymentStatusLabel, string> = {
  Success: "bg-[#c9ecc4] text-[#486800]",
  Failed: "bg-red-100 text-red-700",
  Pending: "bg-yellow-100 text-yellow-800",
  Refunded: "bg-blue-100 text-blue-800",
  "Partially Refunded": "bg-blue-100 text-blue-800",
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
    <div className="flex justify-between items-center gap-4 py-1.5 text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-right font-bold text-[#1b1c1a] break-all">{value}</span>
    </div>
  );
}

interface PaymentDetailModalProps {
  payment: PaymentDetail;
  onClose: () => void;
}

export default function PaymentDetailModal({ payment, onClose }: PaymentDetailModalProps) {
  const items = payment.items || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="relative flex flex-col w-full max-w-lg max-h-[92vh] rounded-3xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        {/* Modal Header */}
        <div className="p-6 bg-[#f5f3f0] flex items-center justify-between border-b border-gray-200">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#486800]">
              Reconciliation Log
            </span>
            <h3 className="text-lg font-black text-[#1e3a1f]">
              Transaction Details
            </h3>
            <p className="text-xs font-mono text-gray-500">{payment.orderId}</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                STATUS_STYLE[payment.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {payment.status}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 flex flex-col gap-4 text-xs">
          {/* Main Transaction Card */}
          <div className="rounded-2xl bg-[#f5f3f0] p-4 border border-gray-200/80 space-y-1.5">
            <Row label="Gross Amount" value={<span className="text-base font-black text-[#1e3a1f]">{inr(payment.amount)}</span>} />
            <Row label="Payment Gateway / Method" value={<span className="uppercase text-[11px] font-extrabold">{payment.method}</span>} />
            <Row label="Transaction Reference" value={<span className="font-mono text-[11px] text-[#486800]">{payment.transactionId || "—"}</span>} />
            <Row label="Timestamp" value={fmtDateTime(payment.date)} />
          </div>

          {/* Customer Card */}
          <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-2xs space-y-1.5">
            <span className="font-bold text-[#434936] text-[10px] uppercase tracking-wider block mb-1">
              Customer Details
            </span>
            <Row label="Name" value={payment.customer?.name || payment.name} />
            <Row label="Email" value={payment.customer?.email || payment.email || "—"} />
            <Row label="Phone" value={payment.customer?.phone || "—"} />
          </div>

          {/* Items Preview */}
          {items.length > 0 && (
            <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-2xs">
              <span className="font-bold text-[#434936] text-[10px] uppercase tracking-wider block mb-2">
                Order Items ({items.length})
              </span>
              <div className="divide-y divide-gray-100">
                {items.map((it, i) => (
                  <div key={i} className="flex justify-between py-2 items-center">
                    <div>
                      <span className="font-bold text-[#1e3a1f]">{it.name}</span>
                      <span className="text-gray-400 block text-[11px]">
                        {it.weight ? `Pack: ${it.weight} • ` : ""}Qty: {it.quantity}
                      </span>
                    </div>
                    <span className="font-black text-[#1e3a1f]">{inr(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Summary */}
          {payment.pricing && (
            <div className="rounded-2xl bg-white p-4 border border-gray-100 shadow-2xs space-y-1.5">
              <span className="font-bold text-[#434936] text-[10px] uppercase tracking-wider block mb-1">
                Settlement Breakdown
              </span>
              <Row label="Subtotal" value={inr(payment.pricing.subtotal)} />
              <Row label="Shipping Charge" value={inr(payment.pricing.shipping)} />
              {payment.pricing.tax > 0 && <Row label="GST & Taxes" value={inr(payment.pricing.tax)} />}
              {payment.pricing.discount > 0 && (
                <Row label="Promo Discount" value={`- ${inr(payment.pricing.discount)}`} />
              )}
              <div className="pt-2 border-t border-gray-100">
                <Row label="Total Settled" value={<span className="text-sm font-black text-[#1e3a1f]">{inr(payment.pricing.total)}</span>} />
              </div>
            </div>
          )}

          {/* Refund / Failure Reason */}
          {(payment.razorpayOrderId || payment.refundId || payment.failureReason) && (
            <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200/80 space-y-1.5 text-xs">
              <span className="font-bold text-amber-900 text-[10px] uppercase tracking-wider block mb-1">
                Gateway Logs &amp; Audit Trail
              </span>
              {payment.razorpayOrderId && <Row label="Razorpay Order ID" value={<span className="font-mono text-[11px]">{payment.razorpayOrderId}</span>} />}
              {payment.refundId && <Row label="Refund Reference" value={<span className="font-mono text-[11px]">{payment.refundId}</span>} />}
              {payment.refundAmount != null && <Row label="Refunded Amount" value={inr(payment.refundAmount)} />}
              {payment.failureReason && (
                <Row label="Failure Reason" value={<span className="text-red-600 font-bold">{payment.failureReason}</span>} />
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 flex justify-end border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-[#1e3a1f] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
