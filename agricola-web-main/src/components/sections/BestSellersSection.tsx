import React, { useEffect, useState } from "react";
import { getBestSellers, type StorefrontProduct } from "../../lib/storefront";
import ProductCard from "../ProductCard";

const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
    <div className="h-56 bg-gray-100" />
    <div className="p-5 space-y-3">
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-9 bg-gray-100 rounded" />
    </div>
  </div>
);

const BestSellersSection: React.FC = () => {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getBestSellers(4, controller.signal)
      .then((list) => setProducts(list))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load products.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h3 className="font-serif text-3xl text-center text-gray-900 mb-10">
          Our Best Sellers
        </h3>

        {error ? (
          <p className="text-center text-gray-500">{error}</p>
        ) : !loading && products.length === 0 ? (
          <p className="text-center text-gray-500">No products available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
              : products.map((p) => <ProductCard key={p.mongoId} product={p} />)}
          </div>
        )}
      </div>
    </section>
  );
};

export default BestSellersSection;
