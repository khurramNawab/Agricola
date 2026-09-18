import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  Search,
  Calendar,
  Layers,
  Video,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { sanitizeZeroSafeNumber, zeroSafeInputProps } from "../../lib/zeroSafe";
import {
  getAdminCampaigns,
  createAdminCampaign,
  updateAdminCampaign,
  deleteAdminCampaign,
  toggleAdminCampaign,
  type AdminHeroCampaign,
  type HeroCampaignPayload,
  type HeroSlide,
} from "../api/adminApi";
import MediaUploadField from "../components/MediaUploadField";

const FESTIVAL_PRESETS = [
  { id: "diwali", label: "🪔 Diwali Dhamaka" },
  { id: "durga_puja", label: "🌸 Durga Puja" },
  { id: "chhath", label: "🌅 Chhath Puja" },
  { id: "eid", label: "🌙 Eid Specials" },
  { id: "christmas", label: "🎄 Christmas & New Year" },
  { id: "republic_day", label: "🇮🇳 Republic Day" },
  { id: "independence_day", label: "🇮🇳 Independence Day" },
  { id: "holi", label: "🎨 Holi Festival" },
  { id: "seasonal", label: "🌾 Seasonal Harvest" },
  { id: "other", label: "✨ Special Campaign" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<AdminHeroCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdminHeroCampaign | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalWarning, setModalWarning] = useState<string | null>(null);

  // Video accordion in modal
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [togglingVideoId, setTogglingVideoId] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState<HeroCampaignPayload>({
    name: "",
    festivalType: "diwali",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split("T")[0],
    priority: 1,
    isActive: true,
    slides: [
      {
        image: "/assets/makhana1.png",
        title: "Jumbo Phool Makhana (Raw Sun-Dried)",
        description: "Direct from partner farms in Mithila, Bihar. 100% natural, GI tagged.",
        ctaText: "Explore Fresh Harvest",
        ctaLink: "/products?category=makhana",
        order: 0,
      },
    ],
    videoModule: {
      isEnabled: false,
      title: "Experience The Craft of Pure Living",
      subtitle: "Watch how our organic produce is harvested and packed with care.",
      videoType: "url",
      videoUrl: "",
      autoplay: false,
      muted: true,
      loop: true,
      position: "hero_banner",
    },
  });

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminCampaigns({
        page,
        limit: 15,
        search,
        status: statusFilter,
      });
      setCampaigns(res.campaigns);
      setTotalPages(res.pagination.pages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [page, statusFilter]);

  const handleToggleCampaignVideo = async (c: AdminHeroCampaign) => {
    try {
      setTogglingVideoId(c.id);
      const nextEnabled = !c.videoModule?.isEnabled;
      await updateAdminCampaign(c.id, {
        videoModule: {
          title: c.videoModule?.title || "Spotlight Video",
          subtitle: c.videoModule?.subtitle || "",
          videoType: (c.videoModule?.videoType as any) || "url",
          videoUrl: c.videoModule?.videoUrl || "",
          isEnabled: nextEnabled,
        },
      });
      await fetchCampaigns();
      if (nextEnabled && !c.videoModule?.videoUrl) {
        alert("Video Spotlight is now ON! Please click the Edit icon on this campaign to add a YouTube link or MP4 video URL so it plays on the storefront.");
      }
    } catch (err: any) {
      alert("Failed to toggle video: " + (err.message || "Unknown error"));
    } finally {
      setTogglingVideoId(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingCampaign(null);
    setFormData({
      name: "",
      festivalType: "diwali",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split("T")[0],
      priority: 1,
      isActive: true,
      slides: [
        {
          image: "/assets/makhana1.png",
          title: "Jumbo Phool Makhana (Raw Sun-Dried)",
          description: "Direct from partner farms in Mithila, Bihar. 100% natural, GI tagged.",
          ctaText: "Explore Fresh Harvest",
          ctaLink: "/products?category=makhana",
          order: 0,
        },
      ],
      videoModule: {
        isEnabled: false,
        title: "Experience The Craft of Pure Living",
        subtitle: "Watch how our organic produce is harvested and packed with care.",
        videoType: "url",
        videoUrl: "",
        autoplay: false,
        muted: true,
        loop: true,
        position: "hero_banner",
      },
    });
    setModalError(null);
    setModalWarning(null);
    setShowVideoSettings(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: AdminHeroCampaign) => {
    setEditingCampaign(c);
    setFormData({
      name: c.name,
      festivalType: c.festivalType || "other",
      startDate: c.startDate ? c.startDate.split("T")[0] : "",
      endDate: c.endDate ? c.endDate.split("T")[0] : "",
      priority: c.priority || 0,
      isActive: c.isActive,
      slides: c.slides && c.slides.length > 0 ? c.slides : [
        {
          image: "",
          title: "",
          description: "",
          ctaText: "Shop Products",
          ctaLink: "/products",
          order: 0,
        }
      ],
      videoModule: c.videoModule || {
        isEnabled: false,
        videoType: "url",
        videoUrl: "",
        autoplay: false,
        muted: true,
        loop: true,
        position: "hero_banner",
      },
    });
    setShowVideoSettings(Boolean(c.videoModule?.isEnabled));
    setModalError(null);
    setModalWarning(null);
    setIsModalOpen(true);
  };

  const handleAddSlide = () => {
    setFormData((prev) => ({
      ...prev,
      slides: [
        ...prev.slides,
        {
          image: "",
          title: "New Festival Slide",
          description: "Handcrafted natural products for your loved ones.",
          ctaText: "Explore Now",
          ctaLink: "/products",
          order: prev.slides.length,
        },
      ],
    }));
  };

  const handleRemoveSlide = (index: number) => {
    if (formData.slides.length <= 1) {
      alert("Campaign must have at least one hero slide");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index),
    }));
  };

  const handleSlideChange = (index: number, field: keyof HeroSlide, value: any) => {
    setFormData((prev) => ({
      ...prev,
      slides: prev.slides.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalSubmitting(true);
      setModalError(null);

      if (!formData.name.trim()) {
        setModalError("Campaign name is required");
        setModalSubmitting(false);
        return;
      }
      if (formData.slides.some((s) => !s.image.trim() || !s.title.trim())) {
        setModalError("All slides must have an image URL and a title");
        setModalSubmitting(false);
        return;
      }

      if (editingCampaign) {
        await updateAdminCampaign(editingCampaign.id, formData);
      } else {
        await createAdminCampaign(formData);
      }

      setIsModalOpen(false);
      fetchCampaigns();
    } catch (err: any) {
      setModalError(err.message || "Failed to save hero campaign");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleAdminCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, isActive: !c.isActive, status: !c.isActive ? "active" : "inactive" } : c
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to toggle campaign");
    }
  };

  const handleDelete = async (c: AdminHeroCampaign, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete campaign "${c.name}"?`)) {
      return;
    }
    try {
      await deleteAdminCampaign(c.id);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message || "Failed to delete campaign");
    }
  };

  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const hasOverlaps = campaigns.some((c) => c.hasOverlap && c.status === "active");

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#84b817]" />
            Hero Carousel & Festival Campaigns
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage storefront right-side product carousels, banner slides, and festive campaigns.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#84b817] hover:bg-[#729f13] text-white rounded-xl font-medium shadow-sm transition-all text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-lime-50 border border-lime-200 flex items-center justify-center text-[#84b817]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Campaigns</p>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled Upcoming</p>
            <p className="text-2xl font-bold text-gray-900">
              {campaigns.filter((c) => c.status === "upcoming").length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Campaigns</p>
            <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Video Module</p>
            <p className="text-2xl font-bold text-gray-900">
              {campaigns.some((c) => c.status === "active" && c.videoModule?.isEnabled)
                ? "Active 🎬"
                : "Standby"}
            </p>
          </div>
        </div>
      </div>

      {/* Overlapping dates alert */}
      {hasOverlaps && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Schedule Notice:</strong> Multiple active campaigns have overlapping dates. The system automatically renders the campaign with the highest Priority score (or most recently updated).
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {["all", "active", "upcoming", "ended", "inactive"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                statusFilter === tab
                  ? "bg-gray-900 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => fetchCampaigns()}
            title="Refresh"
            className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors ml-1 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#84b817]" : ""}`} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchCampaigns(); }} className="w-full md:w-72 relative">
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#84b817] mb-2" />
            Loading campaigns...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900">No campaigns found</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Schedule your first festival hero banner or video campaign.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#84b817] text-white rounded-xl text-sm font-medium hover:bg-[#729f13] transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 table-fixed">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                <tr>
                  <th className="w-[28%] px-6 py-4">Campaign &amp; Festival</th>
                  <th className="w-[18%] px-6 py-4">Hero Slides</th>
                  <th className="w-[18%] px-6 py-4">Schedule Dates</th>
                  <th className="w-[18%] px-6 py-4">Video Spotlight</th>
                  <th className="w-[12%] px-6 py-4">Priority &amp; Status</th>
                  <th className="w-[8%] px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => {
                  const isCurActive = c.status === "active";

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Name & Festival */}
                      <td className="px-6 py-4 align-middle">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          <span className="text-base">
                            {FESTIVAL_PRESETS.find((p) => p.id === c.festivalType)?.label.split(" ")[0] || "✨"}
                          </span>
                          {c.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 capitalize">
                          Type: {c.festivalType.replace("_", " ")}
                        </div>
                        {c.hasOverlap && isCurActive && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-500" /> Overlaps date
                          </span>
                        )}
                      </td>

                      {/* Slides preview */}
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-2 overflow-hidden">
                            {(c.slides || []).slice(0, 3).map((s, idx) => (
                              <img
                                key={idx}
                                src={s.image}
                                alt={s.title}
                                className="inline-block h-8 w-12 rounded object-cover border border-white shadow-xs"
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-700 ml-2">
                            {c.slidesCount} slide(s)
                          </span>
                        </div>
                      </td>

                      {/* Schedule Dates */}
                      <td className="px-6 py-4 text-xs text-gray-600 align-middle">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {new Date(c.startDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            &rarr;{" "}
                            {new Date(c.endDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Video Toggle Action */}
                      <td className="px-6 py-4 text-xs align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => handleToggleCampaignVideo(c)}
                            disabled={togglingVideoId === c.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
                              c.videoModule?.isEnabled
                                ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"
                            }`}
                            title={c.videoModule?.isEnabled ? "Video is currently ON. Click to turn OFF and show normal photo only." : "Video is OFF (Normal photo shown). Click to turn video ON."}
                          >
                            <Video className={`w-3.5 h-3.5 ${c.videoModule?.isEnabled ? "text-emerald-600" : "text-gray-400"}`} />
                            <span>
                              {togglingVideoId === c.id
                                ? "Updating…"
                                : c.videoModule?.isEnabled
                                ? "Video On (Turn Off)"
                                : "Photo Only (Turn On)"}
                            </span>
                          </button>
                          {c.videoModule?.isEnabled && !c.videoModule?.videoUrl && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="text-[10px] text-amber-700 hover:text-amber-900 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                              title="Click to add video URL in edit mode"
                            >
                              <span>⚠️ Add video URL in Edit</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status & Priority */}
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          {c.status === "active" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active Now
                            </span>
                          ) : c.status === "upcoming" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Clock className="w-3 h-3 text-blue-500" /> Upcoming
                            </span>
                          ) : c.status === "ended" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                              <Clock className="w-3 h-3 text-gray-400" /> Ended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                              <XCircle className="w-3 h-3 text-red-400" /> Inactive
                            </span>
                          )}

                          <button
                            onClick={(e) => handleToggle(c.id, e)}
                            title={c.isActive ? "Deactivate" : "Activate"}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              c.isActive ? "bg-[#84b817]" : "bg-gray-300"
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                                c.isActive ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(c, e)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#84b817]" />
                <h3 className="font-bold text-gray-900 text-lg">
                  {editingCampaign ? "Edit Festival Campaign" : "Create Festival Hero Campaign"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-6 space-y-5 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                  {modalError}
                </div>
              )}
              {modalWarning && (
                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                  {modalWarning}
                </div>
              )}

              {/* Campaign Name & Festival Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Campaign Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diwali Grand Organic Dhamaka"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Festival Preset *
                  </label>
                  <select
                    value={formData.festivalType}
                    onChange={(e) => setFormData({ ...formData, festivalType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  >
                    {FESTIVAL_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Priority Score
                  </label>
                  <input
                    type="text"
                    {...zeroSafeInputProps}
                    placeholder="0"
                    value={formData.priority === 0 ? "0" : (formData.priority || "")}
                    onChange={(e) => {
                      const clean = sanitizeZeroSafeNumber(e.target.value);
                      setFormData({ ...formData, priority: clean === "" ? ("" as any) : Number(clean) });
                    }}
                    onBlur={() => {
                      if (formData.priority === ("" as any)) {
                        setFormData((prev) => ({ ...prev, priority: 0 }));
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                  />
                </div>
              </div>

              {/* Hero Slides Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#84b817]" />
                    Hero Carousel Slides ({formData.slides.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="text-xs font-semibold text-[#84b817] hover:text-[#5f870e] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Slide
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.slides.map((slide, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                        <span>Slide #{idx + 1}</span>
                        {formData.slides.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlide(idx)}
                            className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <MediaUploadField
                          label="Slide Image (Right Carousel)"
                          required
                          mediaType="image"
                          folder="campaigns"
                          placeholder="e.g. /assets/makhana1.png or upload image"
                          value={slide.image}
                          onChange={(url) => handleSlideChange(idx, "image", url)}
                        />

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            Slide Headline Title *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Pure Festive Sweets & Delicacies"
                            value={slide.title}
                            onChange={(e) => handleSlideChange(idx, "title", e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            CTA Button Text
                          </label>
                          <input
                            type="text"
                            placeholder="Shop Specials"
                            value={slide.ctaText}
                            onChange={(e) => handleSlideChange(idx, "ctaText", e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            CTA Target Link
                          </label>
                          <input
                            type="text"
                            placeholder="/products"
                            value={slide.ctaLink}
                            onChange={(e) => handleSlideChange(idx, "ctaLink", e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            Description / Subtitle
                          </label>
                          <input
                            type="text"
                            placeholder="Handmade organic treats"
                            value={slide.description}
                            onChange={(e) => handleSlideChange(idx, "description", e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Module Section (Accordion) */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowVideoSettings(!showVideoSettings)}
                  className="w-full p-4 bg-gray-50 flex items-center justify-between text-left font-bold text-xs uppercase tracking-wider text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#84b817]" />
                    <span>Homepage Spotlight Video Module</span>
                    {formData.videoModule?.isEnabled && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        ENABLED
                      </span>
                    )}
                  </div>
                  {showVideoSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showVideoSettings && (
                  <div className="p-4 space-y-4 bg-white border-t border-gray-200">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.videoModule?.isEnabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            videoModule: {
                              ...formData.videoModule!,
                              isEnabled: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-[#84b817] rounded border-gray-300 focus:ring-[#84b817]"
                      />
                      Enable Video Module for this campaign
                    </label>

                    {formData.videoModule?.isEnabled && (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                              Video Headline
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Experience The Farm Craft"
                              value={formData.videoModule?.title || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  videoModule: { ...formData.videoModule!, title: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                              Video Source Type
                            </label>
                            <select
                              value={formData.videoModule?.videoType}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  videoModule: {
                                    ...formData.videoModule!,
                                    videoType: e.target.value as any,
                                  },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                            >
                              <option value="url">Direct MP4 / WebM Video URL</option>
                              <option value="youtube">YouTube Embed Link</option>
                            </select>
                          </div>
                        </div>

                        <MediaUploadField
                          label="Video Source / Upload File"
                          required
                          mediaType={formData.videoModule?.videoType === "youtube" ? "both" : "video"}
                          folder="campaign_videos"
                          placeholder="https://www.youtube.com/watch?v=... or upload MP4/WebM file"
                          value={formData.videoModule?.videoUrl || ""}
                          onChange={(url) =>
                            setFormData({
                              ...formData,
                              videoModule: {
                                ...formData.videoModule!,
                                videoUrl: url,
                                videoType:
                                  url.includes("youtube.com") || url.includes("youtu.be") ? "youtube" : "url",
                              },
                            })
                          }
                        />

                        <div className="flex flex-wrap gap-4 pt-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.videoModule?.autoplay}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  videoModule: { ...formData.videoModule!, autoplay: e.target.checked },
                                })
                              }
                              className="w-3.5 h-3.5 text-[#84b817] rounded"
                            />
                            Autoplay
                          </label>

                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.videoModule?.muted}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  videoModule: { ...formData.videoModule!, muted: e.target.checked },
                                })
                              }
                              className="w-3.5 h-3.5 text-[#84b817] rounded"
                            />
                            Muted by default (Recommended)
                          </label>

                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.videoModule?.loop}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  videoModule: { ...formData.videoModule!, loop: e.target.checked },
                                })
                              }
                              className="w-3.5 h-3.5 text-[#84b817] rounded"
                            />
                            Loop playback
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-[#84b817] hover:bg-[#729f13] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? "Saving..." : editingCampaign ? "Update Campaign" : "Publish Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
