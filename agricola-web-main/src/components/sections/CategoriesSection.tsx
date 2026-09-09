import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories, type StorefrontCategory } from "../../lib/storefront";

// Thumbnail that gracefully degrades to a produce placeholder when the category
// has no image (or the image URL fails). Using alt="" so a broken image never
// renders the category name as text (which made names look duplicated).
const CategoryThumb: React.FC<{ image: string | null; name: string }> = ({
  image,
  name,
}) => {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <span className="text-5xl" role="img" aria-label={name}>
        🌾
      </span>
    );
  }
  return (
    <img
      src={image}
      alt=""
      className="h-36 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
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
    getCategories(8, controller.signal)
      .then((list) => setCategories(list))
      .catch(() => {
        /* keep the section quiet on failure */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (!loading && categories.length === 0) return null;

  return (
    <section className="py-16 container mx-auto px-4">
      <h3 className="font-serif text-3xl text-center text-gray-900 mb-10">
        Most Popular Categories
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-full h-40 md:h-44 rounded-xl bg-gray-100 animate-pulse" />
                <div className="mt-3 h-4 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ))
          : categories.map((cat) => (
              <div key={cat.id} className="flex flex-col items-center">
                <div
                  onClick={() => navigate(`/products?category=${cat.slug}`)}
                  className="group w-full flex items-center justify-center h-40 md:h-44 overflow-hidden rounded-xl cursor-pointer border border-gray-200 bg-white transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  <CategoryThumb image={cat.image} name={cat.name} />
                </div>
                <p className="mt-3 text-base text-gray-700">{cat.name}</p>
              </div>
            ))}
      </div>
    </section>
  );
};

export default CategoriesSection;
