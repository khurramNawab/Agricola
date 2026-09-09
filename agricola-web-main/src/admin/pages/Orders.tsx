import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import StatCard from "../components/StatsCard";
import OrderDetailModal from "../components/OrderDetailModal";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type ApiPagination } from "../../lib/api";
import {
  getOrders,
  getOrder,
  ORDER_STATUS_VALUES,
  type AdminOrder,
  type OrderStats,
  type OrderDetail,
} from "../api/adminApi";

const PAGE_SIZE = 20;

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const statusColor = (status: string) => {
  switch (status) {
    case "Delivered":
      return "text-green-500";
    case "Shipped":
      return "text-blue-500";
    case "Cancelled":
    case "Refunded":
      return "text-red-500";
    default:
      return "text-yellow-500";
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
    <div className="p-8">
      <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Orders" value={stats ? stats.totalOrders.toLocaleString("en-IN") : "—"} />
        <StatCard
          label="Delivered"
          value={stats ? stats.delivered.toLocaleString("en-IN") : "—"}
          valueColor="text-green-500"
        />
        <StatCard
          label="Shipped"
          value={stats ? stats.shipped.toLocaleString("en-IN") : "—"}
          valueColor="text-blue-500"
        />
        <StatCard
          label="Pending Dispatch"
          value={stats ? stats.pendingDispatch.toLocaleString("en-IN") : "—"}
          valueColor="text-yellow-500"
        />
        <StatCard
          label="Cancelled / Returned"
          value={stats ? stats.cancelledReturned.toLocaleString("en-IN") : "—"}
          valueColor="text-red-500"
        />
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="font-medium text-amber-700 hover:text-amber-900">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Order ID, User Name, or Email"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="py-3 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="All">All Statuses</option>
              {ORDER_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Items</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Payment Method</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Date &amp; Time</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading orders…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {search || status !== "All" ? "No orders match your filters." : "No orders yet."}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{o.orderId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{o.customer}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{o.items}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{inr(o.amount)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{o.paymentMethod}</td>
                    <td className={`px-6 py-4 text-sm font-medium ${statusColor(o.status)}`}>{o.status}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{fmtDateTime(o.date)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openDetail(o)}
                        disabled={detailLoading}
                        className="text-sm text-gray-600 underline transition-colors hover:text-gray-900 disabled:opacity-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && orders.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalRows)} of{" "}
              {totalRows.toLocaleString("en-IN")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={16} />
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
