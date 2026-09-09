import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type StorefrontProduct } from "../lib/storefront";
import { useStorefront } from "../storefront/StorefrontContext";

// Shown when a product has no uploaded image yet.
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=800&q=70";

/**
 * Storefront product card with a login-gated "Add to Cart". Used by the landing
 * Best Sellers, the collection grid, and the Similar Products carousel so the
 * add-to-cart behaviour stays identical everywhere.
 */
const ProductCard: React.FC<{ product: StorefrontProduct }> = ({ product }) => {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] ?? "");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState("");
  const navigate = useNavigate();
  const { isLoggedIn, openAuth, addItem } = useStorefront();

  // Only registered (phone-verified) users can add to cart. Logged-out visitors
  // get the login/signup modal, and the add runs once they're authenticated.
  const handleAddToCart = () => {
    if (!product.inStock) {
      navigate(`/products/${product.id}`);
      return;
    }

    const doAdd = async () => {
      setAddError("");
      setAdding(true);
      try {
        await addItem(product.mongoId, selectedSize || null, 1);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Couldn't add to cart.");
      } finally {
        setAdding(false);
      }
    };

    if (!isLoggedIn) {
      openAuth(doAdd);
      return;
    }
    doAdd();
  };

  const buttonLabel = !product.inStock
    ? "View Product"
    : adding
    ? "Adding…"
    : added
    ? "Added ✓"
    : "Add to Cart";

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <button
        type="button"
        onClick={() => navigate(`/products/${product.id}`)}
        aria-label={`View ${product.title}`}
        className="block h-56 w-full overflow-hidden bg-gray-50"
      >
        <img
          src={product.image || FALLBACK_IMAGE}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
      </button>
      <div className="p-5">
        <h4
          onClick={() => navigate(`/products/${product.id}`)}
          className="text-base font-medium text-gray-900 mb-3 leading-snug cursor-pointer hover:text-green-700"
        >
          {product.title}
        </h4>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-green-600 font-bold text-lg">
            &#8377;{product.price}
          </span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-gray-400 line-through text-sm">
              &#8377;{product.oldPrice}
            </span>
          )}
        </div>

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {product.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-md font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {product.sizes.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mb-2">Select Quantity</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedSize === size
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={handleAddToCart}
          disabled={adding}
          className="w-full bg-[#84b817] text-white py-2.5 rounded-lg font-medium hover:bg-[#6d9913] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {buttonLabel}
        </button>
        {addError && (
          <p className="mt-2 text-center text-xs text-red-500">{addError}</p>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
