import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  MessageSquare,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Send,
  X,
  Phone,
  Mail,
  Star,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  getAdminFeedbacks,
  toggleFeedbackStatus,
  replyToFeedback,
  deleteFeedback,
  getAdminSubscribers,
  deleteAdminSubscriber,
  type AdminFeedback,
  type LaunchSubscriberItem,
} from "../api/adminApi";

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<"inquiries" | "subscribers">("inquiries");

  // Inquiries State
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackTotalPages, setFeedbackTotalPages] = useState(1);

  // Reply Modal State
  const [replyingFeedback, setReplyingFeedback] = useState<AdminFeedback | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  // Subscribers State
  const [subscribers, setSubscribers] = useState<LaunchSubscriberItem[]>([]);
  const [subscriberStats, setSubscriberStats] = useState({ total: 0, utensilsCount: 0, gardeningCount: 0, bothCount: 0 });
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [subscriberError, setSubscriberError] = useState<string | null>(null);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberTotalPages, setSubscriberTotalPages] = useState(1);

  const fetchFeedbacks = async () => {
    try {
      setLoadingFeedbacks(true);
      setFeedbackError(null);
      const res = await getAdminFeedbacks({
        page: feedbackPage,
        limit: 15,
        search: feedbackSearch,
        status: statusFilter,
        rating: ratingFilter,
      });
      setFeedbacks(res.feedbacks);
      setFeedbackStats(res.stats);
      setFeedbackTotalPages((res.pagination as any).pages || res.pagination.totalPages || 1);
    } catch (err: any) {
      setFeedbackError(err.message || "Failed to load customer feedback tickets");
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      setLoadingSubscribers(true);
      setSubscriberError(null);
      const res = await getAdminSubscribers({
        page: subscriberPage,
        limit: 15,
        search: subscriberSearch,
        category: categoryFilter,
      });
      setSubscribers(res.subscribers);
      setSubscriberStats(res.stats);
      setSubscriberTotalPages((res.pagination as any).pages || res.pagination.totalPages || 1);
    } catch (err: any) {
      setSubscriberError(err.message || "Failed to load launch subscribers");
    } finally {
      setLoadingSubscribers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "inquiries") {
      fetchFeedbacks();
    } else {
      fetchSubscribers();
    }
  }, [activeTab, feedbackPage, statusFilter, ratingFilter, subscriberPage, categoryFilter]);

  const handleToggleStatus = async (fb: AdminFeedback) => {
    try {
      const nextStatus = fb.status === "resolved" ? "open" : "resolved";
      await toggleFeedbackStatus(fb._id, nextStatus);
      fetchFeedbacks();
    } catch (err: any) {
      alert(err.message || "Failed to toggle status");
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer inquiry?")) return;
    try {
      await deleteFeedback(id);
      fetchFeedbacks();
    } catch (err: any) {
      alert(err.message || "Failed to delete feedback");
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!window.confirm("Remove this subscriber from the VIP list?")) return;
    try {
      await deleteAdminSubscriber(id);
      fetchSubscribers();
    } catch (err: any) {
      alert(err.message || "Failed to delete subscriber");
    }
  };

  const handleOpenReply = (fb: AdminFeedback) => {
    setReplyingFeedback(fb);
    setReplyMessage(
      fb.adminReply ||
        `Hello ${fb.name || "there"},\n\nThank you for reaching out to AgriCola. We have reviewed your feedback regarding our store.\n\n`
    );
    setReplyError(null);
    setReplySuccess(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingFeedback) return;
    if (!replyMessage.trim()) {
      setReplyError("Please enter your reply message.");
      return;
    }

    try {
      setSubmittingReply(true);
      setReplyError(null);
      await replyToFeedback(replyingFeedback._id, replyMessage.trim());
      setReplySuccess("Reply sent successfully to the customer!");
      setTimeout(() => {
        setReplyingFeedback(null);
        fetchFeedbacks();
      }, 1200);
    } catch (err: any) {
      setReplyError(err.message || "Failed to send email reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <HelpCircle className="w-7 h-7 text-[#84b817]" />
            Customer Support & Inquiries
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage customer feedback, resolve support inquiries, and view upcoming collection subscribers.
          </p>
        </div>

        <button
          onClick={() => (activeTab === "inquiries" ? fetchFeedbacks() : fetchSubscribers())}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-xs self-start cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Inquiries</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900">{feedbackStats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">All customer messages</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Open / Pending</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-amber-600">{feedbackStats.open}</p>
            <p className="text-xs text-gray-500 mt-0.5">Needs admin response</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Resolved</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-emerald-600">{feedbackStats.resolved}</p>
            <p className="text-xs text-gray-500 mt-0.5">Completed inquiries</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">VIP Launch Leads</span>
            <div className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-green-700">{subscriberStats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Utensils &amp; Gardening waitlist</p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("inquiries")}
          className={`py-3 px-6 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "inquiries"
              ? "border-[#84b817] text-[#84b817]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Customer Inquiries &amp; Feedback ({feedbackStats.total})</span>
        </button>

        <button
          onClick={() => setActiveTab("subscribers")}
          className={`py-3 px-6 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "subscribers"
              ? "border-[#84b817] text-[#84b817]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Launch Subscribers (Utensils &amp; Gardening) ({subscriberStats.total})</span>
        </button>
      </div>

      {/* TAB 1: INQUIRIES & FEEDBACK */}
      {activeTab === "inquiries" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer name, email, or message…"
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchFeedbacks()}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open / Pending</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium"
              >
                <option value="all">All Ratings</option>
                <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                <option value="3">⭐⭐⭐ 3 Stars</option>
              </select>
            </div>

            <button
              onClick={fetchFeedbacks}
              className="px-4 py-2 bg-[#84b817] hover:bg-[#6d9913] text-white text-sm font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Apply Filter
            </button>
          </div>

          {/* Feedbacks Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            {loadingFeedbacks ? (
              <div className="p-16 text-center text-gray-500">
                <RefreshCw className="w-8 h-8 text-[#84b817] animate-spin mx-auto mb-3" />
                <p>Loading inquiries…</p>
              </div>
            ) : feedbackError ? (
              <div className="p-12 text-center text-red-600">{feedbackError}</div>
            ) : feedbacks.length === 0 ? (
              <div className="p-16 text-center text-gray-500">
                <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 text-lg">No customer inquiries found</h3>
                <p className="text-sm text-gray-500 mt-1">All tickets are resolved or no entries matched your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Rating</th>
                      <th className="px-6 py-4">Message / Inquiry</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {feedbacks.map((fb) => (
                      <tr key={fb._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{fb.name || "Anonymous Customer"}</p>
                          <p className="text-xs text-gray-500">{fb.email || "No email"}</p>
                          {fb.user?.phone && (
                            <p className="text-xs text-gray-400">{fb.user.phone}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {fb.rating ? (
                            <div className="flex items-center gap-1 text-amber-500">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              <span className="font-bold text-xs text-gray-800">{fb.rating}/5</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No rating</span>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          <p className="text-gray-900 line-clamp-2">{fb.message}</p>
                          {fb.page && (
                            <span className="text-[11px] text-gray-400 mt-1 inline-block">
                              Source: {fb.page}
                            </span>
                          )}
                          {fb.adminReply && (
                            <div className="mt-2 p-2 bg-green-50/80 border border-green-100 rounded-lg text-xs text-green-900">
                              <span className="font-bold text-green-800">Admin Replied: </span>
                              <span className="line-clamp-1">{fb.adminReply}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              fb.status === "resolved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {fb.status === "resolved" ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500" />
                            )}
                            {fb.status === "resolved" ? "Resolved" : "Open"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(fb.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {fb.email && (
                              <button
                                onClick={() => handleOpenReply(fb)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Reply by Email"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleStatus(fb)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                fb.status === "resolved"
                                  ? "text-amber-600 hover:bg-amber-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={fb.status === "resolved" ? "Re-open ticket" : "Mark as Resolved"}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteFeedback(fb._id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Ticket"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {feedbackTotalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>
                  Page {feedbackPage} of {feedbackTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={feedbackPage <= 1}
                    onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    disabled={feedbackPage >= feedbackTotalPages}
                    onClick={() => setFeedbackPage((p) => Math.min(feedbackTotalPages, p + 1))}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VIP LAUNCH SUBSCRIBERS */}
      {activeTab === "subscribers" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subscriber name, email, or phone…"
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchSubscribers()}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium"
              >
                <option value="all">All Collections ({subscriberStats.total})</option>
                <option value="utensils">🍳 Utensils Only ({subscriberStats.utensilsCount})</option>
                <option value="gardening">🌱 Gardening Only ({subscriberStats.gardeningCount})</option>
                <option value="both">✨ Both Collections ({subscriberStats.bothCount})</option>
              </select>
            </div>

            <button
              onClick={fetchSubscribers}
              className="px-4 py-2 bg-[#84b817] hover:bg-[#6d9913] text-white text-sm font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Apply Filter
            </button>
          </div>

          {/* Subscribers Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            {loadingSubscribers ? (
              <div className="p-16 text-center text-gray-500">
                <RefreshCw className="w-8 h-8 text-[#84b817] animate-spin mx-auto mb-3" />
                <p>Loading VIP subscribers…</p>
              </div>
            ) : subscriberError ? (
              <div className="p-12 text-center text-red-600">{subscriberError}</div>
            ) : subscribers.length === 0 ? (
              <div className="p-16 text-center text-gray-500">
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 text-lg">No VIP subscribers registered yet</h3>
                <p className="text-sm text-gray-500 mt-1">Visitors will appear here when they request notification on the upcoming collections.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Subscriber</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Preferred Channel</th>
                      <th className="px-6 py-4">Interested In</th>
                      <th className="px-6 py-4">Registered On</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subscribers.map((sub) => (
                      <tr key={sub._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{sub.name || "VIP Customer"}</p>
                          <p className="text-xs text-gray-500">{sub.email || "No email"}</p>
                          {sub.phone && <p className="text-xs font-mono text-emerald-700 mt-0.5">+91 {sub.phone}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              sub.category === "utensils"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : sub.category === "gardening"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-purple-50 text-purple-800 border border-purple-200"
                            }`}
                          >
                            {sub.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <span className="capitalize font-semibold text-gray-700">{sub.preferredChannel}</span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {sub.interestTags && sub.interestTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {sub.interestTags.map((tag, idx) => (
                                <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Full Collection</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(sub.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {sub.phone && (
                              <a
                                href={`https://wa.me/91${sub.phone}?text=${encodeURIComponent(
                                  `Hello ${sub.name || ""}! Greetings from AgriCola. Regarding your interest in our upcoming collection…`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Open WhatsApp Chat"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteSubscriber(sub._id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete from list"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {subscriberTotalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>
                  Page {subscriberPage} of {subscriberTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={subscriberPage <= 1}
                    onClick={() => setSubscriberPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    disabled={subscriberPage >= subscriberTotalPages}
                    onClick={() => setSubscriberPage((p) => Math.min(subscriberTotalPages, p + 1))}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Reply Modal */}
      {replyingFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#84b817]" />
                <h3 className="font-bold text-gray-900 text-lg">
                  Reply to Customer Inquiry
                </h3>
              </div>
              <button
                onClick={() => setReplyingFeedback(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReply} className="p-6 space-y-4">
              {replyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {replyError}
                </div>
              )}
              {replySuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                  {replySuccess}
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                <p>
                  <strong>Customer:</strong> {replyingFeedback.name || "Anonymous"} &lt;{replyingFeedback.email}&gt;
                </p>
                <p>
                  <strong>Original Message:</strong> {replyingFeedback.message}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Response Message:
                </label>
                <textarea
                  rows={6}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyingFeedback(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReply}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#84b817] hover:bg-[#6d9913] text-white text-sm font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {submittingReply ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Email Response</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
