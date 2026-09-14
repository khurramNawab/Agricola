import { useState, type FC, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useStorefront } from "../storefront/StorefrontContext";
import type { StorefrontProduct } from "../lib/storefront";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

interface ProductCardProps {
  product: StorefrontProduct;
}

const ProductCard: FC<ProductCardProps> = ({ product }) => {
  const { addItem, isInWishlist, toggleWishlist } = useStorefront();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const DEFAULT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=85";

const CATEGORY_FALLBACKS: Record<string, string> = {
  makhana: "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=85",
  snacks: "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=85",
  seeds: "https://images.unsplash.com/photo-1514651178-f7c92df7d3d5?auto=format&fit=crop&w=800&q=85",
  spices: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=85",
  oils: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=85",
  honey: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=85",
};

  const catKey = (product.category?.slug || product.category?.name || "").toLowerCase();
  const fallbackImage = CATEGORY_FALLBACKS[catKey] || DEFAULT_FALLBACK_IMAGE;
  const primaryImage = product.image || fallbackImage;
  const packWeight = product.sizes[0] || "Standard";
  const categoryName = product.category?.name || "Organic";
  const inWish = isInWishlist(product.id);

  const handleQuickAdd = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      await addItem(product.mongoId || product.id, packWeight, 1, {
        productId: product.id,
        title: product.title,
        price: product.price,
        image: primaryImage,
        weight: packWeight,
        inStock: product.inStock,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      console.error("Failed to add to cart:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleWishlistToggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <div className="group relative flex flex-col rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:shadow-[0_12px_30px_-8px_rgba(30,58,31,0.12)] hover:-translate-y-1 transition-all duration-300">
      {/* Image Thumbnail Box */}
      <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-[#f5f3f0] mb-3">
        <Link to={`/products/${product.id}`}>
          <img
            src={primaryImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = fallbackImage;
            }}
          />
        </Link>

        {/* Origin / Quality Badge */}
        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/90 backdrop-blur-md text-[#1e3a1f] shadow-2xs">
          {categoryName}
        </span>

        {/* Wishlist Floating Heart Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={inWish ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-gray-600 hover:text-[#e11d48] shadow-2xs transition-all hover:scale-110 cursor-pointer"
        >
          <Heart
            className={`w-4 h-4 ${
              inWish ? "fill-[#e11d48] text-[#e11d48]" : "text-gray-600"
            }`}
          />
        </button>
      </div>

      {/* Product Information */}
      <div className="flex flex-col flex-1 justify-between gap-3">
        <div>
        {/* Organic / Non-Organic Badge */}
        {product.isOrganic ? (
          <span className="text-[11px] font-semibold text-[#486800] block uppercase tracking-wider">
            🌿 Organic
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
            Non-Organic
          </span>
        )}
          <Link to={`/products/${product.id}`}>
            <h3 className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#486800] transition-colors line-clamp-2 leading-snug mt-0.5">
              {product.title}
            </h3>
          </Link>
          <span className="text-xs text-gray-400 mt-1 block">
            Pack: {packWeight}
          </span>
          {product.stock !== undefined && product.stock > 0 && product.stock <= 5 && (
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-300/80 px-2 py-0.5 rounded-full mt-1 w-fit animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Only {product.stock} left — hurry book now!</span>
            </div>
          )}
          {product.stock === 0 && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full mt-1 w-fit">
              <span>Out of stock</span>
            </div>
          )}
        </div>

        {/* Price & CTA row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <span className="text-base font-black text-[#1e3a1f]">
              {inr(product.price)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={adding}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 ${
              added
                ? "bg-[#c9ecc4] text-[#486800]"
                : "bg-[#1e3a1f] hover:bg-[#84b817] text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {added ? "check" : "add_shopping_cart"}
            </span>
            <span>{added ? "Added" : adding ? "…" : "Add"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
