import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  content: string;
  coverImage?: string;
  author: Author;
  category: string;
  tags: string[];
  readTime: string;
  viewCount: number;
  featured?: boolean;
  publishedAt?: string;
  createdAt: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    canonicalUrl?: string;
  };
}

interface RelatedPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  author: Author;
  category: string;
  tags: string[];
  readTime: string;
  publishedAt?: string;
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();

  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!slug) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${BASE_URL}/blogs/${slug}`);
        const data = await res.json();

        if (!res.ok || !data.success || !data.data?.blog) {
          setError(data.message || "Article not found");
          return;
        }

        setBlog(data.data.blog);
        setRelated(data.data.related || []);
      } catch (err: any) {
        setError(err.message || "Failed to load article");
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  // Dynamic SEO meta tags and Schema.org JSON-LD injection
  useEffect(() => {
    if (!blog) return;

    // Title
    const originalTitle = document.title;
    const pageTitle = blog.seo?.metaTitle || `${blog.title} • AgriCola Harvest Journal`;
    document.title = pageTitle;

    // Meta Description
    const metaDescTag = document.querySelector('meta[name="description"]');
    const pageDesc = blog.seo?.metaDescription || blog.excerpt || "";
    if (metaDescTag) {
      metaDescTag.setAttribute("content", pageDesc);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = pageDesc;
      document.head.appendChild(meta);
    }

    // OpenGraph Meta
    const ogTags = [
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDesc },
      { property: "og:image", content: blog.coverImage || "https://agricola-images.s3.us-east-1.amazonaws.com/well_being_products.png" },
      { property: "og:url", content: window.location.href },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: pageDesc },
      { name: "twitter:image", content: blog.coverImage || "" }
    ];

    const addedTags: Element[] = [];
    ogTags.forEach((t) => {
      const key = t.property ? `property="${t.property}"` : `name="${t.name}"`;
      let tag = document.querySelector(`meta[${key}]`);
      if (tag) {
        tag.setAttribute("content", t.content);
      } else {
        tag = document.createElement("meta");
        if (t.property) tag.setAttribute("property", t.property);
        if (t.name) tag.setAttribute("name", t.name);
        tag.setAttribute("content", t.content);
        document.head.appendChild(tag);
        addedTags.push(tag);
      }
    });

    // Schema.org Article Structured Data (JSON-LD)
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": blog.title,
      "description": blog.excerpt,
      "image": [blog.coverImage || ""],
      "datePublished": blog.publishedAt || blog.createdAt,
      "dateModified": blog.publishedAt || blog.createdAt,
      "author": {
        "@type": "Person",
        "name": blog.author?.name || "Agricola Editorial"
      },
      "publisher": {
        "@type": "Organization",
        "name": "AgriCola",
        "logo": {
          "@type": "ImageObject",
          "url": "https://agricola-images.s3.us-east-1.amazonaws.com/logo.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": window.location.href
      }
    };

    const scriptTag = document.createElement("script");
    scriptTag.type = "application/ld+json";
    scriptTag.id = "blog-article-jsonld";
    scriptTag.text = JSON.stringify(jsonLdData);
    document.head.appendChild(scriptTag);

    return () => {
      document.title = originalTitle;
      const jsonLd = document.getElementById("blog-article-jsonld");
      if (jsonLd) jsonLd.remove();
    };
  }, [blog]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = `Check out this article on AgriCola: *${blog?.title}*\n${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareTwitter = () => {
    const text = `${blog?.title} via @AgriCola_India`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
        window.location.href
      )}`,
      "_blank"
    );
  };

  const handleShareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        window.location.href
      )}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-3 border-[#84b817] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold text-[#1e3a1f]">Harvesting article...</p>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">article</span>
        </div>
        <h2 className="text-xl font-bold text-[#1e3a1f] mb-2">Article Not Found</h2>
        <p className="text-xs text-[#434936] mb-6">
          The article you are looking for might have been moved or unpublished.
        </p>
        <Link
          to="/blog"
          className="px-5 py-2.5 bg-[#84b817] hover:bg-[#72a014] text-white text-xs font-bold rounded-xl transition"
        >
          Explore All Articles
        </Link>
      </div>
    );
  }

  const formattedDate = blog.publishedAt
    ? new Date(blog.publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : new Date(blog.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });

  return (
    <article className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        {/* Top Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936] mb-6 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-[#486800] transition flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">home</span>
            <span>Home</span>
          </Link>
          <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
          <Link to="/blog" className="hover:text-[#486800] transition">
            Journal
          </Link>
          <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
          <span className="text-[#84b817] font-bold truncate max-w-[200px]">
            {blog.category}
          </span>
        </nav>

        {/* Header Content */}
        <header className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] uppercase font-bold text-[#1e3a1f] tracking-wider bg-[#c9ecc4]/80 px-3 py-1 rounded-full">
              {blog.category}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#84b817]">schedule</span>
              {blog.readTime || "4 min read"}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-medium text-gray-400">{formattedDate}</span>
            {blog.viewCount > 0 && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  {blog.viewCount} views
                </span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#1e3a1f] tracking-tight leading-[1.18]">
            {blog.title}
          </h1>

          <p className="text-sm sm:text-base text-[#434936] leading-relaxed font-normal">
            {blog.excerpt}
          </p>

          {/* Author Bar & Social Share */}
          <div className="pt-4 border-t border-gray-200/70 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1e3a1f] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {blog.author?.name ? blog.author.name[0].toUpperCase() : "A"}
              </div>
              <div>
                <div className="text-xs font-bold text-[#1e3a1f]">
                  {blog.author?.name || "Agricola Editorial"}
                </div>
                <div className="text-[11px] text-gray-500">
                  {blog.author?.role || "Organic Nutrition Specialist"}
                </div>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">
                Share:
              </span>
              <button
                onClick={handleShareWhatsApp}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                title="Share on WhatsApp"
              >
                <span className="material-symbols-outlined text-base">chat</span>
              </button>
              <button
                onClick={handleShareTwitter}
                className="p-1.5 text-sky-500 hover:bg-sky-50 rounded-xl transition"
                title="Share on X / Twitter"
              >
                <span className="material-symbols-outlined text-base">share</span>
              </button>
              <button
                onClick={handleShareLinkedIn}
                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-xl transition"
                title="Share on LinkedIn"
              >
                <span className="material-symbols-outlined text-base">work</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-xl transition relative"
                title="Copy Link"
              >
                <span className="material-symbols-outlined text-base">
                  {copied ? "check" : "link"}
                </span>
                {copied && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Featured Cover Image */}
        {blog.coverImage && (
          <div className="mb-10 rounded-3xl overflow-hidden shadow-md border border-gray-200/80 aspect-[16/9] max-h-[460px] bg-[#f5f3f0]">
            <img
              src={blog.coverImage}
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Body Content */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-gray-100 mb-10">
          <div
            className="prose prose-sm sm:prose-base max-w-none text-[#2d3748] 
              prose-headings:text-[#1e3a1f] prose-headings:font-black prose-headings:tracking-tight
              prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg sm:prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-p:leading-relaxed prose-p:mb-4 prose-p:text-[#374151]
              prose-ul:my-4 prose-ul:list-disc prose-ul:pl-5
              prose-li:my-1.5 prose-li:text-[#374151]
              prose-blockquote:border-l-4 prose-blockquote:border-[#84b817] prose-blockquote:bg-[#fbf9f6] prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-2xl prose-blockquote:italic prose-blockquote:text-[#1e3a1f] prose-blockquote:my-6
              prose-strong:text-[#1e3a1f] prose-strong:font-bold
              prose-img:rounded-2xl prose-img:shadow-sm"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />

          {/* Tags */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">
                Topics:
              </span>
              {blog.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-[#434936] hover:bg-[#c9ecc4]/50 transition cursor-default"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* AgriCola Mission & Farm CTA Box */}
        <section className="bg-gradient-to-br from-[#1e3a1f] to-[#122413] rounded-3xl p-8 text-white shadow-md mb-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#84b817] bg-white/10 px-3 py-1 rounded-full inline-block">
              Pure Living • Zero Compromise
            </span>
            <h3 className="text-xl sm:text-2xl font-black">Experience The Pure Farm Harvest</h3>
            <p className="text-xs sm:text-sm text-gray-300 max-w-md">
              From stone-ground spices to wood-churned cold pressed oils, explore products crafted for pure nutrition.
            </p>
          </div>
          <Link
            to="/products"
            className="shrink-0 px-6 py-3 bg-[#84b817] hover:bg-[#72a014] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg hover:shadow-xl"
          >
            Explore Store
          </Link>
        </section>

        {/* Related Articles Section */}
        {related && related.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#1e3a1f] tracking-tight">
                Related Articles &amp; Insights
              </h3>
              <Link
                to="/blog"
                className="text-xs font-bold text-[#84b817] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((rel) => (
                <Link
                  key={rel._id}
                  to={`/blog/${rel.slug}`}
                  className="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-1 group"
                >
                  <div>
                    <div className="h-40 bg-[#f5f3f0] overflow-hidden relative">
                      {rel.coverImage ? (
                        <img
                          src={rel.coverImage}
                          alt={rel.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <span className="material-symbols-outlined text-3xl">image</span>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase text-[#1e3a1f] shadow-2xs">
                        {rel.category}
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                        <span>{rel.readTime || "4 min"}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-[#1e3a1f] leading-snug line-clamp-2 group-hover:text-[#84b817] transition">
                        {rel.title}
                      </h4>
                      <p className="text-xs text-[#434936] leading-relaxed line-clamp-2 mt-0.5">
                        {rel.excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 flex items-center text-xs font-bold text-[#84b817] gap-1">
                    <span>Read Guide</span>
                    <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </article>
  );
}
