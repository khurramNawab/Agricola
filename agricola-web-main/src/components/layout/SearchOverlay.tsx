import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SearchIcon, AgriWordmark } from "../../assets/icons";

const PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=800&q=70";

const popularSearches = [
  "basmati rice",
  "fresh vegetables",
  "seasonal fruits",
  "pulses",
  "spices",
  "dairy",
];

const trending = Array.from({ length: 4 }).map(() => ({
  title: "Organic Basmati Rice",
  weight: "1kg",
  price: 299,
  oldPrice: 399,
}));

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Search bar row */}
        <div className="flex items-center gap-4">
          <AgriWordmark title="AgriCola" className="h-8 w-auto shrink-0" />
          <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm">
            <SearchIcon className="h-5 w-5 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Close search"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600 transition-colors hover:bg-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_3fr]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-gray-700">Popular Searches</h3>
            <ul className="space-y-3">
              {popularSearches.map((term) => (
                <li key={term}>
                  <button
                    onClick={() => setQuery(term)}
                    className="text-gray-700 transition-colors hover:text-green-600"
                  >
                    {term}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-gray-700">Trending Products</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {trending.map((product, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={PRODUCT_IMAGE}
                      alt={product.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      data-keywords="agriculture, produce, groceries"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {product.title}
                    </h4>
                    <p className="text-sm text-gray-500">{product.weight}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-bold text-green-600">
                        &#8377;{product.price}
                      </span>
                      <span className="text-sm text-gray-400 line-through">
                        &#8377;{product.oldPrice}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
