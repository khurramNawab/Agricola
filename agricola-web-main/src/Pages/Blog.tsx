import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BASE_URL } from "../lib/api";

interface Author {
  name: string;
  avatar?: string;
  role?: string;
}

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  author: Author;
  category: string;
  tags: string[];
  readTime: string;
  viewCount: number;
  featured?: boolean;
  publishedAt?: string;
  createdAt: string;
}

const FALLBACK_ARTICLES: BlogPost[] = [
  {
    _id: "seed-1",
    title: "Why Mithila Foxnuts (Makhana) Carry a Coveted Geographical Indication (GI) Tag",
    slug: "why-mithila-foxnuts-carry-coveted-gi-tag",
    excerpt:
      "Explore how traditional wetland harvesting in Northern Bihar creates nutrient-dense superfood pops with unrivaled crunch and calcium purity.",
    category: "Origins & Heritage",
    coverImage: "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=800&q=80",
    author: { name: "Agricola Agronomist", role: "Heritage Botanist" },
    tags: ["Makhana", "GI Tag", "Mithila", "Superfood"],
    readTime: "4 min read",
    viewCount: 142,
    featured: true,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    _id: "seed-2",
    title: "The Science of Cold-Pressed Mustard Oil: Wood Ghani vs Modern Industrial Mills",
    slug: "science-of-cold-pressed-mustard-oil",
    excerpt:
      "Why temperature-controlled crushing below 40°C preserves critical pungent allylisothiocyanates and healthy monounsaturated fatty acids.",
    category: "Superfood Science",
    coverImage: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80",
    author: { name: "Dr. Ananya Sen", role: "Nutritional Biochemist" },
    tags: ["Mustard Oil", "Wood Ghani", "Cold Pressed"],
    readTime: "5 min read",
    viewCount: 238,
    featured: false,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    _id: "seed-3",
    title: "Understanding High Curcumin Turmeric: The Lakadong Harvest Story",
    slug: "understanding-high-curcumin-turmeric-lakadong",
    excerpt:
      "Grown in the pristine Jaintia Hills of Meghalaya, discover why 7.8% organic curcumin levels deliver superior anti-inflammatory potency.",
    category: "Farm Provenance",
    coverImage: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80",
    author: { name: "Devraj Roy", role: "Supply Provenance Lead" },
    tags: ["Turmeric", "Curcumin", "Meghalaya"],
    readTime: "6 min read",
    viewCount: 189,
    featured: false,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
];

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "All";

  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Dynamic page SEO
    document.title = "Journal & Harvest Chronicles • AgriCola Pure Living";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Explore agricultural science, single-origin superfoods, and clean living guides from the AgriCola editorial team."
      );
    }
  }, []);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("page", String(page));
      params.set("limit", "9");

      const [blogsRes, catsRes] = await Promise.all([
        fetch(`${BASE_URL}/blogs?${params.toString()}`),
        fetch(`${BASE_URL}/blogs/categories`)
      ]);

      const blogsData = await blogsRes.json();
      const catsData = await catsRes.json();

      if (blogsData.success && blogsData.data && blogsData.data.length > 0) {
        setArticles(blogsData.data);
        setTotalPages(blogsData.pagination?.pages || 1);
      } else if (activeCategory === "All" && !searchQuery.trim()) {
        // Fallback to beautiful curated seed articles if empty database
        setArticles(FALLBACK_ARTICLES);
      } else {
        setArticles([]);
      }

      if (catsData.success && catsData.data) {
        setCategories(catsData.data);
      }
    } catch (err) {
      console.warn("Could not fetch blogs, using fallback", err);
      setArticles(FALLBACK_ARTICLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, [activeCategory, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchBlogs();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryChange = (cat: string) => {
    setPage(1);
    if (cat === "All") {
      searchParams.delete("category");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category: cat });
    }
  };

  // Get featured article (if any)
  const featuredArticle = articles.find((a) => a.featured) || articles[0];
  const gridArticles = articles.filter((a) => a._id !== featuredArticle?._id);

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        {/* Top Breadcrumbs */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/" className="hover:text-[#486800] transition flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">home</span>
              <span>Home</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#84b817] font-bold">Harvest Journal &amp; Stories</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-[#84b817]">menu_book</span>
            <span className="text-xs font-bold text-[#434936]">
              Single-Origin Chronicles
            </span>
          </div>
        </section>

        {/* Hero Banner Section */}
        <section className="bg-white rounded-3xl p-6 sm:p-12 shadow-xs border border-gray-100 mb-10 text-center max-w-4xl mx-auto relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#c9ecc4]/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#84b817]/10 rounded-full blur-3xl pointer-events-none" />

          <span className="inline-block text-[11px] uppercase font-extrabold text-[#1e3a1f] tracking-widest bg-[#c9ecc4]/70 px-4 py-1.5 rounded-full mb-3">
            The AgriCola Harvest Journal
          </span>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#1e3a1f] tracking-tight mb-4">
            Stories from the Soil &amp; Harvest Labs
          </h1>
          <p className="text-xs sm:text-sm text-[#434936] leading-relaxed max-w-2xl mx-auto mb-6">
            Deep-dives into indigenous agricultural genetics, cold-pressed science, GI heritage, and clean ancestral nutrition.
          </p>

          {/* Search bar */}
          <div className="relative max-w-md mx-auto">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search topics, ingredients, farm stories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#fbf9f6] border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:border-[#84b817] shadow-inner"
            />
          </div>
        </section>

        {/* Category Pills Tab Bar */}
        <section className="mb-10 overflow-x-auto pb-2 flex items-center gap-2 scrollbar-none">
          <button
            onClick={() => handleCategoryChange("All")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition shrink-0 ${
              activeCategory === "All"
                ? "bg-[#1e3a1f] text-white shadow-xs"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All Chronicles
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryChange(cat.name)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeCategory.toLowerCase() === cat.name.toLowerCase()
                  ? "bg-[#84b817] text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeCategory.toLowerCase() === cat.name.toLowerCase()
                    ? "bg-white/30 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </section>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-[#84b817] border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-gray-500">Loading articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 p-8 max-w-md mx-auto">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">article</span>
            <h3 className="text-base font-bold text-[#1e3a1f]">No articles found</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Try exploring other categories or clearing your search keywords.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                handleCategoryChange("All");
              }}
              className="px-4 py-2 bg-[#84b817] text-white text-xs font-bold rounded-xl"
            >
              View All Articles
            </button>
          </div>
        ) : (
          <>
            {/* Featured Article Hero (if on page 1 and no search query) */}
            {page === 1 && !searchQuery.trim() && featuredArticle && (
              <section className="mb-12">
                <Link
                  to={`/blog/${featuredArticle.slug}`}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 grid grid-cols-1 lg:grid-cols-12 gap-0 group"
                >
                  <div className="lg:col-span-7 h-64 sm:h-80 lg:h-full bg-[#f5f3f0] overflow-hidden relative min-h-[260px]">
                    {featuredArticle.coverImage ? (
                      <img
                        src={featuredArticle.coverImage}
                        alt={featuredArticle.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <span className="material-symbols-outlined text-5xl">image</span>
                      </div>
                    )}
                    <span className="absolute top-4 left-4 bg-[#1e3a1f] text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow">
                      ⭐ Featured Story
                    </span>
                  </div>

                  <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                        <span className="text-[#84b817] font-bold uppercase tracking-wider">
                          {featuredArticle.category}
                        </span>
                        <span>•</span>
                        <span>{featuredArticle.readTime || "4 min read"}</span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-[#1e3a1f] leading-snug group-hover:text-[#84b817] transition">
                        {featuredArticle.title}
                      </h2>

                      <p className="text-xs sm:text-sm text-[#434936] leading-relaxed line-clamp-4">
                        {featuredArticle.excerpt}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#1e3a1f] flex items-center justify-center text-xs font-bold">
                          {featuredArticle.author?.name ? featuredArticle.author.name[0].toUpperCase() : "A"}
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-[#1e3a1f]">
                            {featuredArticle.author?.name || "Agricola Team"}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {featuredArticle.author?.role || "Editorial"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center text-xs font-bold text-[#84b817] gap-1 group-hover:translate-x-1 transition-transform">
                        <span>Read Full Story</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {/* Articles Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {(page === 1 && !searchQuery.trim() ? gridArticles : articles).map((art) => (
                <article
                  key={art._id}
                  className="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-1 group"
                >
                  <Link to={`/blog/${art.slug}`}>
                    <div className="h-52 bg-[#f5f3f0] overflow-hidden relative">
                      {art.coverImage ? (
                        <img
                          src={art.coverImage}
                          alt={art.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <span className="material-symbols-outlined text-4xl">article</span>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold uppercase text-[#1e3a1f] shadow-2xs">
                        {art.category}
                      </span>
                    </div>

                    <div className="p-5 sm:p-6 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                        <span>
                          {art.publishedAt
                            ? new Date(art.publishedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              })
                            : "Recent"}
                        </span>
                        <span>•</span>
                        <span>{art.readTime || "4 min read"}</span>
                      </div>

                      <h2 className="text-base font-extrabold text-[#1e3a1f] leading-snug line-clamp-2 group-hover:text-[#84b817] transition">
                        {art.title}
                      </h2>

                      <p className="text-xs text-[#434936] leading-relaxed line-clamp-3">
                        {art.excerpt}
                      </p>
                    </div>
                  </Link>

                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 flex items-center justify-between border-t border-gray-50 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-50 text-[#1e3a1f] flex items-center justify-center text-[10px] font-bold">
                        {art.author?.name ? art.author.name[0].toUpperCase() : "A"}
                      </div>
                      <span className="text-[11px] font-medium text-gray-500">
                        {art.author?.name || "Agricola"}
                      </span>
                    </div>

                    <Link
                      to={`/blog/${art.slug}`}
                      className="flex items-center text-xs font-bold text-[#84b817] gap-1 group-hover:translate-x-1 transition-transform"
                    >
                      <span>Read</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </Link>
                  </div>
                </article>
              ))}
            </section>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1e3a1f] hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-semibold text-gray-500 px-3">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1e3a1f] hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
