import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
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

const statusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "success":
    case "paid":
    case "settled":
      return "bg-[#c9ecc4] text-[#486800]";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "refunded":
    case "partially refunded":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Transactions"
          value={stats ? stats.totalTransactions.toLocaleString("en-IN") : "—"}
          subtext="Processed gateways"
        />
        <StatCard
          label="Successful Payments"
          value={stats ? stats.successful.toLocaleString("en-IN") : "—"}
          valueColor="text-[#486800]"
          subtext="Razorpay &amp; settled COD"
        />
        <StatCard
          label="Failed Payments"
          value={stats ? stats.failed.toLocaleString("en-IN") : "—"}
          valueColor="text-red-500"
          subtext="Gateway drops / cancels"
        />
        <StatCard
          label="Pending Payments"
          value={stats ? stats.pending.toLocaleString("en-IN") : "—"}
          valueColor="text-yellow-600"
          subtext="Pending verification"
        />
        <StatCard
          label="Revenue"
          value={stats ? inr(stats.revenue) : "—"}
          badge="Gross GMV"
          valueColor="text-[#1e3a1f]"
          subtext="Lifetime reconciled"
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

      {/* Main Payments Card */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-[#1e3a1f]/10 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)] overflow-hidden">
        {/* Search & Filter Controls */}
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
                placeholder="Search by User Name, Email, Order ID, or Transaction ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3f0] border border-transparent rounded-2xl text-xs font-bold text-[#1b1c1a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:bg-white transition-all"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]);
              }}
              className="py-2.5 px-3 bg-[#f5f3f0] border border-transparent rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : s}
                </option>
              ))}
            </select>
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

        {/* Payments Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f5f3f0]/80 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Transaction ID</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Order ID</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Customer</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Method</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Date &amp; Time</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Amount</th>
                <th className="px-6 py-3.5 text-right text-xs uppercase font-bold text-[#434936] tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-bold">
                    Loading payments…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500 font-bold">
                    {error}
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-bold">
                    {search || status !== "All" ? "No payments match your filters." : "No payments logged yet."}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openDetail(p)}
                    className="hover:bg-[#f5f3f0]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-[#1e3a1f]">{p.transactionId || "—"}</td>
                    <td className="px-6 py-4 font-mono font-bold text-gray-700">{p.orderId}</td>
                    <td className="px-6 py-4 font-semibold text-[#1b1c1a]">{p.name}</td>
                    <td className="px-6 py-4 uppercase font-bold text-[11px] text-gray-600">{p.method}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${statusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{fmtDateTime(p.date)}</td>
                    <td className="px-6 py-4 font-black text-[#1b1c1a]">{inr(p.amount)}</td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openDetail(p)}
                        disabled={detailLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-[#c9ecc4]/60 hover:bg-[#c9ecc4] text-[#486800] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
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
        {!loading && !error && payments.length > 0 && (
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

      {detail && <PaymentDetailModal payment={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
