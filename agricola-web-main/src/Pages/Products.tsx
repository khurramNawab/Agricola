import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "../components/layout/Footer";
import ProductCard from "../components/ProductCard";
import {
  getProducts,
  getCategories,
  type StorefrontProduct,
  type StorefrontCategory,
} from "../lib/storefront";

const CardSkeleton = () => (
  <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
    <div className="h-56 bg-gray-100" />
    <div className="p-5 space-y-3">
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-9 bg-gray-100 rounded" />
    </div>
  </div>
);

const chipClass = (active: boolean) =>
  `rounded-full px-5 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-[#84b817] text-white"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
  }`;

export const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") ?? "";

  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Category chips load once.
  useEffect(() => {
    const controller = new AbortController();
    getCategories(12, controller.signal)
      .then(setCategories)
      .catch(() => {
        /* chips are optional — stay quiet on failure */
      });
    return () => controller.abort();
  }, []);

  // Reload products whenever the active category filter changes.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getProducts(
      { category: activeCategory || undefined, limit: 24 },
      controller.signal
    )
      .then((list) => setProducts(list))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load products.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeCategory]);

  const selectCategory = (slug: string) =>
    setSearchParams(slug ? { category: slug } : {});

  return (
    <div className="bg-white min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="container mx-auto px-4 py-12">
          <h1 className="font-serif text-4xl md:text-5xl text-center text-gray-900 mb-8">
            Explore Our Collection
          </h1>

          {categories.length > 0 && (
            <div className="mb-10 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => selectCategory("")}
                className={chipClass(activeCategory === "")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCategory(c.slug)}
                  className={chipClass(activeCategory === c.slug)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {error ? (
            <p className="py-16 text-center text-gray-500">{error}</p>
          ) : !loading && products.length === 0 ? (
            <p className="py-16 text-center text-gray-500">
              No products found{activeCategory ? " in this category" : ""}.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
                : products.map((p) => <ProductCard key={p.mongoId} product={p} />)}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};
