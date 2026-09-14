import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useStorefront } from "../storefront/StorefrontContext";
import { getProducts, type StorefrontProduct } from "../lib/storefront";
import Footer from "../components/layout/Footer";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Wishlist() {
  const { wishlist, toggleWishlist, addItem } = useStorefront();
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (wishlist.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getProducts({ ids: wishlist.join(","), limit: wishlist.length })
      .then((data: StorefrontProduct[]) => {
        setProducts(data || []);
      })
      .catch(() => {
        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [wishlist]);

  const savedProducts = products.filter((p) => wishlist.includes(p.id) || wishlist.includes(p.mongoId));

  const handleMoveToCart = async (p: StorefrontProduct) => {
    setAddingId(p.id);
    try {
      const packWeight = p.sizes[0] || "Standard";
      await addItem(p.mongoId || p.id, packWeight, 1, {
        productId: p.id,
        title: p.title,
        price: p.price,
        image: p.image,
        weight: packWeight,
        inStock: p.inStock,
      });
      toggleWishlist(p.id);
    } catch {
      // Non-fatal
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb & Header */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[#434936] mb-6">
          <Link to="/" className="hover:text-[#486800]">Home</Link>
          <span>/</span>
          <span className="text-[#1b1c1a]">My Saved Harvest (Wishlist)</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#1e3a1f] tracking-tight">
              My Saved Harvest
            </h1>
            <p className="text-xs sm:text-sm text-[#434936] mt-1">
              Pure, farm-direct favorites saved for your next harvest basket ({wishlist.length} items).
            </p>
          </div>
          {savedProducts.length > 0 && (
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f5f3f0] border border-gray-200 text-xs font-bold text-[#1e3a1f] shadow-2xs transition-colors"
            >
              <span>Explore More Harvests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center text-sm font-semibold text-gray-500">
            <span className="material-symbols-outlined animate-spin text-[#486800] text-3xl mb-2 block">
              progress_activity
            </span>
            Loading your saved organic favorites…
          </div>
        ) : savedProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-xs border border-gray-100 max-w-lg mx-auto flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
              <Heart className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-[#1e3a1f]">
              Your wishlist is currently empty
            </h2>
            <p className="text-xs text-[#434936] leading-relaxed">
              Explore our single-origin sun-dried Makhana, Himalayan chia seeds, and Lakadong turmeric and tap the heart icon to save them here.
            </p>
            <Link
              to="/products"
              className="mt-2 px-6 py-3 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold shadow-xs transition-colors"
            >
              Discover Fresh Harvest
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {savedProducts.map((p) => {
              const packWeight = p.sizes[0] || "Standard";
              const isAdding = addingId === p.id;
              const categoryName = p.category?.name || "Organic";

              return (
                <div
                  key={p.mongoId}
                  className="group relative flex flex-col rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:shadow-[0_12px_30px_-8px_rgba(30,58,31,0.12)] transition-all"
                >
                  <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-[#f5f3f0] mb-3">
                    <Link to={`/products/${p.id}`}>
                      <img
                        src={p.image || "/placeholder.jpg"}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(p.id)}
                      aria-label="Remove from wishlist"
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-red-500 hover:bg-red-50 shadow-2xs transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#84b817] uppercase tracking-wider block">
                        {categoryName}
                      </span>
                      <Link to={`/products/${p.id}`}>
                        <h3 className="text-xs font-bold text-[#1e3a1f] hover:text-[#486800] line-clamp-2 mt-0.5">
                          {p.title}
                        </h3>
                      </Link>
                      <span className="text-xs text-gray-400 block mt-1">
                        Pack: {packWeight}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-sm font-black text-[#1e3a1f]">
                        {inr(p.price)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleMoveToCart(p)}
                        disabled={isAdding}
                        className="px-4 py-2 rounded-full bg-[#1e3a1f] hover:bg-[#84b817] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{isAdding ? "Moving…" : "Move to Basket"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
