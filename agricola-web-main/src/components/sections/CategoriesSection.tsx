import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories, type StorefrontCategory } from "../../lib/storefront";

const categoryDetails = [
  { badge: "Mithila GI Tagged", badgeBg: "bg-[#f78e27] text-white", description: "Slow-roasted Foxnuts, Raw 6A grade, seasoned with Himalayan pink salt & jaggery pepper.", price: "Starts at ₹320" },
  { badge: "Superfood Power", badgeBg: "bg-[#c9ecc4] text-[#1e3a1f]", description: "Raw unroasted Chia, Omega-rich Flax, Kashmiri Pumpkin Seeds, and raw Sunflower kernels.", price: "Starts at ₹199" },
  { badge: "7.8% Curcumin", badgeBg: "bg-[#84b817] text-white", description: "High-potency Meghalaya Lakadong Turmeric, Malabar Tellicherry Peppercorns, and Sun-dried Coriander.", price: "Starts at ₹240" },
  { badge: "Cold-Pressed", badgeBg: "bg-[#eae8e5] text-[#1b1c1a]", description: "Kachi Ghani Mustard oil, Kolhu pressed Sesame oil, and Desi Gir Cow Bilona Cultured Ghee.", price: "Starts at ₹440" },
  { badge: "Gluten-Free Grains", badgeBg: "bg-[#c9ecc4] text-[#1e3a1f]", description: "Unpolished Foxtail Millet, Kodo, Finger Millet (Ragi), and heirloom Red Rice from Kaithal.", price: "Starts at ₹180" },
  { badge: "Festive Hampers", badgeBg: "bg-[#ffdcc3] text-[#603100]", description: "Artisanal wooden gift sets, wellness assortments, and corporate pure-pantry seasonal gift boxes.", price: "Starts at ₹1,199" },
];

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
          : categories.slice(0, 6).map((category, index) => {
              const detail = categoryDetails[index % categoryDetails.length];
              return (
                <button
                  key={category.id}
                  onClick={() => navigate(`/products?category=${category.slug}`)}
                  className="group text-left flex flex-col justify-between bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-white/80 shadow-[0_12px_28px_-8px_rgba(30,58,31,0.07)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
                >
                  <div className="w-full h-52 rounded-2xl bg-[#f5f3f0] overflow-hidden relative mb-4 flex items-center justify-center">
                    <CategoryThumb image={category.image} name={category.name} />
                    <span className={`absolute top-3 left-3 ${detail.badgeBg} text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider`}>
                      {detail.badge}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#434936] font-semibold">Farm-direct collection</span>
                    <h3 className="text-xl font-bold text-[#1b1c1a] mt-1 group-hover:text-[#486800] transition-colors">{category.name}</h3>
                    <p className="text-sm text-[#434936] mt-1 leading-relaxed">{detail.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#e4e2df] flex items-center justify-between">
                    <span className="text-sm text-[#486800] font-bold">{detail.price}</span>
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
