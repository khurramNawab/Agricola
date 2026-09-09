import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import StatCard from "../components/StatsCard";
import PaymentDetailModal from "../components/PaymentDetailModal";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type ApiPagination } from "../../lib/api";
import {
  getPayments,
  getPayment,
  type AdminPayment,
  type PaymentStats,
  type PaymentDetail,
} from "../api/adminApi";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["All", "Success", "Failed", "Pending", "Refunded"] as const;

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusColor = (status: string) => {
  switch (status) {
    case "Success":
      return "text-green-500";
    case "Pending":
      return "text-yellow-500";
    case "Refunded":
    case "Partially Refunded":
      return "text-blue-500";
    case "Failed":
      return "text-red-500";
    default:
      return "text-gray-600";
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

export default function Payments() {
  const { logout } = useAuth();

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      return getPayments(
        {
          page,
          limit: PAGE_SIZE,
          search,
          status: status === "All" ? undefined : status,
        },
        signal
      )
        .then((res) => {
          setPayments(res.payments);
          setStats(res.stats);
          setPagination(res.pagination);
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (err instanceof ApiError && err.status === 401) return logout();
          setError(err instanceof Error ? err.message : "Failed to load payments.");
          setPayments([]);
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

  const openDetail = async (p: AdminPayment) => {
    setNotice("");
    setDetailLoading(true);
    try {
      setDetail(await getPayment(p.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      setNotice(err instanceof Error ? err.message : "Failed to load payment.");
    } finally {
      setDetailLoading(false);
    }
  };

  const totalRows = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="p-8">
      <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Transactions"
          value={stats ? stats.totalTransactions.toLocaleString("en-IN") : "—"}
        />
        <StatCard
          label="Successful Payments"
          value={stats ? stats.successful.toLocaleString("en-IN") : "—"}
          valueColor="text-green-500"
        />
        <StatCard
          label="Failed Payments"
          value={stats ? stats.failed.toLocaleString("en-IN") : "—"}
          valueColor="text-red-500"
        />
        <StatCard
          label="Pending Payments"
          value={stats ? stats.pending.toLocaleString("en-IN") : "—"}
          valueColor="text-yellow-500"
        />
        <StatCard
          label="Revenue"
          value={stats ? inr(stats.revenue) : "—"}
          badge="this week"
          valueColor="text-blue-600"
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
                placeholder="Search by User Name, Email, Order ID, or Transaction ID"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]);
              }}
              className="py-3 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
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
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Transaction ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Payment Method</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Date &amp; Time</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading payments…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {search || status !== "All" ? "No payments match your filters." : "No payments yet."}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{p.transactionId || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.orderId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.method}</td>
                    <td className={`px-6 py-4 text-sm font-medium ${statusColor(p.status)}`}>{p.status}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{fmtDateTime(p.date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{inr(p.amount)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openDetail(p)}
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

        {!loading && !error && payments.length > 0 && (
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

      {detail && <PaymentDetailModal payment={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
