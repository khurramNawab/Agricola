import React, { useEffect, useState } from "react";
import { getBestSellers, type StorefrontProduct } from "../../lib/storefront";
import ProductCard from "../ProductCard";

type FilterTab = "all" | "makhana" | "seeds" | "spices";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All Best Sellers" },
  { id: "makhana", label: "Makhana" },
  { id: "seeds", label: "Seeds" },
  { id: "spices", label: "Spices" },
];

const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm animate-pulse p-4">
    <div className="h-56 bg-gray-100 rounded-2xl mb-4" />
    <div className="space-y-3">
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-9 bg-gray-100 rounded-full" />
    </div>
  </div>
);

// Simple keyword-based filter applied client-side on the title/tags
function filterProducts(products: StorefrontProduct[], tab: FilterTab): StorefrontProduct[] {
  if (tab === "all") return products;
  const keywords: Record<FilterTab, string[]> = {
    all: [],
    makhana: ["makhana", "foxnut", "lotus"],
    seeds: ["seed", "chia", "flax", "pumpkin", "sunflower"],
    spices: ["turmeric", "spice", "pepper", "coriander", "cumin"],
  };
  const kw = keywords[tab];
  return products.filter((p) =>
    kw.some(
      (k) =>
        p.title.toLowerCase().includes(k) ||
        p.tags.some((t) => t.toLowerCase().includes(k)),
    ),
  );
}

const BestSellersSection: React.FC = () => {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  useEffect(() => {
    const controller = new AbortController();
    getBestSellers(8, controller.signal)
      .then((list) => setProducts(list))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load products.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const displayed = filterProducts(products, activeTab).slice(0, 4);

  return (
    <section className="py-12" id="bestsellers">
      <div className="bg-[#f5f3f0]/80 rounded-3xl p-6 lg:p-10 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)]">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[#d97706] text-xs font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
              <span>Most Loved By Over 45,000 Homes</span>
            </div>
            <h2 className="text-3xl font-extrabold text-[#1b1c1a]">Our Best Sellers</h2>
            <p className="mt-1 text-sm text-[#434936]">
              Hand-batched within the last 14 days. Sealed in oxygen-barrier eco canisters.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-[#1b1c1a] text-white shadow-sm"
                    : "bg-white text-[#1b1c1a] hover:bg-[#eae8e5]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {error ? (
          <p className="text-center text-gray-500">{error}</p>
        ) : !loading && products.length === 0 ? (
          <p className="text-center text-gray-500">No products available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))
              : displayed.length > 0
              ? displayed.map((p) => (
                  <ProductCard key={p.mongoId} product={p} />
                ))
              : products.slice(0, 4).map((p) => (
                  <ProductCard key={p.mongoId} product={p} />
                ))}
          </div>
        )}

        {/* View All Link */}
        {!loading && (
          <div className="mt-8 text-center">
            <a
              href="/products"
              className="inline-flex items-center gap-2 bg-white border border-[#e4e2df] text-[#486800] hover:bg-[#486800] hover:text-white px-6 py-3 rounded-full font-bold text-sm transition-all shadow-sm"
            >
              <span>View All Products</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default BestSellersSection;
