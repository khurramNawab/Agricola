import { useEffect, useState, useRef, type FormEvent } from "react";
import { X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getProducts, getPopularSearches, type StorefrontProduct } from "../../lib/storefront";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const FALLBACK_POPULAR_TAGS = [
  "Makhana",
  "Chia Seeds",
  "Lakadong Turmeric",
  "Flax Seeds",
  "Mustard Oil",
  "Raw Honey",
];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>(FALLBACK_POPULAR_TAGS);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);

    getPopularSearches()
      .then((tags) => {
        if (tags && tags.length > 0) setPopularTags(tags);
      })
      .catch(() => {
        // Retain fallback tags gracefully
      });

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Debounced live search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      getProducts({ search: q, limit: 6 })
        .then((data: StorefrontProduct[]) => {
          setResults(data || []);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onClose();
    navigate(`/products?search=${encodeURIComponent(query.trim())}`);
  };

  const handleProductClick = (id: string) => {
    onClose();
    navigate(`/products/${id}`);
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-[#fbf9f6] p-6 shadow-2xl border border-gray-100 flex flex-col gap-6 text-[#1b1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-xs border border-gray-200/80 focus-within:border-[#84b817] focus-within:ring-2 focus-within:ring-[#84b817]/20 transition-all">
            <Search className="h-5 w-5 text-[#486800] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search organic chia seeds, sun-dried makhana, spices..."
              className="w-full bg-transparent text-sm font-medium text-[#1b1c1a] placeholder:text-gray-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-3.5 rounded-2xl bg-[#1e3a1f] hover:bg-[#486800] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-gray-500 hover:text-gray-900 shadow-xs border border-gray-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </form>

        {/* Quick Popular Tags */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#434936] mr-1">Popular:</span>
          {popularTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className="px-3 py-1 rounded-full bg-[#c9ecc4]/50 hover:bg-[#c9ecc4] text-[#1e3a1f] text-xs font-semibold transition-all border border-[#84b817]/20 cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-xs text-[#434936] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[#486800]">
                progress_activity
              </span>
              <span>Searching certified organic harvest…</span>
            </div>
          ) : query.trim() && results.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-[#1e3a1f]">No products found for "{query}"</p>
              <p className="text-xs text-gray-500 mt-1">
                Try searching for makhana, chia seeds, turmeric, or mustard oil.
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs font-bold text-[#434936] uppercase tracking-wider">
                  Products ({results.length})
                </span>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="text-xs text-[#486800] hover:text-[#1e3a1f] font-bold underline cursor-pointer"
                >
                  View all results →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((p) => {
                  const sizeLabel = p.sizes?.[0] || "";
                  const categoryName = p.category?.name || "Organic";

                  return (
                    <div
                      key={p.mongoId}
                      onClick={() => handleProductClick(p.id)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#f5f3f0] border border-gray-200/70 shadow-2xs transition-all cursor-pointer group"
                    >
                      <img
                        src={p.image || "/placeholder.jpg"}
                        alt={p.title}
                        className="w-14 h-14 rounded-xl object-cover bg-[#f5f3f0] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#1e3a1f] group-hover:text-[#486800] truncate">
                          {p.title}
                        </h4>
                        <span className="text-[11px] text-gray-400 block">
                          {sizeLabel ? `Pack: ${sizeLabel}` : categoryName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-[#486800]">
                            {inr(p.price)}
                          </span>
                          <span className="text-[10px] text-[#84b817] font-bold bg-[#c9ecc4]/60 px-1.5 py-0.2 rounded">
                            Fresh Harvest
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 group-hover:text-[#486800] text-sm">
                        arrow_forward
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-gray-400">
              Type to search or select a popular organic category tag above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
