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
    <div className="p-8">
      <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Users"
          value={stats ? formatNumber(stats.totalUsers) : "—"}
        />
        <StatCard
          label="Active Users"
          value={stats ? formatNumber(stats.activeUsers) : "—"}
          badge="this week"
          valueColor="text-green-500"
        />
        <StatCard
          label="Total Orders"
          value={stats ? formatNumber(stats.totalOrders) : "—"}
          badge="this week"
        />
        <StatCard
          label="Pending Orders"
          value={stats ? formatNumber(stats.pendingOrders) : "—"}
          badge="this week"
          valueColor="text-yellow-500"
        />
        <StatCard
          label="Revenue"
          value={stats ? formatCurrency(stats.revenue) : "—"}
          badge="this week"
          valueColor="text-blue-600"
        />
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="font-medium text-amber-700 hover:text-amber-900"
          >
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
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by User Name, Email, or User ID"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              title="Filters"
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal size={20} className="text-gray-600" />
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">User ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Email</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Join Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Orders</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading users…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {search
                      ? `No users match "${search}".`
                      : "No users found."}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors hover:bg-gray-50 ${
                      user.status === "banned" ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">{user.userId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className="flex items-center gap-2">
                        {user.name}
                        {user.status === "banned" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                            Banned
                          </span>
                        )}
                        {user.status === "inactive" && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Inactive
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatPhone(user.phone)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(user.joinDate)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{user.orders}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditing(user)}
                          title="Edit"
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Edit size={16} className="text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleToggleBan(user)}
                          disabled={busyId === user.id}
                          title={user.status === "banned" ? "Unban" : "Ban"}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40"
                        >
                          {user.status === "banned" ? (
                            <CircleCheck size={16} className="text-green-600" />
                          ) : (
                            <Ban size={16} className="text-gray-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={busyId === user.id}
                          title="Delete"
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={16} className="text-red-500" />
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
