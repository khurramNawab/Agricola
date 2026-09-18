import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import StatCard from "../components/StatsCard";
import OrderDetailModal from "../components/OrderDetailModal";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type ApiPagination } from "../../lib/api";
import {
  getOrders,
  getOrder,
  downloadSampleInvoice,
  ORDER_STATUS_VALUES,
  type AdminOrder,
  type OrderStats,
  type OrderDetail,
} from "../api/adminApi";

const PAGE_SIZE = 20;

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const statusColorBadge = (status: string) => {
  switch (status.toLowerCase()) {
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

const fmtDateTime = (iso: string) => {
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

export default function Orders() {
  const { logout } = useAuth();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      return getOrders(
        { page, limit: PAGE_SIZE, search, status: status === "All" ? undefined : status },
        signal
      )
        .then((res) => {
          setOrders(res.orders);
          setStats(res.stats);
          setPagination(res.pagination);
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (err instanceof ApiError && err.status === 401) return logout();
          setError(err instanceof Error ? err.message : "Failed to load orders.");
          setOrders([]);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [page, search, status, logout]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openDetail = async (o: AdminOrder) => {
    setNotice("");
    setDetailLoading(true);
    try {
      setDetail(await getOrder(o.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      setNotice(err instanceof Error ? err.message : "Failed to load order.");
    } finally {
      setDetailLoading(false);
    }
  };

  const totalRows = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Stats Strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Orders"
          value={stats ? stats.totalOrders.toLocaleString("en-IN") : "—"}
          subtext="Lifetime farm orders"
        />
        <StatCard
          label="Delivered"
          value={stats ? stats.delivered.toLocaleString("en-IN") : "—"}
          valueColor="text-[#486800]"
          subtext="Fulfilled &amp; received"
        />
        <StatCard
          label="Shipped"
          value={stats ? stats.shipped.toLocaleString("en-IN") : "—"}
          valueColor="text-blue-600"
          subtext="In active transit"
        />
        <StatCard
          label="Pending Dispatch"
          value={stats ? stats.pendingDispatch.toLocaleString("en-IN") : "—"}
          valueColor="text-amber-600"
          subtext="Packed / warehouse assigned"
        />
        <StatCard
          label="Cancelled / Returned"
          value={stats ? stats.cancelledReturned.toLocaleString("en-IN") : "—"}
          valueColor="text-red-600"
          subtext="Disrupted orders"
        />
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm font-bold text-amber-800 shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="font-extrabold text-amber-700 hover:text-amber-900 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-[#1e3a1f]/10 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)] overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-5 sm:p-6 border-b border-gray-100">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Order ID, Customer Name, or Email..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3f0] border border-transparent rounded-2xl text-xs font-bold text-[#1b1c1a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:bg-white transition-all"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="py-2.5 px-3 bg-[#f5f3f0] border border-transparent rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:bg-white"
            >
              <option value="All">All Statuses</option>
              {ORDER_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                try {
                  await downloadSampleInvoice();
                } catch (e: any) {
                  alert(e.message || "Failed to download sample invoice");
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white hover:bg-[#c9ecc4] text-[#1e3a1f] font-bold text-xs shadow-xs border border-gray-200 transition-all cursor-pointer whitespace-nowrap"
              title="Download preview sample GST Tax Invoice to inspect the exact format"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">description</span>
              <span>Preview Sample Invoice</span>
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#1e3a1f] hover:bg-[#486800] text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Search
            </button>
            <button
              type="button"
              title="Filters"
              className="p-2.5 border border-gray-200 rounded-2xl hover:bg-[#f5f3f0] transition-colors"
            >
              <SlidersHorizontal size={18} className="text-gray-600" />
            </button>
          </form>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f5f3f0]/80 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Order ID</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Customer</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Items</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Amount</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Payment Method</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Date &amp; Time</th>
                <th className="px-6 py-3.5 text-right text-xs uppercase font-bold text-[#434936] tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-bold">
                    Loading orders…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500 font-bold">
                    {error}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-bold">
                    {search || status !== "All" ? "No orders match your filters." : "No orders yet."}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#f5f3f0]/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[#1e3a1f]">{o.orderId}</td>
                    <td className="px-6 py-4 font-semibold text-[#1b1c1a]">{o.customer}</td>
                    <td className="px-6 py-4 text-gray-600">{o.items}</td>
                    <td className="px-6 py-4 font-black text-[#1b1c1a]">{inr(o.amount)}</td>
                    <td className="px-6 py-4 text-gray-600 uppercase font-bold text-[11px]">{o.paymentMethod}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${statusColorBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{fmtDateTime(o.date)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openDetail(o)}
                        disabled={detailLoading}
                        className="px-3 py-1.5 rounded-xl bg-[#c9ecc4]/60 hover:bg-[#c9ecc4] text-[#486800] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && orders.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-xs font-semibold text-gray-600">
            <p>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalRows)} of{" "}
              {totalRows.toLocaleString("en-IN")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs font-bold text-[#1e3a1f]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          onStatusUpdated={() => load()}
        />
      )}
    </div>
  );
}
