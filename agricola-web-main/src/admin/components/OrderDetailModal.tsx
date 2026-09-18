import { useState, useEffect, type ReactNode } from "react";
import {
  updateOrderStatus,
  downloadInvoice,
  emailAdminOrderInvoice,
  downloadLabel,
  cloneAdminOrder,
  toggleOrderShippingWaiver,
  getOrderWarehouseAvailability,
  assignOrderWarehouse,
  ORDER_STATUS_VALUES,
  type OrderDetail,
  type OrderStatusRaw,
  type AdminOrder,
  type OrderWarehouseAvailability,
} from "../api/adminApi";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

const statusBadge = (label: string) => {
  switch (label.toLowerCase()) {
    case "delivered":
      return "bg-[#c9ecc4] text-[#486800]";
    case "shipped":
    case "out_for_delivery":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
    case "refunded":
      return "bg-red-100 text-red-800";
    case "processing":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-right font-bold text-[#1b1c1a] break-all">{value}</span>
    </div>
  );
}

interface OrderDetailModalProps {
  order: OrderDetail;
  onClose: () => void;
  onStatusUpdated: (updated: AdminOrder) => void;
}

export default function OrderDetailModal({ order, onClose, onStatusUpdated }: OrderDetailModalProps) {
  const [status, setStatus] = useState<OrderStatusRaw>(order.statusRaw);
  const [currentLabel, setCurrentLabel] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentMsg, setEmailSentMsg] = useState("");

  // Warehouse Assignment State
  const [availability, setAvailability] = useState<OrderWarehouseAvailability | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<"shiprocket" | "ekart">("shiprocket");
  const [assigningWh, setAssigningWh] = useState(false);
  const [whError, setWhError] = useState("");
  const [whSuccess, setWhSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    getOrderWarehouseAvailability(order.id)
      .then((data) => {
        if (!mounted) return;
        setAvailability(data);
        if (data.assignedWarehouseId) {
          setSelectedWarehouseId(data.assignedWarehouseId);
        } else {
          const firstFulfillable = data.warehouses.find((w) => w.canFulfill);
          if (firstFulfillable) {
            setSelectedWarehouseId(firstFulfillable.id);
          } else if (data.warehouses.length > 0) {
            setSelectedWarehouseId(data.warehouses[0].id);
          }
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error("Failed to load warehouse availability:", err);
          setWhError(err instanceof Error ? err.message : "Failed to load warehouse availability.");
        }
      });
    return () => {
      mounted = false;
    };
  }, [order.id]);

  const handleAssignWarehouse = async () => {
    if (!selectedWarehouseId) return;
    setWhError("");
    setWhSuccess("");
    setAssigningWh(true);
    try {
      const updated = await assignOrderWarehouse(order.id, selectedWarehouseId, selectedProvider);
      onStatusUpdated(updated);
      const providerLabel = selectedProvider === "shiprocket" ? "Shiprocket" : "Ekart";
      setWhSuccess(`Warehouse allocated via ${providerLabel} — shipment booking initiated!`);
      const fresh = await getOrderWarehouseAvailability(order.id);
      setAvailability(fresh);
    } catch (err) {
      console.error("Failed to assign warehouse:", err);
      setWhError(err instanceof Error ? err.message : "Failed to assign warehouse.");
    } finally {
      setAssigningWh(false);
    }
  };

  const runDownload = async (fn: () => Promise<void>) => {
    setError("");
    setInvoiceBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error("Order action download error:", err);
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const addr = order.shippingAddress;
  const sh = order.shipping;
  const hasShipping = Boolean(
    sh && (sh.trackingNumber || sh.carrier || sh.courierName || sh.method || sh.estimatedDelivery || sh.providerShipmentId || sh.provider)
  );

  const handleUpdate = async () => {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const updated = await updateOrderStatus(order.id, status);
      setCurrentLabel(updated.status);
      setSaved(true);
      onStatusUpdated(updated);
    } catch (err) {
      console.error("Order action status update error:", err);
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const handleEmailInvoice = async () => {
    setError("");
    setEmailSentMsg("");
    setEmailSending(true);
    try {
      const res = await emailAdminOrderInvoice(order.id);
      setEmailSentMsg(res.message || "Tax invoice successfully emailed to customer!");
      setTimeout(() => setEmailSentMsg(""), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to email invoice.");
    } finally {
      setEmailSending(false);
    }
  };

  const [cloning, setCloning] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState("");

  const [waiverBusy, setWaiverBusy] = useState(false);

  const handleToggleWaiver = async () => {
    if (!order || waiverBusy) return;
    setWaiverBusy(true);
    try {
      const res = await toggleOrderShippingWaiver(order.id);
      if (res?.pricing) {
        order.pricing = { ...order.pricing, ...res.pricing };
      }
    } catch (err: any) {
      alert(err.message || "Failed to update delivery charge waiver");
    } finally {
      setWaiverBusy(false);
    }
  };

  const handleClone = async () => {
    if (!window.confirm(`Are you sure you want to clone Order #${order.orderId}? This will create a fresh pending order with the same customer and items.`)) {
      return;
    }
    setError("");
    setCloneSuccess("");
    setCloning(true);
    try {
      const cloned = await cloneAdminOrder(order.id);
      setCloneSuccess(`Order cloned successfully as #${cloned.orderId}!`);
      onStatusUpdated(cloned);
    } catch (err) {
      console.error("Order clone error:", err);
      setError(err instanceof Error ? err.message : "Failed to clone order");
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        {/* Top Header */}
        <div className="p-6 bg-[#f5f3f0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-black text-[#1e3a1f]">
                Order #{order.orderId}
              </span>
              <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${statusBadge(currentLabel)}`}>
                {currentLabel}
              </span>
            </div>
            <p className="text-xs text-[#434936] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#486800]">person</span>
              <span>Customer: <strong className="text-[#1b1c1a]">{order.customer?.name || order.email || "Shopper"}</strong></span>
              {addr && <span>• {addr.city}, {addr.state} - PIN {addr.pincode}</span>}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors shadow-2xs self-end sm:self-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Pinned PDF / Document Action Bar (Stitch Design) */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-[#efeeeb] shadow-xs border-b border-gray-200 text-xs">
          <div className="flex items-center gap-1 text-[#1e3a1f] font-bold">
            <span className="material-symbols-outlined text-base text-[#486800]">print</span>
            <span>Fulfillment Documents (Ready to Print):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={invoiceBusy}
              onClick={() => runDownload(() => downloadInvoice(order.id, order.orderId))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c9ecc4] text-[#1e3a1f] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">description</span>
              <span>Invoice A4 (GST)</span>
            </button>
            <button
              type="button"
              disabled={invoiceBusy || emailSending}
              onClick={handleEmailInvoice}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-[#1e3a1f] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 border border-sky-200"
              title="Email official Tax Invoice PDF directly to customer"
            >
              <span className="material-symbols-outlined text-sm text-sky-700">
                {emailSending ? "sync" : "mail"}
              </span>
              <span>{emailSending ? "Sending…" : "Email to Customer"}</span>
            </button>
            <button
              type="button"
              disabled={invoiceBusy}
              onClick={() => runDownload(() => downloadInvoice(order.id, order.orderId, "4x6"))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c9ecc4] text-[#1e3a1f] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">label</span>
              <span>Invoice 4×6 Slip</span>
            </button>
            <button
              type="button"
              disabled={invoiceBusy}
              onClick={() => runDownload(() => downloadLabel(order.id, order.orderId))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#c9ecc4] text-[#1e3a1f] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">qr_code_2</span>
              <span>AWB Courier Label</span>
            </button>
            <button
              type="button"
              disabled={cloning}
              onClick={handleClone}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-[#1e3a1f] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 border border-[#84b817]/40"
              title="Duplicate this order into a new pending order"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">content_copy</span>
              <span>{cloning ? "Cloning…" : "Clone Order"}</span>
            </button>
          </div>
        </div>

        {emailSentMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
              <span>{emailSentMsg}</span>
            </div>
            <button type="button" onClick={() => setEmailSentMsg("")} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
          </div>
        )}

        {/* Global Error Alert Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-red-600">error</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-800 p-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Clone Success Alert Banner */}
        {cloneSuccess && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
              <span>{cloneSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloneSuccess("")}
              className="text-emerald-500 hover:text-emerald-800 p-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 flex flex-col gap-6">
          {/* Warehouse Allocation Section */}
          {availability && (
            <div className="bg-[#f5f3f0] rounded-3xl p-5 border border-gray-200/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#486800] text-xl">warehouse</span>
                  <h4 className="text-sm font-black text-[#1e3a1f]">
                    Warehouse Allocation &amp; Stock Sufficiency
                  </h4>
                </div>
                {availability.awaitingWarehouseAssignment ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Awaiting Assignment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#c9ecc4] text-[#486800] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                    <span className="material-symbols-outlined text-xs">check</span>
                    Assigned
                  </span>
                )}
              </div>

              {/* Warehouse Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availability.warehouses.map((wh) => {
                  const isSelected = selectedWarehouseId === wh.id;
                  const label = `${wh.code} — ${wh.city || ""}, ${wh.state || ""}`.trim();

                  return (
                    <label
                      key={wh.id}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? "border-[#486800] bg-white shadow-xs"
                          : "border-gray-200 bg-white/70 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="warehouseSelect"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedWarehouseId(wh.id);
                              setWhError("");
                              setWhSuccess("");
                              if (!wh.shiprocketPickupNickname) {
                                setSelectedProvider("ekart");
                              }
                            }}
                            className="accent-[#486800] w-4 h-4"
                          />
                          <span className="font-bold text-xs text-[#1e3a1f]">{label}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          wh.canFulfill ? "bg-[#c9ecc4] text-[#486800]" : "bg-red-100 text-red-700"
                        }`}>
                          {wh.canFulfill ? "Fulfillable" : "Low Stock"}
                        </span>
                      </div>

                      {wh.itemsAvailability && wh.itemsAvailability.length > 0 && (
                        <div className="text-[11px] text-[#434936] space-y-0.5 pt-1 border-t border-gray-100">
                          {wh.itemsAvailability.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="truncate max-w-[150px]">{it.name} (Req: {it.required})</span>
                              <span className={it.sufficient ? "text-[#486800] font-bold" : "text-red-500 font-bold"}>
                                {it.available} in stock {it.sufficient ? "✓" : "✗"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Carrier Choice & Allocation CTA */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1e3a1f]">Logistics Carrier:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProvider("shiprocket")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedProvider === "shiprocket"
                          ? "bg-[#1e3a1f] text-white"
                          : "bg-white text-gray-600 border border-gray-200"
                      }`}
                    >
                      Shiprocket
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider("ekart")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedProvider === "ekart"
                          ? "bg-[#1e3a1f] text-white"
                          : "bg-white text-gray-600 border border-gray-200"
                      }`}
                    >
                      Ekart Logistics
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAssignWarehouse}
                  disabled={assigningWh || !selectedWarehouseId}
                  className="px-6 py-2.5 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {assigningWh
                    ? "Allocating Hub…"
                    : availability.assignedWarehouseId
                    ? "Re-allocate Warehouse Hub"
                    : "Allocate Warehouse & Dispatch"}
                </button>
              </div>

              {whError && <p className="text-xs text-red-500 font-bold">{whError}</p>}
              {whSuccess && <p className="text-xs text-[#486800] font-bold">{whSuccess}</p>}
            </div>
          )}

          {/* Status Update Strip */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#1e3a1f] block">Update Order Status</span>
              <span className="text-[11px] text-[#434936]">Triggers customer notification stream</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as OrderStatusRaw);
                  setSaved(false);
                }}
                className="bg-[#f5f3f0] px-3 py-2 rounded-xl text-xs font-bold text-[#1e3a1f] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
              >
                {ORDER_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {cap(s)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 bg-[#1e3a1f] hover:bg-[#486800] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "…" : "Save Status"}
              </button>
            </div>
          </div>
          {saved && <p className="text-xs text-[#486800] font-bold -mt-3">Status updated successfully.</p>}

          {/* Items Table */}
          {order.items.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#434936] mb-3">
                Order Items ({order.items.length})
              </h4>
              <div className="divide-y divide-gray-100 text-xs">
                {order.items.map((it, i) => (
                  <div key={i} className="py-2.5 flex justify-between items-center">
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

          {/* Customer, Shipping Logistics & Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer & Address */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs text-xs space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[#434936] text-[10px]">
                Customer &amp; Address
              </h4>
              <Row label="Name" value={order.customer?.name ?? "—"} />
              <Row label="Email" value={order.customer?.email || order.email || "—"} />
              <Row label="Phone" value={order.customer?.phone || "—"} />
              <Row label="Payment Mode" value={`${order.paymentMethod} · ${order.paymentStatus}`} />
              <Row label="Order Date" value={fmtDateTime(order.createdAt)} />
              {addr && (
                <div className="pt-2 border-t border-gray-100 text-gray-600">
                  <span className="font-bold text-[#1e3a1f] block mb-0.5">Delivery Address:</span>
                  {[addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                </div>
              )}
            </div>

            {/* Logistics & Courier Tracking (Conditional on hasShipping) */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs text-xs space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold uppercase tracking-wider text-[#434936] text-[10px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#486800]">local_shipping</span>
                  Logistics &amp; Tracking
                </h4>
                {hasShipping ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#c9ecc4] text-[#486800] text-[10px] font-bold">
                    {sh.courierName || sh.carrier || (sh.provider === "ekart" ? "Ekart" : "Shiprocket")}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    Unbooked
                  </span>
                )}
              </div>

              {hasShipping ? (
                <>
                  <Row label="Carrier" value={sh.courierName || sh.carrier || (sh.provider === "ekart" ? "Ekart Logistics" : "Shiprocket")} />
                  {sh.trackingNumber ? (
                    <Row
                      label="AWB Tracking #"
                      value={
                        sh.trackingUrl ? (
                          <a
                            href={sh.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#486800] underline font-bold hover:text-[#1e3a1f] inline-flex items-center gap-0.5"
                          >
                            {sh.trackingNumber}
                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                          </a>
                        ) : (
                          <span className="font-mono font-bold">{sh.trackingNumber}</span>
                        )
                      }
                    />
                  ) : (
                    <Row label="AWB Tracking #" value="Pending Generation" />
                  )}
                  {(sh.providerShipmentId || sh.ekartShipmentId) && (
                    <Row label="Shipment ID" value={sh.providerShipmentId || sh.ekartShipmentId || "—"} />
                  )}
                  {sh.estimatedDelivery && (
                    <Row label="Est. Delivery" value={fmtDateTime(sh.estimatedDelivery)} />
                  )}
                  {sh.shippedAt && (
                    <Row label="Shipped At" value={fmtDateTime(sh.shippedAt)} />
                  )}
                </>
              ) : (
                <div className="py-4 text-center text-gray-400 italic text-[11px]">
                  No courier booked yet. Allocate a warehouse above to generate an AWB.
                </div>
              )}
            </div>

            {/* Pricing Financial Summary */}
            {order.pricing && (
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs text-xs space-y-1.5">
                <h4 className="font-bold uppercase tracking-wider text-[#434936] text-[10px]">
                  Financial Breakdown
                </h4>
                <Row label="Items Subtotal" value={inr(order.pricing.subtotal)} />
                <Row label="Cold-Chain Delivery" value={inr(order.pricing.shipping)} />
                {/* Admin Delivery Charge Waiver Control */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1e3a1f] block text-[11px]">Delivery Charge Waiver:</span>
                    <span className="text-[10px] text-gray-500">
                      {order.pricing.shippingWaived ? "Waived (Invoice displays Free)" : "Normal charge applied"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={waiverBusy}
                    onClick={handleToggleWaiver}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 ${
                      order.pricing.shippingWaived
                        ? "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                        : "bg-[#eaf3db] text-[#486800] hover:bg-[#c9ecc4] border border-[#84b817]/40"
                    }`}
                  >
                    {waiverBusy
                      ? "Updating…"
                      : order.pricing.shippingWaived
                      ? "Restore Fee"
                      : "Waive Delivery Fee"}
                  </button>
                </div>

                {order.pricing.tax > 0 && <Row label="GST & Taxes" value={inr(order.pricing.tax)} />}
                {order.pricing.discount > 0 && (
                  <Row label="Discount" value={`- ${inr(order.pricing.discount)}`} />
                )}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center text-sm font-black text-[#1e3a1f]">
                    <span>Total Amount</span>
                    <span>{inr(order.pricing.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
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
