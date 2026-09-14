import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  Users,
  Percent,
  IndianRupee,
  Calendar,
  Copy,
  Check,
  Eye,
  X,
} from "lucide-react";
import {
  getAdminCoupons,
  getAdminCoupon,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  toggleAdminCoupon,
  suggestCouponCode,
  getAdminSettings,
  updateAdminSettings,
  type AdminCoupon,
  type CouponPayload,
  type CouponRedemption,
} from "../api/adminApi";

export default function Coupons() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Redemptions History Modal
  const [viewingRedemptions, setViewingRedemptions] = useState<{
    coupon: AdminCoupon;
    redemptions: CouponRedemption[];
  } | null>(null);

  // Copied toast state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [allowStacking, setAllowStacking] = useState(false);
  const [updatingStacking, setUpdatingStacking] = useState(false);

  // Form fields
  const [formData, setFormData] = useState<CouponPayload>({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 0,
    maxDiscountCap: null,
    validFrom: new Date().toISOString().split("T")[0],
    validTo: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
    totalUsageLimit: null,
    perUserLimit: 1,
    isActive: true,
    firstOrderOnly: false,
    isFestivalOffer: false,
  });

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminCoupons({
        page,
        limit: 15,
        search,
        status: statusFilter,
      });
      setCoupons(res.coupons);
      setTotalPages(res.pagination.pages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
    getAdminSettings()
      .then((s) => {
        if (s?.allowCouponStacking !== undefined) setAllowStacking(!!s.allowCouponStacking);
      })
      .catch(() => {});
  }, [page, statusFilter]);

  const handleToggleStacking = async () => {
    try {
      setUpdatingStacking(true);
      const next = !allowStacking;
      await updateAdminSettings({ allowCouponStacking: next });
      setAllowStacking(next);
    } catch (err: any) {
      alert("Failed to update stacking settings: " + (err.message || "Unknown error"));
    } finally {
      setUpdatingStacking(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCoupons();
  };

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: 15,
      minOrderValue: 299,
      maxDiscountCap: 150,
      validFrom: new Date().toISOString().split("T")[0],
      validTo: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
      totalUsageLimit: null,
      perUserLimit: 1,
      isActive: true,
      firstOrderOnly: false,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coupon: AdminCoupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderValue: coupon.minOrderValue,
      maxDiscountCap: coupon.maxDiscountCap,
      validFrom: coupon.validFrom ? coupon.validFrom.split("T")[0] : "",
      validTo: coupon.validTo ? coupon.validTo.split("T")[0] : "",
      totalUsageLimit: coupon.totalUsageLimit,
      perUserLimit: coupon.perUserLimit || 1,
      isActive: coupon.isActive,
      firstOrderOnly: coupon.firstOrderOnly || false,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSuggestCode = async () => {
    try {
      const res = await suggestCouponCode();
      if (res?.code) {
        setFormData((prev) => ({ ...prev, code: res.code }));
      }
    } catch (err) {
      // fallback generator
      const code = `AGRI${Math.floor(10 + Math.random() * 90)}`;
      setFormData((prev) => ({ ...prev, code }));
    }
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalSubmitting(true);
      setModalError(null);

      if (!formData.code.trim()) {
        setModalError("Coupon code is required");
        setModalSubmitting(false);
        return;
      }
      if (!formData.validTo) {
        setModalError("Expiry date is required");
        setModalSubmitting(false);
        return;
      }

      const payload: CouponPayload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscountCap: formData.maxDiscountCap ? Number(formData.maxDiscountCap) : null,
        totalUsageLimit: formData.totalUsageLimit ? Number(formData.totalUsageLimit) : null,
        perUserLimit: Number(formData.perUserLimit) || 1,
      };

      if (editingCoupon) {
        await updateAdminCoupon(editingCoupon.id, payload);
      } else {
        await createAdminCoupon(payload);
      }

      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setModalError(err.message || "Failed to save coupon");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleAdminCoupon(id);
      setCoupons((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, isActive: !c.isActive, status: !c.isActive ? "active" : "inactive" } : c
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to toggle status");
    }
  };

  const handleDelete = async (coupon: AdminCoupon, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete coupon "${coupon.code}"?`)) {
      return;
    }
    try {
      await deleteAdminCoupon(coupon.id);
      fetchCoupons();
    } catch (err: any) {
      alert(err.message || "Failed to delete coupon");
    }
  };

  const handleViewRedemptions = async (coupon: AdminCoupon) => {
    try {
      const detail = await getAdminCoupon(coupon.id);
      setViewingRedemptions({
        coupon: detail,
        redemptions: detail.redemptions || [],
      });
    } catch (err: any) {
      alert(err.message || "Failed to load redemptions");
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Status badge helper
  const renderStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive || status === "inactive") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
          <XCircle className="w-3 h-3 text-gray-500" /> Inactive
        </span>
      );
    }
    if (status === "expired") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <Clock className="w-3 h-3 text-red-500" /> Expired
        </span>
      );
    }
    if (status === "exhausted") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-500" /> Limit Reached
        </span>
      );
    }
    if (status === "upcoming") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3 h-3 text-blue-500" /> Upcoming
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active
      </span>
    );
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 pb-12 font-sans">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#84b817]" />
            Coupons & Discounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage promotional codes, percentage discounts, minimum order limits, and customer usage quotas.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#84b817] hover:bg-[#729f13] text-white rounded-xl font-medium shadow-sm transition-all text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </button>
      </div>

      {/* ── Admin Multi-Coupon Stacking Banner ── */}
      <div className="bg-gradient-to-r from-[#142314] via-[#1e3a1f] to-[#142314] text-white p-5 rounded-3xl shadow-sm border border-[#84b817]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-[#84b817]" />
            <h3 className="font-extrabold text-sm sm:text-base text-white">
              Multi-Coupon Stacking Policy (Admin Decision)
            </h3>
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${allowStacking ? "bg-[#84b817] text-white" : "bg-gray-700 text-gray-300"}`}>
              {allowStacking ? "Enabled • 2 Coupons Stackable" : "Disabled • 1 Coupon Only"}
            </span>
          </div>
          <p className="text-xs text-gray-300 max-w-xl leading-relaxed">
            Decide whether shoppers can combine 2 coupons together on a single order (e.g. Special Welcome Invitation <strong className="text-[#a3e635]">AGRIPURE</strong> + Festival Offer <strong className="text-[#a3e635]">DIWALI20 / HARVEST10</strong>).
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleStacking}
          disabled={updatingStacking}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0 ${
            allowStacking
              ? "bg-[#84b817] text-white hover:bg-[#6d9913]"
              : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
          }`}
        >
          <span>{updatingStacking ? "Saving…" : allowStacking ? "Stacking Allowed (Click to Disable)" : "Enable 2-Coupon Stacking"}</span>
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-lime-50 border border-lime-200 flex items-center justify-center text-[#84b817]">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Coupons</p>
            <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Campaigns</p>
            <p className="text-2xl font-bold text-gray-900">
              {coupons.filter((c) => c.status === "active").length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Redemptions</p>
            <p className="text-2xl font-bold text-gray-900">
              {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Default Seeded</p>
            <p className="text-2xl font-bold text-gray-900">SAVE10, FLAT50...</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search by code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        </form>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {["all", "active", "expired", "exhausted", "inactive"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                statusFilter === tab
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => fetchCoupons()}
            title="Refresh"
            className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors ml-1 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#84b817]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#84b817] mb-2" />
            Loading coupons...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900">No coupons found</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Get started by creating your first promotional coupon discount.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#84b817] text-white rounded-xl text-sm font-medium hover:bg-[#729f13] transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Coupon
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Code & Details</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Criteria</th>
                  <th className="px-6 py-4">Validity</th>
                  <th className="px-6 py-4">Usage & Redemptions</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((coupon) => {
                  const isPct = coupon.discountType === "percentage";
                  const percentUsed = coupon.totalUsageLimit
                    ? Math.min(100, Math.round((coupon.usedCount / coupon.totalUsageLimit) * 100))
                    : null;

                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Code */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 text-xs tracking-wide flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-[#84b817]" />
                            {coupon.code}
                          </span>
                          <button
                            onClick={() => handleCopy(coupon.code)}
                            title="Copy code"
                            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{coupon.description}</p>
                        )}
                        {coupon.firstOrderOnly && (
                          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                            1st Order Only
                          </span>
                        )}
                      </td>

                      {/* Discount Badge */}
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-lime-50 text-[#5f870e] border border-lime-200 font-bold text-sm">
                          {isPct ? <Percent className="w-3.5 h-3.5" /> : <IndianRupee className="w-3.5 h-3.5" />}
                          {isPct ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} FLAT`}
                        </div>
                        {isPct && coupon.maxDiscountCap && (
                          <p className="text-[11px] text-gray-400 mt-1">Up to ₹{coupon.maxDiscountCap}</p>
                        )}
                      </td>

                      {/* Criteria */}
                      <td className="px-6 py-4 text-xs">
                        <div className="space-y-0.5">
                          <p className="text-gray-700">
                            Min Order:{" "}
                            <span className="font-semibold text-gray-900">
                              {coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : "No minimum"}
                            </span>
                          </p>
                          <p className="text-gray-500">Per user: {coupon.perUserLimit || 1}x</p>
                        </div>
                      </td>

                      {/* Validity */}
                      <td className="px-6 py-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {new Date(coupon.validTo).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-800">
                              {coupon.usedCount || 0}{" "}
                              {coupon.totalUsageLimit ? `/ ${coupon.totalUsageLimit}` : "used"}
                            </span>
                            {coupon.redemptionsCount ? (
                              <button
                                onClick={() => handleViewRedemptions(coupon)}
                                className="text-[11px] text-[#84b817] hover:underline font-medium flex items-center gap-0.5"
                              >
                                <Eye className="w-3 h-3" /> Log ({coupon.redemptionsCount})
                              </button>
                            ) : null}
                          </div>
                          {coupon.totalUsageLimit && (
                            <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (percentUsed || 0) >= 100 ? "bg-amber-500" : "bg-[#84b817]"
                                }`}
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status & Active Toggle */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {renderStatusBadge(coupon.status, coupon.isActive)}
                          <button
                            onClick={(e) => handleToggle(coupon.id, e)}
                            title={coupon.isActive ? "Deactivate" : "Activate"}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              coupon.isActive ? "bg-[#84b817]" : "bg-gray-300"
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                                coupon.isActive ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(coupon)}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(coupon, e)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
            Showing Page <span className="font-semibold">{page}</span> of{" "}
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

      {/* Create / Edit Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#84b817]" />
                <h3 className="font-bold text-gray-900 text-lg">
                  {editingCoupon ? "Edit Coupon" : "Create New Coupon"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                  {modalError}
                </div>
              )}

              {/* Code + Suggest button */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Coupon Code *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. FESTIVE20"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono uppercase font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                  <button
                    type="button"
                    onClick={handleSuggestCode}
                    className="px-3 py-2 bg-lime-50 text-[#5f870e] hover:bg-lime-100 border border-lime-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Auto-Suggest
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15% discount for Diwali shoppers on orders above ₹499"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Discount Type *
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountType: e.target.value as "percentage" | "flat",
                      })
                    }
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  >
                    <option value="percentage">Percentage (%) Discount</option>
                    <option value="flat">Flat Amount (₹) Off</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    {formData.discountType === "percentage" ? "Discount Percentage (%) *" : "Flat Discount (₹) *"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.discountType === "percentage" ? "100" : "10000"}
                    required
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
              </div>

              {/* Min Order & Max Cap */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Min. Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for no minimum"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>

                {formData.discountType === "percentage" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500 (optional)"
                      value={formData.maxDiscountCap || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxDiscountCap: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                    />
                  </div>
                )}
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Valid To (Expiry) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.validTo}
                    onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Total Usage Limit (All users)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited if left blank"
                    value={formData.totalUsageLimit || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        totalUsageLimit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Per User Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({ ...formData, perUserLimit: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#84b817] rounded border-gray-300 focus:ring-[#84b817]"
                  />
                  Active (Ready for checkout)
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.firstOrderOnly}
                    onChange={(e) => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  First-order customer only
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-[#84b817] hover:bg-[#729f13] text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? "Saving..." : editingCoupon ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemptions History Modal */}
      {viewingRedemptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#84b817]" />
                <h3 className="font-bold text-gray-900 text-lg">
                  Redemption History: <span className="font-mono text-[#5f870e]">{viewingRedemptions.coupon.code}</span>
                </h3>
              </div>
              <button
                onClick={() => setViewingRedemptions(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {viewingRedemptions.redemptions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No redemptions recorded for this coupon yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Discount Saved</th>
                      <th className="px-4 py-3">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewingRedemptions.redemptions.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {r.user?.name || "Customer"}
                          <div className="text-[10px] text-gray-400">{r.user?.phone || r.user?.email || "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{r.orderId || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">₹{r.discountAmount}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(r.redeemedAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setViewingRedemptions(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
