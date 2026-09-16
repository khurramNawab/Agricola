import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories, type StorefrontCategory } from "../../lib/storefront";

interface CategoryMeta {
  badge: string;
  badgeBg: string;
  fallbackDescription: string;
  fallbackPrice: number;
}

const CATEGORY_META_MAP: Record<string, CategoryMeta> = {
  makhana: {
    badge: "Mithila GI Tagged",
    badgeBg: "bg-[#f78e27] text-white",
    fallbackDescription: "Slow-roasted GI-tagged Mithila foxnuts, raw 6A grade, seasoned with pink salt & clean crunch.",
    fallbackPrice: 599,
  },
  "green-teas": {
    badge: "Whole Leaf Organic",
    badgeBg: "bg-[#84b817] text-white",
    fallbackDescription: "High-altitude tender whole leaf green tea, naturally rich in antioxidants and pure rejuvenating aroma.",
    fallbackPrice: 480,
  },
  "black-tea": {
    badge: "Single-Origin Assam",
    badgeBg: "bg-[#1e3a1f] text-white",
    fallbackDescription: "Orthodox whole leaf single-origin Assam black tea with rich amber liquor and bold malty notes.",
    fallbackPrice: 450,
  },
  "herbal-tea": {
    badge: "Ayurvedic Blend",
    badgeBg: "bg-[#c9ecc4] text-[#1e3a1f]",
    fallbackDescription: "Caffeine-free Himalayan forest-foraged botanical infusions blended with sacred Ayurvedic herbs.",
    fallbackPrice: 420,
  },
  "seeds-nuts": {
    badge: "Superfood Power",
    badgeBg: "bg-[#c9ecc4] text-[#1e3a1f]",
    fallbackDescription: "Raw unroasted chia, omega-rich flax, Kashmiri pumpkin seeds, and raw sunflower kernels.",
    fallbackPrice: 199,
  },
  "organic-spices": {
    badge: "High Curcumin",
    badgeBg: "bg-[#84b817] text-white",
    fallbackDescription: "High-potency Lakadong turmeric, Malabar Tellicherry peppercorns, and sun-dried organic spices.",
    fallbackPrice: 240,
  },
  "cold-pressed-oils": {
    badge: "Wood-Pressed",
    badgeBg: "bg-[#eae8e5] text-[#1b1c1a]",
    fallbackDescription: "Kachi Ghani mustard oil, Kolhu pressed sesame oil, and traditional cultured Gir cow bilona ghee.",
    fallbackPrice: 440,
  },
};

const DEFAULT_CAT_IMAGE = "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=600&q=80";

const CategoryThumb: React.FC<{ image: string | null; name: string }> = ({ image, name }) => {
  const [failed, setFailed] = useState(false);
  const src = (!image || failed) ? DEFAULT_CAT_IMAGE : image;
  return (
    <img
      src={src}
      alt={name}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
};

const CategoriesSection: React.FC = () => {
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    getCategories(8, controller.signal).then(setCategories).catch(() => {}).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  if (!loading && categories.length === 0) return null;

  return (
    <section className="w-full py-10 lg:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-1 text-[#486800] text-xs font-bold uppercase tracking-wider mb-1">
            <span className="material-symbols-outlined text-sm">potted_plant</span>
            <span>Curated Harvest Categories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1b1c1a] tracking-tight">
            Nourish Your Body With Ancestral Purity
          </h2>
        </div>
        <button
          onClick={() => navigate("/products")}
          className="inline-flex items-center gap-1 text-sm text-[#486800] font-bold hover:text-[#1e3a1f] transition-colors"
        >
          <span>Browse All Products</span>
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-96 rounded-3xl bg-gray-100 animate-pulse" />
            ))
          : categories.slice(0, 6).map((category) => {
              const meta = CATEGORY_META_MAP[category.slug] || {
                badge: "Farm Direct",
                badgeBg: "bg-[#84b817] text-white",
                fallbackDescription: "Certified organic harvest direct from sustainable Indian farms.",
                fallbackPrice: 199,
              };
              const description = category.description || meta.fallbackDescription;
              const minPrice = typeof category.minPrice === "number" && category.minPrice > 0
                ? category.minPrice
                : meta.fallbackPrice;
              const priceText = `Starts at ₹${minPrice}`;

              return (
                <button
                  key={category.id}
                  onClick={() => navigate(`/products?category=${category.slug}`)}
                  className="group text-left flex flex-col justify-between bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-white/80 shadow-[0_12px_28px_-8px_rgba(30,58,31,0.07)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
                >
                  <div className="w-full h-52 rounded-2xl bg-[#f5f3f0] overflow-hidden relative mb-4 flex items-center justify-center">
                    <CategoryThumb image={category.image} name={category.name} />
                    <span className={`absolute top-3 left-3 ${meta.badgeBg} text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider`}>
                      {meta.badge}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#434936] font-semibold">Farm-direct collection</span>
                    <h3 className="text-xl font-bold text-[#1b1c1a] mt-1 group-hover:text-[#486800] transition-colors">{category.name}</h3>
                    <p className="text-sm text-[#434936] mt-1 leading-relaxed">{description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#e4e2df] flex items-center justify-between">
                    <span className="text-sm text-[#486800] font-bold">{priceText}</span>
                    <span className="w-8 h-8 rounded-full bg-[#c9ecc4] text-[#1e3a1f] flex items-center justify-center group-hover:bg-[#486800] group-hover:text-white transition-colors" aria-hidden="true">
                      <span className="material-symbols-outlined text-sm">arrow_outward</span>
                    </span>
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
};

export default CategoriesSection;
