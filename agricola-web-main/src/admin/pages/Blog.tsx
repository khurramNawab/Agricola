import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Globe,
  X,
  RefreshCw,
  Star,
  Layers,
  Code,
  Check
} from "lucide-react";
import {
  getAdminBlogs,
  createAdminBlog,
  updateAdminBlog,
  deleteAdminBlog,
  toggleAdminBlogPublish,
  toggleAdminBlogFeatured,
  type AdminBlogPost,
  type AdminBlogStats
} from "../api/adminApi";
import { MediaUploadField } from "../components/MediaUploadField";

const CATEGORY_PRESETS = [
  "Health & Wellness",
  "Organic Farming",
  "Sustainable Living",
  "Recipes & Nutrition",
  "Heritage & Craft",
  "Vedic Agriculture",
  "Product Guides",
  "General"
];

export default function BlogManagerPage() {
  const [blogs, setBlogs] = useState<AdminBlogPost[]>([]);
  const [stats, setStats] = useState<AdminBlogStats>({
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    totalViews: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<AdminBlogPost | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Editor View Mode (edit vs live preview)
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [showSeoSettings, setShowSeoSettings] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    category: "Organic Farming",
    customCategory: "",
    tagsInput: "",
    status: "published" as "draft" | "published",
    featured: false,
    authorName: "Agricola Editorial",
    authorRole: "Organic Food Specialist",
    authorAvatar: "",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
    canonicalUrl: ""
  });

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminBlogs({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        page,
        limit: 12
      });

      setBlogs(res.blogs);
      setStats(res.stats);
      setTotalPages(res.pagination.pages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, [page, statusFilter, categoryFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchBlogs();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Auto-generate slug from title
  const handleTitleChange = (newTitle: string) => {
    setFormData((prev) => {
      const isCustomSlug = prev.slug && prev.slug !== generateSlug(prev.title);
      return {
        ...prev,
        title: newTitle,
        slug: isCustomSlug ? prev.slug : generateSlug(newTitle),
        metaTitle: prev.metaTitle === prev.title ? newTitle : prev.metaTitle || newTitle
      };
    });
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  const openCreateModal = () => {
    setEditingBlog(null);
    setFormData({
      title: "",
      slug: "",
      excerpt: "",
      content: `<h2>The Essence of Natural Cultivation</h2>\n<p>Pure farming goes beyond the absence of synthetic chemicals; it is an active restoration of soil biology and nutritional density.</p>\n<h3>Key Principles:</h3>\n<ul>\n  <li><strong>Zero Chemical Inputs:</strong> 100% certified organic methods.</li>\n  <li><strong>Cold-Pressed Purity:</strong> Preserving micronutrients and essential aromas.</li>\n  <li><strong>Farm-to-Door Traceability:</strong> Knowing exactly where your nourishment comes from.</li>\n</ul>\n<blockquote>"When we heal the soil, the soil heals us in return."</blockquote>`,
      coverImage: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1000",
      category: "Organic Farming",
      customCategory: "",
      tagsInput: "Organic, Sustainable, Health, Soil Health",
      status: "published",
      featured: false,
      authorName: "Agricola Editorial",
      authorRole: "Organic Food Specialist",
      authorAvatar: "",
      metaTitle: "",
      metaDescription: "",
      focusKeyword: "Organic Farming",
      canonicalUrl: ""
    });
    setEditorMode("write");
    setShowSeoSettings(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (blog: AdminBlogPost) => {
    setEditingBlog(blog);
    const isPreset = CATEGORY_PRESETS.includes(blog.category);
    setFormData({
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      content: blog.content,
      coverImage: blog.coverImage || "",
      category: isPreset ? blog.category : "Custom",
      customCategory: isPreset ? "" : blog.category,
      tagsInput: (blog.tags || []).join(", "),
      status: blog.status,
      featured: blog.featured || false,
      authorName: blog.author?.name || "Agricola Editorial",
      authorRole: blog.author?.role || "Organic Food Specialist",
      authorAvatar: blog.author?.avatar || "",
      metaTitle: blog.seo?.metaTitle || blog.title,
      metaDescription: blog.seo?.metaDescription || blog.excerpt,
      focusKeyword: blog.seo?.focusKeyword || "",
      canonicalUrl: blog.seo?.canonicalUrl || ""
    });
    setEditorMode("write");
    setShowSeoSettings(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setModalError("Article title is required");
      return;
    }
    if (!formData.excerpt.trim()) {
      setModalError("Short excerpt is required");
      return;
    }
    if (!formData.content.trim()) {
      setModalError("Article content is required");
      return;
    }

    const finalCategory =
      formData.category === "Custom" && formData.customCategory.trim()
        ? formData.customCategory.trim()
        : formData.category;

    const tagsArray = formData.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Partial<AdminBlogPost> = {
      title: formData.title.trim(),
      slug: formData.slug.trim() || generateSlug(formData.title),
      excerpt: formData.excerpt.trim(),
      content: formData.content,
      coverImage: formData.coverImage,
      category: finalCategory,
      tags: tagsArray,
      status: formData.status,
      featured: formData.featured,
      author: {
        name: formData.authorName.trim() || "Agricola Team",
        role: formData.authorRole.trim() || "Editorial Team",
        avatar: formData.authorAvatar.trim()
      },
      seo: {
        metaTitle: formData.metaTitle.trim() || formData.title.trim(),
        metaDescription: formData.metaDescription.trim() || formData.excerpt.trim(),
        focusKeyword: formData.focusKeyword.trim(),
        canonicalUrl: formData.canonicalUrl.trim()
      }
    };

    try {
      setModalSubmitting(true);
      setModalError(null);

      if (editingBlog) {
        await updateAdminBlog(editingBlog._id, payload);
      } else {
        await createAdminBlog(payload);
      }

      setIsModalOpen(false);
      fetchBlogs();
    } catch (err: any) {
      setModalError(err.message || "Failed to save article");
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleTogglePublish = async (blog: AdminBlogPost) => {
    try {
      await toggleAdminBlogPublish(blog._id);
      setBlogs((prev) =>
        prev.map((b) =>
          b._id === blog._id
            ? { ...b, status: b.status === "published" ? "draft" : "published" }
            : b
        )
      );
      setStats((prev) => ({
        ...prev,
        publishedPosts:
          blog.status === "published" ? prev.publishedPosts - 1 : prev.publishedPosts + 1,
        draftPosts:
          blog.status === "published" ? prev.draftPosts + 1 : prev.draftPosts - 1
      }));
    } catch (err: any) {
      alert("Failed to toggle publish status: " + err.message);
    }
  };

  const handleToggleFeatured = async (blog: AdminBlogPost) => {
    try {
      await toggleAdminBlogFeatured(blog._id);
      setBlogs((prev) =>
        prev.map((b) => (b._id === blog._id ? { ...b, featured: !b.featured } : b))
      );
    } catch (err: any) {
      alert("Failed to toggle featured status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      await deleteAdminBlog(id);
      setDeleteConfirmId(null);
      fetchBlogs();
    } catch (err: any) {
      alert("Failed to delete article: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Insert HTML helper
  const insertHtmlSnippet = (snippet: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content + "\n" + snippet
    }));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#84b817]/10 flex items-center justify-center text-[#84b817]">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Blog & Article Manager
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Create SEO-optimized articles, manage guides, and publish content to your storefront
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBlogs}
            className="p-2.5 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#84b817] hover:bg-[#72a014] text-white font-semibold rounded-xl transition shadow-sm hover:shadow"
          >
            <Plus size={18} />
            <span>Write New Article</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Articles
            </span>
            <Layers size={18} className="text-gray-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">{stats.totalPosts}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Published
            </span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.publishedPosts}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Drafts
            </span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{stats.draftPosts}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Total Views
            </span>
            <Eye size={18} className="text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">
            {stats.totalViews.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, excerpt, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:border-[#84b817]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
          >
            <option value="all">All Categories</option>
            {CATEGORY_PRESETS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Drafts Only</option>
          </select>
        </div>
      </div>

      {/* Blog Posts Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {loading && blogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <RefreshCw size={28} className="animate-spin text-[#84b817]" />
            <p className="text-sm">Loading articles...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 flex flex-col items-center gap-2">
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchBlogs}
              className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100"
            >
              Try Again
            </button>
          </div>
        ) : blogs.length === 0 ? (
          <div className="p-16 text-center text-gray-500 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
              <FileText size={28} />
            </div>
            <h3 className="text-base font-semibold text-gray-800">No blog posts found</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your filters or search keywords."
                : "Start sharing organic lifestyle guides, farm stories, and health tips with your customers."}
            </p>
            <button
              onClick={openCreateModal}
              className="mt-2 px-4 py-2 bg-[#84b817] text-white text-xs font-semibold rounded-xl hover:bg-[#72a014] transition"
            >
              Write Your First Article
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Article</th>
                  <th className="py-3.5 px-4">Category & Tags</th>
                  <th className="py-3.5 px-4">Author</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Featured</th>
                  <th className="py-3.5 px-4 text-center">Views</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {blogs.map((blog) => (
                  <tr key={blog._id} className="hover:bg-gray-50/60 transition group">
                    {/* Article info with thumbnail */}
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-3 min-w-[280px]">
                        <div className="w-16 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                          {blog.coverImage ? (
                            <img
                              src={blog.coverImage}
                              alt={blog.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <FileText size={18} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-gray-900 leading-snug line-clamp-1 group-hover:text-[#84b817] transition">
                            {blog.title}
                          </h4>
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{blog.excerpt}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400 font-mono">
                              /blog/{blog.slug}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[10px] text-gray-400">{blog.readTime}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category & Tags */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-block self-start text-xs font-semibold px-2 py-0.5 rounded-md bg-[#84b817]/10 text-[#84b817]">
                          {blog.category}
                        </span>
                        {blog.tags && blog.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {blog.tags.slice(0, 2).map((t, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"
                              >
                                #{t}
                              </span>
                            ))}
                            {blog.tags.length > 2 && (
                              <span className="text-[10px] text-gray-400">
                                +{blog.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Author */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#1e3a1f] flex items-center justify-center text-xs font-bold shrink-0">
                          {blog.author?.name ? blog.author.name[0].toUpperCase() : "A"}
                        </div>
                        <div className="text-xs">
                          <p className="font-medium text-gray-800">{blog.author?.name || "Agricola"}</p>
                          <p className="text-[10px] text-gray-400">{blog.author?.role || "Team"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleTogglePublish(blog)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                          blog.status === "published"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            blog.status === "published" ? "bg-emerald-600" : "bg-amber-600"
                          }`}
                        />
                        {blog.status === "published" ? "Published" : "Draft"}
                      </button>
                    </td>

                    {/* Featured Toggle */}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleToggleFeatured(blog)}
                        className={`p-1.5 rounded-lg transition ${
                          blog.featured
                            ? "text-amber-500 hover:bg-amber-50"
                            : "text-gray-300 hover:text-gray-400 hover:bg-gray-100"
                        }`}
                        title={blog.featured ? "Featured on Home & Blog Hero" : "Set as featured"}
                      >
                        <Star size={18} fill={blog.featured ? "currentColor" : "none"} />
                      </button>
                    </td>

                    {/* Views */}
                    <td className="py-4 px-4 text-center text-xs font-semibold text-gray-600">
                      {blog.viewCount || 0}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/blog/${blog.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View on website"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button
                          onClick={() => openEditModal(blog)}
                          className="p-1.5 text-gray-400 hover:text-[#84b817] hover:bg-lime-50 rounded-lg transition"
                          title="Edit Article"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(blog._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing {blogs.length} of {totalCount} articles
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="px-2">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#84b817]/10 flex items-center justify-center text-[#84b817]">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingBlog ? "Edit Article" : "Write New Article"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Craft informative, engaging and SEO-boosted content
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-200/60 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveBlog} className="flex-1 overflow-y-auto p-6 space-y-6">
              {modalError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  {modalError}
                </div>
              )}

              {/* Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Article Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 7 Health Benefits of Cold-Pressed Mustard Oil"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:border-[#84b817]"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      URL Slug
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Live preview: <span className="font-mono text-[#84b817]">/blog/{formData.slug || "slug"}</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. cold-pressed-mustard-oil-benefits"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
                  />
                </div>
              </div>

              {/* Short Excerpt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Short Excerpt / Summary <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {formData.excerpt.length}/400 characters
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={400}
                  required
                  placeholder="A concise 1-2 sentence hook for cards, social share previews, and search snippets..."
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
                />
              </div>

              {/* Category, Tags, Status, Featured */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50/70 rounded-2xl border border-gray-200/70">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
                  >
                    {CATEGORY_PRESETS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Custom">+ Custom Category</option>
                  </select>
                  {formData.category === "Custom" && (
                    <input
                      type="text"
                      placeholder="Enter category name"
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      className="w-full px-3 py-1.5 mt-1 bg-white border border-gray-200 rounded-lg text-xs"
                    />
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="Mustard Oil, Wellness, Pure"
                    value={formData.tagsInput}
                    onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Publish Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as "draft" | "published" })
                    }
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40"
                  >
                    <option value="published">🚀 Published (Live)</option>
                    <option value="draft">📝 Draft (Unpublished)</option>
                  </select>
                </div>

                {/* Featured Checkbox */}
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="rounded text-[#84b817] focus:ring-[#84b817]"
                    />
                    <Star
                      size={15}
                      className={formData.featured ? "text-amber-500 fill-amber-500" : "text-gray-400"}
                    />
                    <span>Featured Article</span>
                  </label>
                </div>
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Cover Image
                </label>
                <MediaUploadField
                  label=""
                  value={formData.coverImage}
                  onChange={(url) => setFormData({ ...formData, coverImage: url })}
                  folder="blogs"
                  placeholder="https://images.unsplash.com/... or upload image"
                  helpText="Recommended: 1200x630px high resolution image for crisp display and OpenGraph previews"
                />
              </div>

              {/* Author Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50/70 rounded-2xl border border-gray-200/70">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Author Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh Patel"
                    value={formData.authorName}
                    onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Author Role / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Ayurvedic Nutritionist"
                    value={formData.authorRole}
                    onChange={(e) => setFormData({ ...formData, authorRole: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Content Editor Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Article Body Content (HTML Supported) <span className="text-red-500">*</span>
                  </label>

                  {/* Mode Tabs */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditorMode("write")}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        editorMode === "write"
                          ? "bg-white text-gray-900 shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      <Code size={14} />
                      <span>HTML Editor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("preview")}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        editorMode === "preview"
                          ? "bg-white text-[#84b817] shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      <Eye size={14} />
                      <span>Live Reader Preview</span>
                    </button>
                  </div>
                </div>

                {editorMode === "write" ? (
                  <div className="space-y-2">
                    {/* Quick Snippet Insert Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-100 rounded-xl text-[11px] font-medium text-gray-600">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">Insert:</span>
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet("<h2>Subheading Title</h2>")}
                        className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs"
                      >
                        Heading (H2)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet("<h3>Smaller Heading</h3>")}
                        className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs"
                      >
                        Heading (H3)
                      </button>
                      <button
                        type="button"
                        onClick={() => insertHtmlSnippet("<p>Your paragraph text goes here with all rich insights.</p>")}
                        className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs"
                      >
                        Paragraph
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlSnippet(
                            "<ul>\n  <li><strong>Point 1:</strong> Description here.</li>\n  <li><strong>Point 2:</strong> Description here.</li>\n</ul>"
                          )
                        }
                        className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs"
                      >
                        Bullet List
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlSnippet(
                            "<blockquote>\n  \"A powerful quote or key takeaway highlighting pure wellness.\"\n</blockquote>"
                          )
                        }
                        className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-xs"
                      >
                        Quote
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertHtmlSnippet(
                            `<div class="my-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">\n  <h4 class="font-bold text-sm">💡 Pro Health Tip</h4>\n  <p class="text-xs mt-1">Always store cold-pressed oils in dark glass bottles away from direct sunlight.</p>\n</div>`
                          )
                        }
                        className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg shadow-xs"
                      >
                        + Highlight Callout Box
                      </button>
                    </div>

                    <textarea
                      rows={14}
                      required
                      placeholder="Write your article content using HTML formatting..."
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 leading-relaxed"
                    />
                  </div>
                ) : (
                  <div className="p-6 bg-white border border-gray-200 rounded-2xl min-h-[300px] prose prose-sm max-w-none text-gray-800">
                    <div dangerouslySetInnerHTML={{ __html: formData.content }} />
                  </div>
                )}
              </div>

              {/* SEO & Meta Accordion */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setShowSeoSettings(!showSeoSettings)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100/60 transition"
                >
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-[#84b817]" />
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Search Engine Optimization (SEO) & Social Meta
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-semibold">
                    {showSeoSettings ? "Collapse ▲" : "Expand ▼"}
                  </span>
                </button>

                {showSeoSettings && (
                  <div className="p-5 border-t border-gray-200 space-y-4 bg-white">
                    {/* Google SERP Preview Card */}
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">
                        Google Search Preview
                      </span>
                      <p className="text-xs font-medium text-blue-700 hover:underline cursor-pointer line-clamp-1">
                        {formData.metaTitle || formData.title || "Article Title - AgriCola"}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-mono line-clamp-1">
                        https://agricola.in/blog/{formData.slug || "article-slug"}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {formData.metaDescription ||
                          formData.excerpt ||
                          "A comprehensive guide on natural organic harvesting and cold-pressed purity..."}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700">Meta Title Tag</label>
                        <span className="text-[11px] text-gray-400">
                          {formData.metaTitle.length}/60 chars recommended
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder={formData.title || "Meta Title"}
                        value={formData.metaTitle}
                        onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700">Meta Description</label>
                        <span className="text-[11px] text-gray-400">
                          {formData.metaDescription.length}/160 chars recommended
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={200}
                        placeholder={formData.excerpt || "Meta Description"}
                        value={formData.metaDescription}
                        onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">Focus Keyword</label>
                        <input
                          type="text"
                          placeholder="e.g. cold pressed mustard oil"
                          value={formData.focusKeyword}
                          onChange={(e) => setFormData({ ...formData, focusKeyword: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">Canonical URL (optional)</label>
                        <input
                          type="text"
                          placeholder="https://agricola.in/blog/article-slug"
                          value={formData.canonicalUrl}
                          onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#84b817] hover:bg-[#72a014] text-white text-xs font-bold rounded-xl transition shadow-sm hover:shadow disabled:opacity-50"
                  >
                    {modalSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>{editingBlog ? "Save Changes" : "Create & Publish"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900">Delete Blog Post?</h3>
            <p className="text-xs text-gray-500">
              Are you sure you want to permanently delete this article? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                disabled={deleting}
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
