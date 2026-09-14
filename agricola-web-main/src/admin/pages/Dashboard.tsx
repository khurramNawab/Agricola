import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Search,
  SlidersHorizontal,
  CreditCard as Edit,
  Ban,
  CircleCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import StatCard from "../components/StatsCard";
import EditUserModal from "../components/EditUserModal";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type ApiPagination } from "../../lib/api";
import {
  getDashboardStats,
  getUsers,
  updateUser,
  banUser,
  unbanUser,
  deleteUser,
  type AdminUser,
  type DashboardStats,
} from "../api/adminApi";

const PAGE_SIZE = 20;

const formatNumber = (n: number) => n.toLocaleString("en-IN");
const formatCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// +919876543210 -> +91 9876543210
const formatPhone = (phone: string) =>
  phone.replace(/^(\+\d{2})(\d{10})$/, "$1 $2");

export default function Dashboard() {
  const { logout } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Redirect to login on auth failure; otherwise surface a readable message.
  const handleError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setNotice(err instanceof Error ? err.message : fallback);
    },
    [logout]
  );

  // Stats — fetched once on mount.
  useEffect(() => {
    const controller = new AbortController();
    getDashboardStats(controller.signal)
      .then(setStats)
      .catch((err) => {
        if (controller.signal.aborted) return;
        handleError(err, "Failed to load dashboard stats.");
      });
    return () => controller.abort();
  }, [handleError]);

  // Users — re-fetched on page or submitted-search change.
  const loadUsers = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      return getUsers({ page, limit: PAGE_SIZE, search }, signal)
        .then((res) => {
          setUsers(res.users);
          setPagination(res.pagination);
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (err instanceof ApiError && err.status === 401) {
            logout();
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to load users.");
          setUsers([]);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [page, search, logout]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  // Refresh both stats and the current users page after a mutation.
  const refresh = useCallback(() => {
    loadUsers();
    getDashboardStats().then(setStats).catch(() => {});
  }, [loadUsers]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setNotice("");
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleToggleBan = async (user: AdminUser) => {
    setNotice("");
    setBusyId(user.id);
    try {
      if (user.status === "banned") {
        await unbanUser(user.id);
      } else {
        await banUser(user.id);
      }
      refresh();
    } catch (err) {
      handleError(err, "Failed to update user.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (
      !window.confirm(
        `Delete ${user.name} (${user.userId})? This cannot be undone.`
      )
    ) {
      return;
    }
    setNotice("");
    setBusyId(user.id);
    try {
      await deleteUser(user.id);
      refresh();
    } catch (err) {
      handleError(err, "Failed to delete user.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async (data: {
    name?: string;
    email?: string;
    phone?: string;
    status: "active" | "banned" | "inactive";
  }) => {
    if (!editing) return;
    await updateUser(editing.id, data);
    refresh();
  };

  const totalUsers = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Operational Dispatch Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#eae8e5]/40 to-white p-5 border border-amber-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm font-bold text-lg">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
                  Dispatch Hubs Synchronized
                </span>
                <span className="text-xs text-amber-800 font-semibold">Shiprocket & Ekart Logistics Active</span>
              </div>
              <p className="text-sm font-bold text-[#1b1c1a] mt-0.5">
                Automated multi-warehouse routing active across Bihar, Haryana, and regional dispatch hubs.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Users"
          value={stats ? formatNumber(stats.totalUsers) : "—"}
          subtext="Registered farm patrons"
          trend={{ value: "12.4%", isUp: true }}
        />
        <StatCard
          label="Active Users"
          value={stats ? formatNumber(stats.activeUsers) : "—"}
          subtext="30d active repeat buyers"
          valueColor="text-[#84b817]"
          trend={{ value: "8.1%", isUp: true }}
        />
        <StatCard
          label="Total Orders"
          value={stats ? formatNumber(stats.totalOrders) : "—"}
          subtext="Farm harvest direct"
          trend={{ value: "5.2%", isUp: true }}
        />
        <StatCard
          label="Pending Orders"
          value={stats ? formatNumber(stats.pendingOrders) : "—"}
          subtext="Awaiting fulfillment"
          valueColor="text-amber-600"
        />
        <StatCard
          label="Revenue"
          value={stats ? formatCurrency(stats.revenue) : "—"}
          subtext="Gross GMV processed"
          valueColor="text-[#1e3a1f]"
          trend={{ value: "14.8%", isUp: true }}
        />
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 shadow-sm">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="font-semibold text-amber-700 hover:text-amber-900"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-[#1e3a1f]/10 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)] overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Customer Name, Email, or Phone..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3f0] border border-transparent rounded-xl text-sm font-medium text-[#1b1c1a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#1e3a1f] text-white rounded-xl text-sm font-semibold hover:bg-[#2d5a27] transition-all shadow-sm"
            >
              Search
            </button>
            <button
              type="button"
              title="Filters"
              className="p-2.5 border border-gray-200 rounded-xl hover:bg-[#f5f3f0] transition-colors"
            >
              <SlidersHorizontal size={18} className="text-gray-600" />
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f5f3f0]/80 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">User ID</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Customer</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Email</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Phone</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Joined</th>
                <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Orders</th>
                <th className="px-6 py-3.5 text-right text-xs uppercase font-bold text-[#434936] tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-medium">
                    Loading customer data…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-500 font-medium">
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-medium">
                    {search
                      ? `No patrons match "${search}".`
                      : "No customer records found."}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors hover:bg-[#f5f3f0]/50 ${
                      user.status === "banned" ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-[#1e3a1f]">{user.userId}</td>
                    <td className="px-6 py-4 font-semibold text-[#1b1c1a]">
                      <span className="flex items-center gap-2">
                        {user.name}
                        {user.status === "banned" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            Banned
                          </span>
                        )}
                        {user.status === "inactive" && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                            Inactive
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.email || "—"}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{formatPhone(user.phone)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(user.joinDate)}</td>
                    <td className="px-6 py-4 font-bold text-[#1b1c1a]">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#c9ecc4]/60 text-[#4e6c4c] text-xs font-bold">
                        {user.orders}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditing(user)}
                          title="Edit"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-[#1e3a1f]"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleBan(user)}
                          disabled={busyId === user.id}
                          title={user.status === "banned" ? "Unban" : "Ban"}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {user.status === "banned" ? (
                            <CircleCheck size={16} className="text-green-600" />
                          ) : (
                            <Ban size={16} className="text-gray-500 hover:text-amber-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={busyId === user.id}
                          title="Delete"
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && users.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, totalUsers)} of {formatNumber(totalUsers)}
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

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
