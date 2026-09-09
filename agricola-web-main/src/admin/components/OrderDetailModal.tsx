import { useState, useEffect, type ReactNode } from "react";
import { X, Building2, AlertTriangle, CheckCircle, PackageCheck, Truck } from "lucide-react";
import {
  updateOrderStatus,
  downloadInvoice,
  downloadLabel,
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
  switch (label) {
    case "Delivered":
      return "bg-green-100 text-green-700";
    case "Shipped":
      return "bg-blue-100 text-blue-700";
    case "Cancelled":
    case "Refunded":
      return "bg-red-100 text-red-600";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900 break-all">{value}</span>
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
        if (mounted) setWhError(err instanceof Error ? err.message : "Failed to load warehouse availability.");
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
      setWhSuccess(`Warehouse assigned via ${providerLabel} — shipment booking initiated!`);
      const fresh = await getOrderWarehouseAvailability(order.id);
      setAvailability(fresh);
    } catch (err) {
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
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const addr = order.shippingAddress;
  const sh = order.shipping;
  const hasShipping = sh.trackingNumber || sh.carrier || sh.method || sh.estimatedDelivery;

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
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const assignedWh = availability?.assignedWarehouseId
    ? availability.warehouses.find((w) => w.id === availability.assignedWarehouseId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
            <p className="text-sm text-gray-400">{order.orderId}</p>
            {assignedWh && (
              <p className="mt-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                Fulfilling from: {assignedWh.code} — {assignedWh.city}, {assignedWh.state}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge(currentLabel)}`}>
              {currentLabel}
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Status update */}
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">Update Status</p>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OrderStatusRaw);
                setSaved(false);
              }}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ORDER_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="rounded-lg bg-[#84b817] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d9913] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Update"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          {saved && <p className="mt-2 text-xs text-green-600">Status updated.</p>}
        </div>

        {/* Multi-Warehouse Fulfillment Banner & Selector */}
        {availability && (
          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-gray-700" />
                <h4 className="text-sm font-semibold text-gray-800">Fulfillment Warehouse</h4>
              </div>
              {availability.awaitingWarehouseAssignment ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <AlertTriangle size={12} />
                  Awaiting Assignment
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle size={12} />
                  Assigned
                </span>
              )}
            </div>

            {availability.awaitingWarehouseAssignment && (
              <p className="mb-3 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Shipment booking is paused until a fulfillment warehouse is assigned to this order.
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Select Dispatch Warehouse
                </label>
                <select
                  id="dispatch-warehouse-select"
                  value={selectedWarehouseId}
                  onChange={(e) => {
                    const newWhId = e.target.value;
                    setSelectedWarehouseId(newWhId);
                    setWhError("");
                    setWhSuccess("");
                    const chosen = availability.warehouses.find((w) => w.id === newWhId);
                    if (chosen && !chosen.shiprocketPickupNickname) {
                      setSelectedProvider("ekart");
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#84b817] focus:outline-none"
                >
                  <option value="">Select Warehouse…</option>
                  {availability.warehouses.map((wh) => {
                    /* STRICT Labeling format: `code — city, state` */
                    const whLabel = `${wh.code} — ${wh.city || ""}, ${wh.state || ""}`.trim();
                    const stockTag = wh.canFulfill ? "[Fully Stocked]" : "[Insufficient Stock]";
                    return (
                      <option key={wh.id} value={wh.id}>
                        {whLabel} {stockTag}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedWarehouseId && (
                (() => {
                  const selWh = availability.warehouses.find((w) => w.id === selectedWarehouseId);
                  if (!selWh) return null;
                  return (
                    <div className="rounded-lg bg-white p-3 border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-800">
                          {selWh.code} — {selWh.city}, {selWh.state}
                        </span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded ${
                            selWh.canFulfill
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {selWh.canFulfill ? "Fulfillable" : "Insufficient Stock"}
                        </span>
                      </div>

                      {selWh.itemsAvailability && selWh.itemsAvailability.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-gray-50 text-xs">
                          {selWh.itemsAvailability.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-gray-600">
                              <span>{it.name} (Req: {it.required})</span>
                              <span className={it.sufficient ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {it.available} in stock {it.sufficient ? "✓" : "✗"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Shipping Carrier Selection */}
              {(() => {
                const selWh = availability.warehouses.find((w) => w.id === selectedWarehouseId);
                const hasShiprocket = Boolean(selWh?.shiprocketPickupNickname);

                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-600">
                        Shipping Carrier
                      </label>
                      {selWh && !hasShiprocket && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                          Ekart Only
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!hasShiprocket}
                        onClick={() => {
                          setSelectedProvider("shiprocket");
                          setWhError("");
                          setWhSuccess("");
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                          !hasShiprocket
                            ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                            : selectedProvider === "shiprocket"
                            ? "border-[#84b817] bg-[#84b817]/10 text-[#5a7f0f] shadow-sm"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                        title={!hasShiprocket ? "Not registered in Shiprocket" : undefined}
                      >
                        <Truck size={13} />
                        Shiprocket {!hasShiprocket && <span className="text-[10px] text-gray-400">(N/A)</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProvider("ekart");
                          setWhError("");
                          setWhSuccess("");
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                          selectedProvider === "ekart"
                            ? "border-[#84b817] bg-[#84b817]/10 text-[#5a7f0f] shadow-sm"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <Truck size={13} />
                        Ekart {selWh?.ekartPickupAlias ? `(${selWh.ekartPickupAlias})` : ""}
                      </button>
                    </div>

                    {selWh && !hasShiprocket && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        {selWh.code} is registered only in Ekart (Alias: <strong>{selWh.ekartPickupAlias || "Default"}</strong>).
                      </p>
                    )}
                  </div>
                );
              })()}

              <button
                onClick={handleAssignWarehouse}
                disabled={assigningWh || !selectedWarehouseId}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#84b817] py-2 text-sm font-medium text-white hover:bg-[#6d9913] disabled:opacity-50 transition-colors"
              >
                <PackageCheck size={16} />
                {assigningWh
                  ? "Assigning Warehouse…"
                  : availability.assignedWarehouseId
                  ? "Re-assign Warehouse"
                  : "Assign Warehouse & Book Shipment"}
              </button>

              {whError && <p className="text-xs text-red-500">{whError}</p>}
              {whSuccess && <p className="text-xs text-green-600">{whSuccess}</p>}
            </div>
          </div>
        )}

        <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Customer</h4>
        <div className="rounded-xl border border-gray-100 p-4">
          <Row label="Name" value={order.customer?.name ?? "—"} />
          <Row label="Email" value={order.customer?.email || order.email || "—"} />
          <Row label="Phone" value={order.customer?.phone || "—"} />
          <Row label="Payment" value={`${order.paymentMethod} · ${order.paymentStatus}`} />
          <Row label="Placed" value={fmtDateTime(order.createdAt)} />
        </div>

        {addr && (
          <>
            <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Shipping Address</h4>
            <div className="rounded-xl border border-gray-100 p-4 text-sm text-gray-700">
              {addr.name && <div className="font-medium text-gray-900">{addr.name}</div>}
              <div>
                {[addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
              </div>
              {addr.phone && <div className="text-gray-500">{addr.phone}</div>}
            </div>
          </>
        )}

        {order.items.length > 0 && (
          <>
            <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Items</h4>
            <div className="rounded-xl border border-gray-100 p-4">
              {order.items.map((it, i) => (
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

        {order.pricing && (
          <div className="mt-4 rounded-xl border border-gray-100 p-4">
            <Row label="Subtotal" value={inr(order.pricing.subtotal)} />
            <Row label="Shipping" value={inr(order.pricing.shipping)} />
            {order.pricing.tax > 0 && <Row label="Tax" value={inr(order.pricing.tax)} />}
            {order.pricing.discount > 0 && <Row label="Discount" value={`- ${inr(order.pricing.discount)}`} />}
            <div className="mt-1 border-t border-gray-100 pt-2">
              <Row label="Total" value={<span className="text-base">{inr(order.pricing.total)}</span>} />
            </div>
          </div>
        )}

        {hasShipping && (
          <>
            <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Shipment</h4>
            <div className="rounded-xl border border-gray-100 p-4">
              {sh.method && <Row label="Method" value={sh.method} />}
              {(sh.courierName || sh.carrier) && <Row label="Courier" value={sh.courierName || sh.carrier} />}
              {sh.trackingNumber && <Row label="Tracking #" value={sh.trackingNumber} />}
              {sh.provider && <Row label="Booked via" value={cap(sh.provider)} />}
              {sh.estimatedDelivery && <Row label="Est. Delivery" value={fmtDateTime(sh.estimatedDelivery)} />}
              {sh.labelUrl && (
                <Row
                  label="Courier label"
                  value={
                    <a
                      href={sh.labelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-emerald-700 underline hover:text-emerald-800"
                    >
                      Open AWB label
                    </a>
                  }
                />
              )}
            </div>
            {sh.labelUrl && (
              <p className="mt-1.5 text-xs text-gray-500">
                Couriers require the AWB label above at pickup; the 4×6 label below is address-only.
              </p>
            )}
          </>
        )}

        {order.timeline.length > 0 && (
          <>
            <h4 className="mt-5 mb-2 text-sm font-semibold text-gray-700">Timeline</h4>
            <div className="rounded-xl border border-gray-100 p-4">
              {order.timeline.map((t, i) => (
                <div key={i} className="flex justify-between gap-4 py-1.5 text-sm">
                  <span className="text-gray-700">{cap(t.status)}{t.message ? ` — ${t.message}` : ""}</span>
                  <span className="whitespace-nowrap text-gray-400">{fmtDateTime(t.timestamp)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-gray-500">Print / download</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runDownload(() => downloadInvoice(order.id, order.orderId))}
              disabled={invoiceBusy}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Invoice (A4)
            </button>
            <button
              onClick={() => runDownload(() => downloadInvoice(order.id, order.orderId, "4x6"))}
              disabled={invoiceBusy}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Invoice 4×6
            </button>
            <button
              onClick={() => runDownload(() => downloadLabel(order.id, order.orderId))}
              disabled={invoiceBusy}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Label 4×6
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
