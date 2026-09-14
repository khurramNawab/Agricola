import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Send,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  ExternalLink,
  History,
  RefreshCw,
  X,
  Eye,
  IndianRupee,
  Layers,
} from "lucide-react";
import {
  getAbandonedCarts,
  sendAbandonedCartMessage,
  getAbandonedCartLogs,
  getAdminCoupons,
  type AbandonedCart,
  type AbandonedCartLogItem,
  type AdminCoupon,
} from "../api/adminApi";

export default function AbandonedCartPage() {
  const [activeTab, setActiveTab] = useState<"carts" | "logs">("carts");
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings & Filter states
  const [hoursThreshold, setHoursThreshold] = useState(24);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAbandoned, setTotalAbandoned] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  // Selected carts for bulk messaging
  const [selectedCartIds, setSelectedCartIds] = useState<string[]>([]);

  // Modal states
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [activeCoupons, setActiveCoupons] = useState<AdminCoupon[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // WhatsApp links modal (when whatsapp is triggered)
  const [whatsAppLinks, setWhatsAppLinks] = useState<
    Array<{ cartId: string; userName: string; phone: string; link: string; message: string }>
  >([]);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<AbandonedCartLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  // Form inputs for Compose Modal
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp" | "all">("all");
  const [templateId, setTemplateId] = useState<"reminder" | "discount" | "stock_alert" | "custom">("discount");
  const [selectedCoupon, setSelectedCoupon] = useState<string>("");
  const [subject, setSubject] = useState("Your AgriCola cart is waiting for you! 🎁");
  const [customMessage, setCustomMessage] = useState(
    "Hi {name}, we noticed you left {product} in your cart. Complete your order today and use coupon {coupon} to get extra savings! Finish here: {checkout_url}"
  );

  const fetchCarts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAbandonedCarts({
        hours: hoursThreshold,
        page,
        limit: 15,
        search,
      });
      setCarts(res.carts);
      setTotalPages(res.pagination.pages);
      setTotalAbandoned(res.summary.totalAbandoned);
      setTotalValue(res.summary.totalValue);
    } catch (err: any) {
      setError(err.message || "Failed to fetch abandoned carts");
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await getAbandonedCartLogs({ page: logsPage, limit: 15 });
      setLogs(res.logs);
      setLogsTotalPages(res.pagination.pages);
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchActiveCoupons = async () => {
    try {
      const res = await getAdminCoupons({ status: "active", limit: 50 });
      setActiveCoupons(res.coupons);
      if (res.coupons.length > 0 && !selectedCoupon) {
        setSelectedCoupon(res.coupons[0].code);
      }
    } catch (err) {
      console.error("Failed to fetch coupons:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "carts") {
      fetchCarts();
    } else {
      fetchLogs();
    }
  }, [activeTab, hoursThreshold, page, logsPage]);

  useEffect(() => {
    fetchActiveCoupons();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCarts();
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCartIds(carts.map((c) => c.id));
    } else {
      setSelectedCartIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCartIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleOpenCompose = (singleCartId?: string) => {
    if (singleCartId) {
      setSelectedCartIds([singleCartId]);
    }
    setComposeError(null);
    setIsComposeModalOpen(true);
  };

  const handleTemplateChange = (tmpl: "reminder" | "discount" | "stock_alert" | "custom") => {
    setTemplateId(tmpl);
    if (tmpl === "reminder") {
      setSubject("Did you leave something behind in your cart?");
      setCustomMessage(
        "Hi {name}, we noticed you left {product} in your AgriCola cart. Complete your order now to enjoy farm-fresh goodness delivered right to your door!"
      );
    } else if (tmpl === "discount") {
      setSubject("A special discount for the items in your cart! 🎁");
      setCustomMessage(
        "Hi {name}, complete your order today and use promo code {coupon} to get an exclusive discount on your cart of ₹{cart_total}! Claim it here: {checkout_url}"
      );
    } else if (tmpl === "stock_alert") {
      setSubject("Hurry! Items in your cart are selling fast ⚡");
      setCustomMessage(
        "Hi {name}, high demand on {product}! Grab your cart worth ₹{cart_total} before stock runs out. Finish checkout now: {checkout_url}"
      );
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSendingMessage(true);
      setComposeError(null);

      if (selectedCartIds.length === 0) {
        setComposeError("Please select at least one cart");
        setSendingMessage(false);
        return;
      }

      const res = await sendAbandonedCartMessage({
        cartIds: selectedCartIds,
        channel,
        templateId,
        customMessage,
        couponCode: selectedCoupon,
        subject,
      });

      setIsComposeModalOpen(false);

      if (res.whatsappLinks && res.whatsappLinks.length > 0) {
        setWhatsAppLinks(res.whatsappLinks);
        setIsWhatsAppModalOpen(true);
      } else {
        alert(
          `Success! Dispatched ${res.sentEmails} email(s) and ${res.sentSms} SMS message(s).`
        );
      }

      fetchCarts();
      setSelectedCartIds([]);
    } catch (err: any) {
      setComposeError(err.message || "Failed to dispatch messages");
    } finally {
      setSendingMessage(false);
    }
  };

  // Preview computed text
  const previewSample = () => {
    const sampleCart = carts.find((c) => selectedCartIds.includes(c.id)) || carts[0];
    const customerName = sampleCart?.user.name || "Priya Sharma";
    const itemNames = sampleCart?.items.map((i) => i.name).join(", ") || "Pure Forest Honey, Desi Cow Ghee";
    const subtotal = sampleCart?.cartTotal || 1450;
    const coupon = selectedCoupon || "AGRI10";

    return customMessage
      .replace(/{name}/gi, customerName)
      .replace(/{product}/gi, itemNames)
      .replace(/{cart_total}/gi, String(subtotal))
      .replace(/{coupon}/gi, coupon)
      .replace(/{checkout_url}/gi, "https://www.agricola.co.in/cart");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#84b817]" />
            Abandoned Cart Recovery
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Detect abandoned carts, engage customers with personalized reminders, promo codes, and recovery messages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab("carts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "carts"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Active Carts ({totalAbandoned})
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "logs"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Delivery Logs
            </button>
          </div>

          {activeTab === "carts" && (
            <button
              onClick={() => handleOpenCompose()}
              disabled={carts.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#84b817] hover:bg-[#729f13] text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Compose Message {selectedCartIds.length > 0 ? `(${selectedCartIds.length})` : ""}
            </button>
          )}
        </div>
      </div>

      {activeTab === "carts" ? (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-lime-50 border border-lime-200 flex items-center justify-center text-[#84b817]">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Abandoned Carts</p>
                <p className="text-2xl font-bold text-gray-900">{totalAbandoned}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recoverable Value</p>
                <p className="text-2xl font-bold text-gray-900">₹{totalValue.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Inactivity Window</p>
                <p className="text-2xl font-bold text-gray-900">&ge; {hoursThreshold}h</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Promo Coupons</p>
                <p className="text-2xl font-bold text-gray-900">{activeCoupons.length} Available</p>
              </div>
            </div>
          </div>

          {/* Time Window & Filter Controls */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Inactivity Threshold Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-xs font-semibold text-gray-500 mr-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Inactive For:
              </span>
              {[
                { label: "1 Hour", value: 1 },
                { label: "6 Hours", value: 6 },
                { label: "12 Hours", value: 12 },
                { label: "24 Hours (Default)", value: 24 },
                { label: "48 Hours", value: 48 },
                { label: "7 Days", value: 168 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setHoursThreshold(opt.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    hoursThreshold === opt.value
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="w-full md:w-72 relative">
              <input
                type="text"
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            </form>
          </div>

          {/* Carts Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#84b817] mb-2" />
                Finding abandoned carts...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">{error}</div>
            ) : carts.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900">No abandoned carts found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  No customer carts match the current inactivity threshold of {hoursThreshold} hours.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                    <tr>
                      <th className="px-4 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={selectedCartIds.length === carts.length && carts.length > 0}
                          className="w-4 h-4 text-[#84b817] rounded border-gray-300 focus:ring-[#84b817]"
                        />
                      </th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Items Left in Cart</th>
                      <th className="px-6 py-4">Cart Value</th>
                      <th className="px-6 py-4">Inactivity</th>
                      <th className="px-6 py-4">Reminder Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {carts.map((cart) => {
                      const isSelected = selectedCartIds.includes(cart.id);

                      return (
                        <tr
                          key={cart.id}
                          className={`hover:bg-gray-50/80 transition-colors ${
                            isSelected ? "bg-lime-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(cart.id)}
                              className="w-4 h-4 text-[#84b817] rounded border-gray-300 focus:ring-[#84b817]"
                            />
                          </td>

                          {/* Customer info */}
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">{cart.user.name}</div>
                            <div className="text-xs text-gray-500 flex flex-col gap-0.5 mt-0.5">
                              {cart.user.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-400" /> {cart.user.phone}
                                </span>
                              )}
                              {cart.user.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-gray-400" /> {cart.user.email}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Items Left */}
                          <td className="px-6 py-4">
                            <div className="space-y-1.5 max-w-xs">
                              {cart.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <Layers className="w-3 h-3 text-gray-400" />
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-800 truncate">
                                    {item.name} {item.weight ? `(${item.weight})` : ""} &times; {item.qty}
                                  </span>
                                </div>
                              ))}
                              {cart.items.length > 2 && (
                                <span className="text-[11px] text-gray-400">
                                  +{cart.items.length - 2} more item(s)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Value */}
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 text-sm">
                              ₹{cart.cartTotal.toLocaleString("en-IN")}
                            </span>
                            <div className="text-[11px] text-gray-400">{cart.itemCount} item(s)</div>
                          </td>

                          {/* Inactivity */}
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-500" /> {cart.hoursInactive}h ago
                            </span>
                          </td>

                          {/* Reminder History */}
                          <td className="px-6 py-4 text-xs">
                            {cart.reminderCount > 0 ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  {cart.reminderCount} sent
                                </span>
                                {cart.lastReminderSentAt && (
                                  <div className="text-[10px] text-gray-400">
                                    Last: {new Date(cart.lastReminderSentAt).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">No message sent</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleOpenCompose(cart.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-lime-50 text-[#5f870e] hover:bg-lime-100 border border-lime-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Send className="w-3 h-3" /> Recover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-500">
                Page <span className="font-semibold">{page}</span> of{" "}
                <span className="font-semibold">{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-200 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-200 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Delivery Logs Tab */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-[#84b817]" />
              Dispatched Reminder Logs
            </h3>
            <button
              onClick={fetchLogs}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin text-[#84b817]" : ""}`} />
            </button>
          </div>

          {logsLoading ? (
            <div className="p-12 text-center text-gray-500">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No reminder messages sent yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3">Recipient</th>
                    <th className="px-6 py-3">Channel</th>
                    <th className="px-6 py-3">Message Content</th>
                    <th className="px-6 py-3">Coupon Attached</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="font-semibold text-gray-900">{log.recipientName}</div>
                        <div className="text-[10px] text-gray-400">
                          {log.recipientPhone || log.recipientEmail}
                        </div>
                      </td>
                      <td className="px-6 py-3 uppercase font-bold text-[10px]">
                        {log.channel === "email" ? (
                          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 w-fit">
                            <Mail className="w-3 h-3" /> Email
                          </span>
                        ) : log.channel === "whatsapp" ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 w-fit">
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                          </span>
                        ) : (
                          <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 w-fit">
                            <Phone className="w-3 h-3" /> SMS
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 max-w-sm">
                        <p className="line-clamp-2 text-gray-700">{log.messageContent}</p>
                      </td>
                      <td className="px-6 py-3">
                        {log.couponCode ? (
                          <span className="font-mono font-bold text-[#5f870e] bg-lime-50 px-2 py-0.5 rounded border border-lime-200">
                            {log.couponCode}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {log.status === "sent" || log.status === "ready_to_send" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <XCircle className="w-3 h-3 text-red-500" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {new Date(log.sentAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {logsTotalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-b-2xl border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Log Page <span className="font-semibold">{logsPage}</span> of{" "}
                <span className="font-semibold">{logsTotalPages}</span>
              </p>
              <div className="flex gap-2">
                <button
                  disabled={logsPage <= 1}
                  onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={logsPage >= logsTotalPages}
                  onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compose Abandoned Cart Message Modal */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#84b817]" />
                <h3 className="font-bold text-gray-900 text-lg">
                  Compose Abandoned Cart Message
                </h3>
              </div>
              <button
                onClick={() => setIsComposeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
              {composeError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                  {composeError}
                </div>
              )}

              {/* Target count summary */}
              <div className="p-3 bg-lime-50/60 rounded-xl border border-lime-200 text-xs text-[#4d7c0f] flex items-center justify-between font-medium">
                <span>
                  Targeting{" "}
                  <strong>
                    {selectedCartIds.length > 0 ? selectedCartIds.length : carts.length} customer(s)
                  </strong>
                </span>
                <span>Subtotal Value: ₹{totalValue.toLocaleString("en-IN")}</span>
              </div>

              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Delivery Channel *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "all", label: "All Channels", icon: Sparkles },
                    { id: "email", label: "Email (Zoho)", icon: Mail },
                    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                    { id: "sms", label: "SMS (Fast2SMS)", icon: Phone },
                  ].map((ch) => {
                    const Icon = ch.icon;
                    const isActive = channel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setChannel(ch.id as any)}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isActive
                            ? "bg-lime-50 border-[#84b817] text-[#3f6212] shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-[#84b817]" : "text-gray-400"}`} />
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Template Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Message Template
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "discount", label: "Special Discount 🎁" },
                    { id: "reminder", label: "Gentle Reminder 🛒" },
                    { id: "stock_alert", label: "Stock Selling Fast ⚡" },
                  ].map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleTemplateChange(tmpl.id as any)}
                      className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                        templateId === tmpl.id
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Coupon Selector & Custom Add */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Attach Promotional Coupon</span>
                  <span className="text-[10px] text-[#84b817] font-semibold">
                    {selectedCoupon ? `Attached: ${selectedCoupon} (Replaces {coupon})` : "No coupon attached"}
                  </span>
                </label>

                {/* Quick 1-Click Preset Coupons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-500 font-medium">Quick Presets:</span>
                  {[
                    { code: "SAVE10", label: "SAVE10 (10% OFF)" },
                    { code: "ORGANIC15", label: "ORGANIC15 (15% OFF)" },
                    { code: "FLAT100", label: "FLAT100 (₹100 Flat)" },
                    { code: "FREESHIP", label: "FREESHIP (Free Delivery)" },
                  ].map((preset) => {
                    const isSelected = selectedCoupon === preset.code;
                    return (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => setSelectedCoupon(isSelected ? "" : preset.code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                          isSelected
                            ? "bg-[#84b817] text-white border-[#84b817] shadow-xs scale-105"
                            : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown or Custom Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-500 mb-1">
                      Choose Active Store Coupon
                    </span>
                    <select
                      value={selectedCoupon}
                      onChange={(e) => setSelectedCoupon(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                    >
                      <option value="">None / Regular Reminder</option>
                      {activeCoupons.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} — {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`} (Min ₹{c.minOrderValue})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[10px] font-semibold text-gray-500 mb-1">
                      Or Type Custom Promo Code
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={selectedCoupon}
                        onChange={(e) => setSelectedCoupon(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                        placeholder="e.g. DIWALI25, VIP100"
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                      />
                      {selectedCoupon && (
                        <button
                          type="button"
                          onClick={() => setSelectedCoupon("")}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
                          title="Clear coupon"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject (for email) */}
              {(channel === "email" || channel === "all") && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
              )}

              {/* Message Body with Placeholders */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Message Body</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    Available: {"{name}"}, {"{product}"}, {"{cart_total}"}, {"{coupon}"}, {"{checkout_url}"}
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                  <Eye className="w-3.5 h-3.5 text-[#84b817]" />
                  Personalized Live Preview:
                </div>
                <p className="text-xs text-gray-600 italic bg-white p-2.5 rounded-lg border border-gray-100">
                  "{previewSample()}"
                </p>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingMessage}
                  className="px-5 py-2 bg-[#84b817] hover:bg-[#729f13] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {sendingMessage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Send Recovery Messages
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Ready Direct Links Modal */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-base">
                  WhatsApp Direct Messages Ready ({whatsAppLinks.length})
                </h3>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <p className="text-xs text-gray-500">
                Click on any customer to open a 1-click WhatsApp conversation with their customized cart message and promo coupon:
              </p>

              <div className="space-y-2">
                {whatsAppLinks.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-xs text-gray-900">{item.userName}</div>
                      <div className="text-[11px] text-gray-500">{item.phone}</div>
                    </div>

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                    >
                      Chat in WhatsApp <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
