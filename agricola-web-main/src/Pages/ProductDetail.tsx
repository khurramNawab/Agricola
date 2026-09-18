import { sanitizeZeroSafeNumber, zeroSafeInputProps } from "../lib/zeroSafe";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  X,
  Star,
  CheckCircle2,
  TrendingUp,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Download,
  Flame,
  Droplets,
  ShoppingBag,
  Zap,
  MapPin,
  Calendar,
  Warehouse,
  FileText,
} from "lucide-react";
import Footer from "../components/layout/Footer";
import ProductCard from "../components/ProductCard";
import ProductImageZoom from "../components/ProductImageZoom";
import {
  getProduct,
  getProducts,
  getReviews,
  getSimilarProducts,
  submitReview,
  type ProductReview,
  type ReviewSummary,
  type StorefrontProduct,
  type StorefrontProductDetail,
} from "../lib/storefront";
import { useStorefront } from "../storefront/StorefrontContext";
import { checkPincodeServiceability, type PincodeServiceability } from "../lib/checkout";

const FALLBACK_HERO_IMAGE =
  "/assets/makhana1.png";

interface PackSizeOption {
  size: string;
  name: string;
  price: number;
  oldPrice: number;
  discount: string;
  stock: number;
  inStock: boolean;
  popular?: boolean;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, openAuth, addItem, isInWishlist, toggleWishlist } = useStorefront();

  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [similar, setSimilar] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeImage, setActiveImage] = useState(0);
  const [selectedPackIndex, setSelectedPackIndex] = useState(0); // Default first available variant
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState("");

  // Modals
  // Pincode check state (Live carrier serviceability: Shiprocket / Ekart)
  const [pincode, setPincode] = useState("");
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [pincodeResult, setPincodeResult] = useState<PincodeServiceability | null>(null);
  const [pincodeError, setPincodeError] = useState("");

  // Bundle Add state
  const [bundleAdding, setBundleAdding] = useState(false);
  const [bundleAdded, setBundleAdded] = useState(false);

  // Tabs: origin | nutrition | recipes | reviews
  const [activeTab, setActiveTab] = useState<"origin" | "nutrition" | "recipes" | "reviews">("origin");

  // Reviews
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState("");
  const [formComment, setFormComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setActiveImage(0);
    setQuantity(1);
    setReviews([]);
    setReviewSummary(null);
    setReviewDone(false);
    setReviewError("");

    getProduct(id, controller.signal)
      .then((p) => {
        setProduct(p);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Product not found.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    // Reviews
    getReviews(id, controller.signal)
      .then((res) => {
        setReviews(res.reviews);
        setReviewSummary(res.summary);
      })
      .catch(() => {});

    // Similar products
    getSimilarProducts(id, 4, controller.signal)
      .then(async (list) => {
        if (list.length > 0) {
          setSimilar(list.slice(0, 4));
          return;
        }
        const general = await getProducts({ limit: 5 }, controller.signal);
        setSimilar(
          general.filter((p) => p.id !== id && p.mongoId !== id).slice(0, 4)
        );
      })
      .catch(() => {});

    return () => controller.abort();
  }, [id]);

  const handleVerifyPincode = async (e: FormEvent) => {
    e.preventDefault();
    const clean = pincode.trim();
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setPincodeError("Please enter a valid 6-digit Indian pincode.");
      setPincodeResult(null);
      return;
    }
    setPincodeError("");
    setCheckingPincode(true);
    try {
      const res = await checkPincodeServiceability(clean);
      setPincodeResult(res);
      if (!res.serviceable) {
        setPincodeError(`Delivery is not available to pincode ${clean}.`);
      }
    } catch {
      setPincodeError("Unable to verify pincode. Please try again.");
    } finally {
      setCheckingPincode(false);
    }
  };

  const getPackName = (size: string) => {
    const s = size.toLowerCase();
    if (s.includes("30g") || s.includes("50g")) return "Trial Pouch";
    if (s.includes("100g") || s.includes("150g") || s.includes("200g")) return "Snack Pouch";
    if (s.includes("250g") || s.includes("300g")) return "Taster Pouch";
    if (s.includes("500g")) return "Family Pack";
    if (s.includes("1kg") || s.includes("1 kg")) return "Twin Pack / 1 KG";
    if (s.includes("5kg") || s.includes("5 kg")) return "Bulk Pantry Pack";
    return `${size} Pack`;
  };

  // Dynamically compute pack options from product's actual variantStocks or sizes
  const packOptions: PackSizeOption[] = (() => {
    if (!product) return [];

    if (product.variantStocks && product.variantStocks.length > 0) {
      return product.variantStocks.map((vs, idx) => {
        const pPrice = vs.price || product.price;
        const pOldPrice = product.oldPrice
          ? Math.round(product.oldPrice * (pPrice / product.price))
          : Math.round(pPrice * 1.25);
        const saveAmount = pOldPrice > pPrice ? pOldPrice - pPrice : 0;
        const discountStr = saveAmount > 0 ? `₹${saveAmount} OFF` : "Best Value";
        return {
          size: vs.size,
          name: getPackName(vs.size),
          price: pPrice,
          oldPrice: pOldPrice,
          discount: discountStr,
          stock: vs.stock ?? 0,
          inStock: (vs.stock ?? 0) > 0,
          popular: idx === 0,
        };
      });
    }

    if (product.sizes && product.sizes.length > 0) {
      return product.sizes.map((sz, idx) => {
        const pPrice = product.price;
        const pOldPrice = product.oldPrice || Math.round(product.price * 1.25);
        const saveAmount = pOldPrice > pPrice ? pOldPrice - pPrice : 0;
        return {
          size: sz,
          name: getPackName(sz),
          price: pPrice,
          oldPrice: pOldPrice,
          discount: saveAmount > 0 ? `₹${saveAmount} OFF` : "Best Value",
          stock: product.stock ?? 0,
          inStock: (product.stock ?? 0) > 0,
          popular: idx === 0,
        };
      });
    }

    return [
      {
        size: "250g",
        name: "Taster Pouch",
        price: Math.round(product.price * 0.53),
        oldPrice: Math.round((product.oldPrice || product.price * 1.25) * 0.5),
        discount: "15% (₹70 OFF)",
        stock: product.stock ?? 0,
        inStock: (product.stock ?? 0) > 0,
      },
      {
        size: "500g",
        name: "Family Pack",
        price: product.price,
        oldPrice: product.oldPrice || Math.round(product.price * 1.25),
        discount: "20% (₹180 OFF)",
        stock: product.stock ?? 0,
        inStock: (product.stock ?? 0) > 0,
        popular: true,
      },
      {
        size: "1kg",
        name: "Twin 500g Pack",
        price: Math.round(product.price * 1.93),
        oldPrice: Math.round((product.oldPrice || product.price * 1.25) * 2.05),
        discount: "25% (₹460 OFF)",
        stock: product.stock ?? 0,
        inStock: (product.stock ?? 0) > 0,
      },
    ];
  })();

  const activePackIdx = selectedPackIndex < packOptions.length ? selectedPackIndex : 0;
  const currentPack = packOptions[activePackIdx] || {
    size: "500g",
    name: "Pack",
    price: product?.price || 0,
    oldPrice: 0,
    discount: "",
    stock: product?.stock || 0,
    inStock: true,
  };
  const unitPrice = currentPack.price;
  const currentTotalPrice = unitPrice * quantity;
  const isVariantInStock = currentPack.inStock && currentPack.stock > 0;

  const handleAddToCart = (directCheckout = false) => {
    if (!product) return;

    const doAdd = async () => {
      setAddError("");
      setAdding(true);
      try {
        await addItem(product.mongoId || product.id, currentPack.size, quantity, {
          productId: product.id,
          title: product.title,
          price: unitPrice,
          image: product.images[0] || product.image,
          weight: currentPack.size,
          inStock: isVariantInStock && product.inStock,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
        if (directCheckout) {
          if (!isLoggedIn) {
            openAuth(() => navigate("/checkout"));
          } else {
            navigate("/checkout");
          }
        }
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Couldn't add to basket.");
      } finally {
        setAdding(false);
      }
    };

    doAdd();
  };

  const handleBuyBundle = async () => {
    if (!product) return;
    setBundleAdding(true);
    try {
      await addItem(product.mongoId || product.id, currentPack.size, 1, {
        productId: product.id,
        title: product.title,
        price: currentPack.price,
        image: product.images[0] || product.image,
        weight: currentPack.size,
        inStock: product.inStock,
      });
      setBundleAdded(true);
      setTimeout(() => setBundleAdded(false), 2500);
    } catch {
      // ignore
    } finally {
      setBundleAdding(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!product || !formComment.trim() || reviewSubmitting) return;

    const doSubmit = async () => {
      setReviewError("");
      setReviewSubmitting(true);
      try {
        const { review, summary } = await submitReview(product.id, {
          rating: formRating,
          comment: formComment.trim(),
          title: formTitle.trim() || undefined,
        });
        setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
        setReviewSummary(summary);
        setReviewDone(true);
        setFormComment("");
        setFormTitle("");
        setFormRating(5);
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Couldn't submit review.");
      } finally {
        setReviewSubmitting(false);
      }
    };

    if (!isLoggedIn) {
      openAuth(doSubmit);
      return;
    }
    doSubmit();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
            <div className="lg:col-span-6 h-[500px] bg-gray-200 rounded-3xl" />
            <div className="lg:col-span-6 space-y-4">
              <div className="h-8 bg-gray-200 rounded-xl w-3/4" />
              <div className="h-4 bg-gray-200 rounded-lg w-1/2" />
              <div className="h-20 bg-gray-200 rounded-2xl w-full" />
              <div className="h-14 bg-gray-200 rounded-full w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-[#c9ecc4]/60 flex items-center justify-center text-3xl mx-auto mb-4">
            🌾
          </div>
          <h2 className="text-2xl font-black text-[#1e3a1f] mb-2">Organic Harvest Not Found</h2>
          <p className="text-sm text-[#434936] mb-6">{error || "The requested organic batch could not be loaded."}</p>
          <button
            onClick={() => navigate("/products")}
            className="rounded-full bg-[#486800] hover:bg-[#1e3a1f] px-8 py-3.5 text-sm font-bold text-white transition-all shadow-md cursor-pointer"
          >
            Explore Pure Harvest Catalog
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  // Construct gallery images from admin-uploaded images
  const adminImages = (product.images || []).filter(Boolean);
  const galleryImages =
    adminImages.length > 0
      ? adminImages
      : [product.image || FALLBACK_HERO_IMAGE];

  const ratingValue = reviewSummary?.average ?? (product.rating || 4.9);
  const totalReviewsCount = reviewSummary?.count ?? (product.reviewsCount || 1420);

  return (
    <div id="product-detail-root" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans text-[#1b1c1a] antialiased">
      <main className="w-full pt-8 sm:pt-10 max-w-7xl mx-auto px-4 lg:px-8 flex-1">
        {/* ── Breadcrumb Bar ── */}
        <nav className="flex items-center gap-1.5 text-xs font-semibold text-[#434936] mb-6 flex-wrap">
          <Link to="/" className="hover:text-[#486800] transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">home</span>
            <span>Home</span>
          </Link>
          <span className="text-gray-300 font-bold">/</span>
          <Link to="/products" className="hover:text-[#486800] transition-colors">
            Catalog
          </Link>
          <span className="text-gray-300 font-bold">/</span>
          <Link to="/products?category=makhana-foxnuts" className="hover:text-[#486800] transition-colors">
            {product.category?.name || "Makhana & Foxnuts"}
          </Link>
          <span className="text-gray-300 font-bold">/</span>
          <span className="text-[#1e3a1f] font-bold truncate max-w-xs md:max-w-md">
            {product.title}
          </span>
        </nav>

        {/* ── Main Product Showcase Grid (12 Columns) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-16">
          {/* Left Column: Media & Visual Gallery with Amazon-Style Macro Zoom (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <ProductImageZoom
              images={galleryImages}
              video={product.video?.url || product.videoUrl}
              activeImageIndex={activeImage}
              onSelectImage={setActiveImage}
              productTitle={product.title}
              isOrganic={product.isOrganic}
              isInWishlist={isInWishlist(product.id)}
              onToggleWishlist={() => toggleWishlist(product.id)}
            />
          </div>

          {/* Right Column: Purchase Engine & Specs (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            {/* Badges & Category Header */}
            <div className="flex flex-wrap items-center gap-2">
              {product.isOrganic !== false ? (
                <span className="bg-[#c9ecc4] text-[#1e3a1f] text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs border border-[#84b817]/30">
                  <span className="text-xs">🌿</span>
                  <span>100% Organic</span>
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 border border-gray-200">
                  <span>Non-Organic</span>
                </span>
              )}
              <span className="bg-[#ffdcc3] text-[#904d00] text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                <Star size={12} className="fill-current" />
                <span>BEST SELLER</span>
              </span>
              <span className="bg-[#c9ecc4] text-[#1e3a1f] text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                <CheckCircle2 size={12} className="text-[#486800]" />
                <span>GI-Tagged Mithila Makhana</span>
              </span>
              <span className="bg-gray-100 text-gray-700 text-[11px] font-bold px-3 py-1 rounded-full">
                Grade 6A Jumbo (&gt;18mm)
              </span>
            </div>

            {/* Title and Short Descriptor */}
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl text-[#1e3a1f] font-black tracking-tight leading-tight">
                {product.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#434936] mt-2 leading-relaxed font-medium">
                Puffed using time-honored cast-iron roasting in Mithila wetlands. Slow-dried naturally with zero chemical sulfur whitening, yielding immense crunch, high plant protein, and unmatched nutrient purity.
              </p>
            </div>

            {/* Rating & Social Proof Live Badge */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center text-amber-400 text-sm">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={15} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs font-black text-[#1e3a1f]">{ratingValue.toFixed(1)}</span>
                <a
                  href="#reviews-section"
                  onClick={() => setActiveTab("reviews")}
                  className="text-xs text-[#486800] hover:underline font-bold ml-1"
                >
                  ({totalReviewsCount.toLocaleString()} reviews)
                </a>
              </div>
              <div className="h-4 w-px bg-gray-200 hidden sm:block" />
              <div className="flex items-center gap-1 text-[#1e3a1f] bg-[#c9ecc4]/60 px-2.5 py-1 rounded-full text-[11px] font-bold">
                <TrendingUp size={13} className="text-[#486800]" />
                <span>1,840+ packets ordered this week</span>
              </div>
            </div>

            {/* Dynamic Price Engine Block */}
            <div className="flex flex-col gap-1 p-4 sm:p-5 bg-white rounded-3xl border border-gray-100 shadow-xs">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-[#1e3a1f] tracking-tight">
                  ₹{unitPrice}
                </span>
                <span className="text-base sm:text-lg text-gray-400 line-through font-semibold">
                  ₹{currentPack.oldPrice}
                </span>
                <span className="bg-[#486800] text-white text-xs font-bold px-3 py-1 rounded-full shadow-2xs">
                  Save {currentPack.discount}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#434936] text-xs mt-1.5">
                <span>Inclusive of all GST &amp; Agricultural Cess</span>
                <span className="text-[#486800] font-bold flex items-center gap-1">
                  <Truck size={14} />
                  <span>Eligible for Free Shipping</span>
                </span>
              </div>

              {/* Per-Variant Live Stock Alert */}
              {isVariantInStock && currentPack.stock <= 10 && (
                <div className="mt-2.5 inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs animate-pulse">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
                  </span>
                  <span>🔥 Only {currentPack.stock} units left for {currentPack.size} — hurry book now!</span>
                </div>
              )}
              {isVariantInStock && currentPack.stock > 10 && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-800 font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>In Stock: {currentPack.stock} units available for {currentPack.size}</span>
                </div>
              )}
              {!isVariantInStock && (
                <div className="mt-2.5 inline-flex items-center gap-2 bg-red-50 border border-red-300 text-red-800 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                  <span>⚠️ {currentPack.size} is Out of Stock. Please select another variant above.</span>
                </div>
              )}
            </div>

            {/* Batch Traceability & Harvest Transparency Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-xs text-xs text-[#434936]">
              <div className="flex items-center gap-1.5">
                <FileText size={15} className="text-[#486800]" />
                <span>Batch: <strong className="text-[#1e3a1f] font-mono">AG-MK-2025-02</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={15} className="text-[#486800]" />
                <span>Harvested: <strong className="text-[#1e3a1f]">Spring 2025</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Warehouse size={15} className="text-[#486800]" />
                <span>Facility: <strong className="text-[#1e3a1f]">ISO 22000 &amp; HACCP Facility</strong></span>
              </div>
            </div>

            {/* Pack Size Interactive Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1e3a1f]">
                  Select Pack Size:
                </label>
                <span className="text-xs text-[#486800] font-bold cursor-pointer hover:underline">
                  Nutrient Density Guide
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {packOptions.slice(0, 5).map((opt, idx) => {
                  const isSelected = activePackIdx === idx;
                  const isOptOutOfStock = !opt.inStock || opt.stock <= 0;
                  return (
                    <button
                      key={opt.size}
                      type="button"
                      onClick={() => setSelectedPackIndex(idx)}
                      className={`relative flex flex-col p-3.5 rounded-2xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[#c9ecc4] border-[#84b817] shadow-sm text-[#1e3a1f] ring-2 ring-[#84b817]/40"
                          : isOptOutOfStock
                          ? "bg-gray-50/90 border-gray-200 text-gray-400 hover:border-gray-300"
                          : "bg-white border-gray-200 hover:border-gray-300 text-gray-800"
                      }`}
                    >
                      {opt.popular && !isOptOutOfStock && (
                        <span className="absolute -top-2.5 right-2 bg-[#486800] text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs">
                          Popular
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold">{opt.size}</span>
                        {isOptOutOfStock ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-1.5 py-0.5 rounded">
                            Out of Stock
                          </span>
                        ) : opt.stock <= 10 ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded">
                            {opt.stock} left
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-green-800 bg-green-100/90 px-1.5 py-0.5 rounded">
                            {opt.stock} in stock
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] opacity-80 mt-0.5">{opt.name}</span>
                      <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-black/5">
                        <span className="text-xs font-black">₹{opt.price}</span>
                        {opt.oldPrice > opt.price && (
                          <span className="text-[10px] opacity-70 line-through">₹{opt.oldPrice}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Stepper & Add to Cart Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              {/* Ergonomic Stepper with Direct Number Input */}
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-full p-1.5 shadow-xs sm:w-36 shrink-0">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  className="w-9 h-9 rounded-full bg-[#f5f3f0] hover:bg-[#eae8e5] text-[#1e3a1f] flex items-center justify-center font-bold cursor-pointer transition-colors disabled:opacity-50"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <span className="material-symbols-outlined text-base">remove</span>
                </button>
                <input
                  type="text"
                  {...zeroSafeInputProps}
                  value={quantity === 0 ? "" : quantity}
                  onChange={(e) => {
                    const clean = sanitizeZeroSafeNumber(e.target.value, true);
                    if (!clean) {
                      setQuantity("" as any);
                      return;
                    }
                    const val = parseInt(clean, 10);
                    const maxStock = currentPack.stock > 0 ? currentPack.stock : 999;
                    setQuantity(Math.min(val, maxStock));
                  }}
                  onBlur={() => {
                    if (!quantity || (quantity as any) < 1) {
                      setQuantity(1);
                    }
                  }}
                  className="w-12 text-center text-sm font-black text-[#1e3a1f] bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                  aria-label="Product quantity"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  className="w-9 h-9 rounded-full bg-[#f5f3f0] hover:bg-[#eae8e5] text-[#1e3a1f] flex items-center justify-center font-bold cursor-pointer transition-colors"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
              </div>

              {/* Primary CTA: Add to Basket */}
              <button
                type="button"
                onClick={() => handleAddToCart(false)}
                disabled={adding || !isVariantInStock || !product.inStock}
                className="flex-1 bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs sm:text-sm font-bold py-3.5 px-6 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-98"
              >
                <ShoppingBag size={18} />
                <span>
                  {adding
                    ? "Adding…"
                    : added
                    ? "Added to Basket ✓"
                    : !isVariantInStock
                    ? `Out of Stock (${currentPack.size})`
                    : !product.inStock
                    ? "Out of Stock"
                    : `Add to Basket • ₹${currentTotalPrice}`}
                </span>
              </button>

              {/* Secondary CTA: Buy Now */}
              <button
                type="button"
                onClick={() => handleAddToCart(true)}
                disabled={adding || !isVariantInStock || !product.inStock}
                className="bg-[#1e3a1f] hover:bg-[#2d522e] text-white text-xs sm:text-sm font-bold py-3.5 px-6 rounded-full shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-98"
              >
                <Zap size={16} className="text-[#84b817] fill-current" />
                <span>Buy Now</span>
              </button>
            </div>

            {addError && <p className="text-xs text-red-500 font-bold">{addError}</p>}

            {/* Real-Time Delivery & Pincode Checker Card */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#1e3a1f] font-bold text-xs">
                  <Truck size={16} className="text-[#486800]" />
                  <span>Check Pincode Delivery &amp; COD Availability</span>
                </div>
                {product && (
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${product.inStock ? "text-[#486800]" : "text-amber-700"}`}>
                    <span className={`w-2 h-2 rounded-full ${product.inStock ? "bg-[#84b817] animate-ping" : "bg-amber-500"}`} />
                    <span>
                      {product.stock !== undefined && product.stock !== null
                        ? `${product.stock} units in stock`
                        : product.inStock
                        ? "In Stock"
                        : "Out of Stock"}
                    </span>
                  </span>
                )}
              </div>

              {/* Input Form */}
              <form onSubmit={handleVerifyPincode} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit Indian pincode"
                    className="w-full bg-[#f5f3f0] text-[#1e3a1f] text-xs font-mono font-bold rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#84b817] border border-gray-200"
                  />
                </div>
                <button
                  type="submit"
                  disabled={checkingPincode}
                  className="bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {checkingPincode ? "Checking…" : "Verify"}
                </button>
              </form>

              {/* Dynamic Feedback */}
              {pincodeError ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2 text-xs text-red-700 font-medium">
                  <X size={15} className="shrink-0 text-red-600" />
                  <span>{pincodeError}</span>
                </div>
              ) : pincodeResult && pincodeResult.serviceable ? (
                <div className="bg-[#f5f3f0]/70 rounded-2xl p-3 flex flex-col gap-1 text-xs text-[#434936]">
                  <div className="flex items-center gap-1.5 text-[#486800] font-bold">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>
                      Delivery available to {pincodeResult.city ? `${pincodeResult.city}, ${pincodeResult.state || ""}` : `Pincode ${pincodeResult.pincode}`} ({pincodeResult.pincode})
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-600">
                    Estimated arrival in{" "}
                    <strong>
                      {pincodeResult.eta?.days
                        ? `${pincodeResult.eta.days} business days`
                        : "2-3 business days"}
                    </strong>
                    {pincodeResult.eta?.date ? ` (${pincodeResult.eta.date})` : ""}. Direct dispatch from{" "}
                    <strong>AgriCola Cold-Chain Facility</strong> via{" "}
                    <span className="capitalize font-medium text-[#1e3a1f]">
                      {pincodeResult.provider === "ekart" ? "Ekart Logistics" : "Shiprocket Express Air"}
                    </span>
                    . {pincodeResult.cod ? "Cash on Delivery (COD) & UPI active." : "Prepaid & UPI active."}
                  </p>
                </div>
              ) : null}
            </div>

            {/* 4 Value Highlights Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-white p-3 rounded-2xl flex flex-col items-center text-center gap-1 shadow-xs border border-gray-100">
                <Truck size={20} className="text-[#486800]" />
                <span className="text-[11px] font-bold text-[#1e3a1f]">Free Shipping</span>
                <span className="text-[10px] text-gray-500">Orders &gt; ₹799</span>
              </div>
              <div className="bg-white p-3 rounded-2xl flex flex-col items-center text-center gap-1 shadow-xs border border-gray-100">
                <Sparkles size={20} className="text-[#486800]" />
                <span className="text-[11px] font-bold text-[#1e3a1f]">100% Chemical Free</span>
                <span className="text-[10px] text-gray-500">No sulfur bleach</span>
              </div>
              <div className="bg-white p-3 rounded-2xl flex flex-col items-center text-center gap-1 shadow-xs border border-gray-100">
                <Droplets size={20} className="text-[#486800]" />
                <span className="text-[11px] font-bold text-[#1e3a1f]">Nitrogen Flushed</span>
                <span className="text-[10px] text-gray-500">Crunch guaranteed</span>
              </div>
              <Link
                to="/return-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white p-3 rounded-2xl flex flex-col items-center text-center gap-1 shadow-xs border border-gray-100 hover:border-[#84b817] hover:shadow-sm transition-all group"
                title="View Agricola Freshness & Return Policy"
              >
                <RotateCcw size={20} className="text-[#486800] group-hover:rotate-[-45deg] transition-transform" />
                <span className="text-[11px] font-bold text-[#1e3a1f] group-hover:text-[#486800]">Easy 7-Day Return</span>
                <span className="text-[10px] text-[#486800] underline">View Policy</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Frequently Bought Together Bundle Card (Roaster's Essential Organic Trio) ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 mb-16 shadow-xs border border-gray-200/80">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="bg-[#ffdcc3] text-[#904d00] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                Bundle &amp; Save
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-[#1e3a1f] mt-1">
                Roaster&apos;s Essential Organic Trio
              </h3>
              <p className="text-xs text-[#434936] mt-0.5">
                Everything required to roast aromatic, crispy makhana snack bowls in under 5 minutes.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="flex flex-col text-right">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-[#1e3a1f]">₹1,150</span>
                  <span className="text-xs text-gray-400 line-through">₹1,330</span>
                </div>
                <span className="text-[11px] text-[#486800] font-bold">You Save ₹180 combo discount</span>
              </div>
              <button
                type="button"
                onClick={handleBuyBundle}
                disabled={bundleAdding}
                className="bg-[#c9ecc4] hover:bg-[#84b817] hover:text-white text-[#1e3a1f] transition-all text-xs px-5 py-3 rounded-full font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ShoppingBag size={15} />
                <span>{bundleAdding ? "Adding Bundle…" : bundleAdded ? "Bundle Added ✓" : "Buy Bundle"}</span>
              </button>
            </div>
          </div>

          {/* 3 Bundled Items Flex Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Item 1 */}
            <div className="bg-[#fbf9f6] p-4 rounded-2xl flex items-center gap-3.5 shadow-2xs border border-gray-100">
              <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTp0d06pgGpB8Ks1UoOrVwoQs2qHae_sOmmNyNVvKM5joQF_Y3d4dUScHUMKDihF-pdtd7pNcRx9tWiTX-R98Tyqynefx8VOQ6OSUJgDDT_Po9rh1wgOm85H4ZMTmNEG-Ju2Fg-xIbs4QLstkUvWOKynwd-ZfGj1QivZZeje5DVRDSkFd62bQgZHaqK04VXXa6_g-Sd9yMI4GfzNrVN_w1NHj1QNe7fDe_J-meqGe2oyXzZoU6gBhA"
                  alt="Mithila Jumbo Makhana"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#1e3a1f] truncate">Mithila Jumbo Makhana</span>
                <span className="text-[11px] text-gray-500">500g Pouch</span>
                <span className="text-xs font-black text-[#486800] mt-1">₹720</span>
              </div>
              <div className="ml-auto text-[#486800] font-bold text-lg hidden md:block">+</div>
            </div>

            {/* Item 2 */}
            <div className="bg-[#fbf9f6] p-4 rounded-2xl flex items-center gap-3.5 shadow-2xs border border-gray-100">
              <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3kFeTNqz5uTwW0SXnvfyf4SgC6u1Ovh4XqaOhyMMur7Zs5gMsYSWq3RTLoMVqMfNYStsQWWNq351-B7yhr27ewtkjbTnOATG6NY62VBsH23YHFjfzx-EAtrvF6-Yzs7TJF9hFSHSPHGl-TC05UiudMriYsJpBhgbSyKwJBw0WfC9VvZ60gjoW83FJ0Y0y3jfeNF1OnBRUEPzmwBNBX4sDPGL5sKeUUDvMfJ1x3TOUxnJCtz4EOPez"
                  alt="Vedic A2 Gir Cow Ghee"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#1e3a1f] truncate">Vedic A2 Gir Cow Ghee</span>
                <span className="text-[11px] text-gray-500">250ml Glass Jar</span>
                <span className="text-xs font-black text-[#486800] mt-1">₹480</span>
              </div>
              <div className="ml-auto text-[#486800] font-bold text-lg hidden md:block">+</div>
            </div>

            {/* Item 3 */}
            <div className="bg-[#fbf9f6] p-4 rounded-2xl flex items-center gap-3.5 shadow-2xs border border-gray-100">
              <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZqpP6e4-3V_oHXLI3O0T_UmwCEzDGVMSSUI0mFt_vb-Anc4rw2rWMmLHhWb3eK_WpnDLCEThF9dbe-ZW8RQmO1_Q9qloI4g2odyimuPmpTGVpkz4_Qblkb3nEkIe24Cve6p9wQ2ICv6n7ZeOZV5MdjthPCgWcEZdtazLYis5T81PTsJgGwMgnk7Zcy4ngLBRHYFfrV6FPs0HJojWZQohtMRNxZRg8aARjUZmLQXmSRYNiHniBT7Ly"
                  alt="Raw Himalayan Pink Salt"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#1e3a1f] truncate">Raw Himalayan Pink Salt</span>
                <span className="text-[11px] text-gray-500">200g Kraft Pouch</span>
                <span className="text-xs font-black text-[#486800] mt-1">₹130</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Zero Layout-Shift 4 Tabbed Content Area ── */}
        <section id="reviews-section" className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-gray-100 shadow-xs mb-16">
          {/* Tab Headers */}
          <div className="flex items-center gap-2 sm:gap-3 border-b border-gray-100 pb-4 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("origin")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "origin"
                  ? "bg-[#1e3a1f] text-white shadow-xs"
                  : "bg-[#f5f3f0] text-[#434936] hover:bg-[#eae8e5]"
              }`}
            >
              <Sparkles size={14} />
              <span>Origin &amp; Mithila Heritage</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("nutrition")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "nutrition"
                  ? "bg-[#1e3a1f] text-white shadow-xs"
                  : "bg-[#f5f3f0] text-[#434936] hover:bg-[#eae8e5]"
              }`}
            >
              <ShieldCheck size={14} />
              <span>Nutrition Facts &amp; Lab COA</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("recipes")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "recipes"
                  ? "bg-[#1e3a1f] text-white shadow-xs"
                  : "bg-[#f5f3f0] text-[#434936] hover:bg-[#eae8e5]"
              }`}
            >
              <Flame size={14} />
              <span>How to Roast &amp; Recipes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "reviews"
                  ? "bg-[#1e3a1f] text-white shadow-xs"
                  : "bg-[#f5f3f0] text-[#434936] hover:bg-[#eae8e5]"
              }`}
            >
              <Star size={14} />
              <span>Verified Reviews ({totalReviewsCount})</span>
            </button>
          </div>

          {/* Tab Panels */}
          <div className="pt-6">
            {/* Tab 1: Origin & Mithila Heritage */}
            {activeTab === "origin" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center animate-fadeIn">
                <div className="md:col-span-7 flex flex-col gap-4">
                  <span className="text-[#486800] text-[11px] font-black uppercase tracking-wider">
                    Ancient Aquatic Supercrop
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1e3a1f] leading-tight">
                    Grown in Traditional Wetland Agro-Ecology Ponds
                  </h2>
                  <p className="text-xs sm:text-sm text-[#434936] leading-relaxed">
                    Makhana (Euryale ferox) is cultivated by traditional Mallah diving communities in the perennial aquatic ponds across protected wetland heritage belts in Mithila. The seeds mature deep within the muddy lakebed, untouched by synthetic soil fertilizers or airborne pollutants.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-[#f5f3f0] p-4 rounded-2xl shadow-2xs flex items-start gap-3">
                      <Droplets size={22} className="text-[#486800] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black text-[#1e3a1f]">Naturally Organic Mud</h4>
                        <p className="text-[11px] text-[#434936] mt-0.5">
                          Grown entirely in zero-fertilizer alluvial aquatic silt.
                        </p>
                      </div>
                    </div>
                    <div className="bg-[#f5f3f0] p-4 rounded-2xl shadow-2xs flex items-start gap-3">
                      <Flame size={22} className="text-[#486800] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black text-[#1e3a1f]">Hand-Popped with Fire</h4>
                        <p className="text-[11px] text-[#434936] mt-0.5">
                          Wood-fire cast iron roasted and cracked with bamboo mallets.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#434936] leading-relaxed">
                    AgriCola enforces a strict Grade 6A diameter protocol (&gt;18mm), filtering out crushed residue, husks, or hard black spots. What reaches your kitchen is 100% white, airy, cloud-like kernels ready for roasting.
                  </p>
                </div>

                <div className="md:col-span-5">
                  <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-[4/5] bg-gray-100">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBLu6AZbZYV_alua8yyFKEWVWJBqJ7aYZ54KPxWtkkfdicebKn-t8_x5c75Sxl-B0FWZlwlMZy6DCBhACHtaFZP-ep8UJOoHNCOimUtGfmCx6iwmDRHd-GE5pq_0GBLjrQTOBkbjPaEisna7Z2SZEkaUoAwo5gJpITHQGv5iZ8EwI1ESN6xWoBlxgG5tidaEmdHYRmPjx5-9aDoiuBlqvaPQFES6L2N5gKIS30I2-T95GOCE8LPeTRb"
                      alt="Artisanal Mallah fisherman harvesting fresh aquatic lotus seeds"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/80 via-black/30 to-transparent text-white">
                      <span className="text-[10px] text-[#bcf455] font-black uppercase tracking-wider">
                        Authentic Mithila GI Heritage
                      </span>
                      <p className="text-xs sm:text-sm font-bold mt-1">
                        Geographical Indication Protected Heritage Makhana
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Nutrition Facts & Lab COA */}
            {activeTab === "nutrition" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start animate-fadeIn">
                {/* Table */}
                <div className="md:col-span-7 bg-[#fbf9f6] p-6 rounded-3xl border border-gray-100 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
                    <div>
                      <h3 className="text-sm font-black text-[#1e3a1f]">Nutrition Table (Per 100g Serving)</h3>
                      <span className="text-[11px] text-gray-500">NABL Accredited Laboratory Assay &amp; Analysis</span>
                    </div>
                    <span className="bg-[#c9ecc4] text-[#1e3a1f] px-3 py-1 rounded-full text-xs font-black">
                      347 kcal
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 text-xs text-[#434936]">
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Plant Protein</span>
                      <span className="font-black text-[#1e3a1f]">9.7 g (19% RDA)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Total Dietary Fiber</span>
                      <span className="font-black text-[#1e3a1f]">14.5 g</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Total Carbohydrates</span>
                      <span className="font-black text-[#1e3a1f]">76.9 g</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Total Fats</span>
                      <span className="font-black text-[#1e3a1f]">0.1 g (Virtually Zero)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Trans Fat &amp; Cholesterol</span>
                      <span className="font-black text-[#486800]">0.0 mg (100% Free)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Calcium</span>
                      <span className="font-black text-[#1e3a1f]">60.0 mg</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/50">
                      <span>Magnesium &amp; Potassium</span>
                      <span className="font-black text-[#1e3a1f]">210.0 mg / 500.0 mg</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span>Glycemic Index (GI)</span>
                      <span className="font-black text-[#486800]">Low (&lt;55) • Diabetic Friendly</span>
                    </div>
                  </div>
                </div>

                {/* Lab Certificate Box */}
                <div className="md:col-span-5 flex flex-col gap-4">
                  <div className="bg-[#f5f3f0] p-6 rounded-3xl shadow-2xs flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-[#486800] font-black text-sm">
                      <ShieldCheck size={18} />
                      <span>NABL Lab Quality Test Report</span>
                    </div>
                    <p className="text-xs text-[#434936] leading-relaxed">
                      Every batch is third-party screened for 210 pesticide residues, heavy metals (lead, cadmium, mercury), and moisture retention.
                    </p>
                    <div className="bg-white p-3.5 rounded-2xl flex items-center justify-between shadow-2xs border border-gray-200">
                      <div className="flex items-center gap-2.5">
                        <FileText size={20} className="text-rose-600" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#1e3a1f]">Batch_Analysis_Report.pdf</span>
                          <span className="text-[10px] text-gray-400">1.4 MB • Signed by Lead Biochemist</span>
                        </div>
                      </div>
                      <a
                        href="/certificates"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#486800] hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download size={14} />
                        <span>View</span>
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-white p-2.5 rounded-xl text-center border border-gray-200">
                        <span className="text-xs text-[#486800] font-black block">0.0 ppm</span>
                        <span className="text-[10px] text-gray-500 font-semibold">Sulfur Dioxide</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl text-center border border-gray-200">
                        <span className="text-xs text-[#486800] font-black block">Pass</span>
                        <span className="text-[10px] text-gray-500 font-semibold">Non-GMO Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: How to Roast & Recipes */}
            {activeTab === "recipes" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fadeIn">
                {/* Recipe 1 */}
                <div className="bg-[#fbf9f6] p-4 rounded-3xl shadow-2xs border border-gray-100 flex flex-col gap-3">
                  <div className="h-44 rounded-2xl overflow-hidden bg-gray-100">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAK9dNmPgv0cKu0_QVDDd3xEFA9OrAEggv1308Q5yt3dJd77POUKRSVRwaLmturDR1Y86RmlY2o9b99LEMsikgHrQz_f5wlGOqx7fE-IPv5yo0bkYfeVviTWQnRe84a7T5sjclhnkEglJmwYGxK_mqAe1cwTxfWWq0-DfRJy27uTlMEInp2NcrITZwI1rMorkZ-o_3VxCVQF9OetAvWM7a7j9MQPO-BCU_AX_lVKKmCJOTSXhWV_iFC"
                      alt="Ghee & Himalayan Salt Roast"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="bg-[#c9ecc4] text-[#1e3a1f] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full w-fit">
                    5-Min Snack
                  </span>
                  <h4 className="text-sm font-black text-[#1e3a1f]">Ghee &amp; Himalayan Salt Roast</h4>
                  <p className="text-xs text-[#434936] leading-relaxed">
                    Warm 1 tbsp AgriCola A2 Gir Cow Ghee in a heavy pan. Add 100g Jumbo Makhana, roast on low heat for 4-5 mins until crisp. Sprinkle Himalayan rock salt and crushed black pepper.
                  </p>
                </div>

                {/* Recipe 2 */}
                <div className="bg-[#fbf9f6] p-4 rounded-3xl shadow-2xs border border-gray-100 flex flex-col gap-3">
                  <div className="h-44 rounded-2xl overflow-hidden bg-gray-100">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCts_Ht0UhocXt50fPBVGGfNIT2EPeHSTDHkK8uqGgIampH--wauzCOtI238tadMW_kpxCG7iPlu-ocC1Am9g1f-DVzE1S7G8Fas-QZOVfqBCaCgNtFr4tDfyAUrjet0u1GndRTX3CaElxgO70X0pdBldxPBF6jDaYxxow8Rv81FqGXTgzHD2zHxkpCp6EELRqi9R6kzJbJ9q_3judP8Is0knRuo3MJmFrby1fc3YpXEghLvjv-AT48"
                      alt="Pudina Masala Crunch"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="bg-[#84b817]/20 text-[#486800] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full w-fit">
                    Tangy &amp; Bold
                  </span>
                  <h4 className="text-sm font-black text-[#1e3a1f]">Pudina Masala Crunch</h4>
                  <p className="text-xs text-[#434936] leading-relaxed">
                    Dry roast makhana on low heat. Emulsify 1 tsp cold pressed mustard oil with dried mint powder, chaat masala, and amchur. Toss hot makhana for an addictive afternoon tea crunch.
                  </p>
                </div>

                {/* Recipe 3 */}
                <div className="bg-[#fbf9f6] p-4 rounded-3xl shadow-2xs border border-gray-100 flex flex-col gap-3">
                  <div className="h-44 rounded-2xl overflow-hidden bg-gray-100">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2ege8AC_xrGwBivxxu717htVY7KGjceK8SkEgp5KxALqnbFG9to9Ih_uNxfmSI4WN-qUC7w2Dg4byWHPtEVqKKb-P1BNOPH8H4krYppZ65nY4PcrNoJNDUPUU4rQ6AbugwXRJQ9-dozooSXL_YLxbp5u3CJwFg03Us_VVxDASV-_3hHkb-2aO7Qk3t2KNu7wbKlVhPvaHNzqh3d4jYfEvmtgpX4ipvrRRw4o7nyl1IAOpxeXJk1cJ"
                      alt="Mithila Saffron Kheer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="bg-[#ffdcc3] text-[#904d00] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full w-fit">
                    Festive Royal Sweet
                  </span>
                  <h4 className="text-sm font-black text-[#1e3a1f]">Mithila Saffron Kheer</h4>
                  <p className="text-xs text-[#434936] leading-relaxed">
                    Crush half the roasted makhana coarsely. Simmer in rich whole milk with green cardamom, Kashmiri saffron strands, and raw jaggery until creamy and thick. Serve chilled.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 4: Verified Customer Reviews */}
            {activeTab === "reviews" && (
              <div className="space-y-8 animate-fadeIn">
                {/* Rating Overview */}
                <div className="bg-[#f5f3f0] p-6 sm:p-8 rounded-3xl shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left">
                    <span className="text-5xl font-black text-[#1e3a1f] leading-none">4.9</span>
                    <div className="flex items-center text-amber-400 mt-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={20} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 mt-1">
                      Based on {totalReviewsCount.toLocaleString()} verified farm purchases
                    </span>
                  </div>

                  {/* Distribution Progress Bars */}
                  <div className="md:col-span-8 flex flex-col gap-2 text-xs">
                    {[
                      { star: "5 Star", percent: 92, count: "92%" },
                      { star: "4 Star", percent: 6, count: "6%" },
                      { star: "3 Star", percent: 1.5, count: "1.5%" },
                      { star: "2 Star", percent: 0.3, count: "<1%" },
                      { star: "1 Star", percent: 0.2, count: "<1%" },
                    ].map((row) => (
                      <div key={row.star} className="flex items-center gap-3">
                        <span className="w-12 text-[#1e3a1f] font-bold">{row.star}</span>
                        <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#486800] rounded-full" style={{ width: `${row.percent}%` }} />
                        </div>
                        <span className="w-10 text-right text-gray-500 font-mono">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review Submission Form */}
                <div className="bg-[#fbf9f6] p-6 rounded-3xl border border-gray-200 max-w-xl">
                  <h4 className="text-sm font-black text-[#1e3a1f] mb-2">Write a Verified Review</h4>
                  {reviewDone ? (
                    <p className="text-xs font-bold text-[#486800] bg-[#c9ecc4] p-3 rounded-xl">
                      ✓ Thank you! Your verified review has been submitted.
                    </p>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-[#1e3a1f] block mb-1">Your Rating</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormRating(star)}
                              className="text-amber-400 cursor-pointer text-lg"
                            >
                              <Star
                                size={22}
                                className={star <= formRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Review Title (e.g. Incredibly fresh and crunchy!)"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="w-full bg-white px-3.5 py-2.5 rounded-xl text-xs text-[#1e3a1f] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                        />
                      </div>
                      <div>
                        <textarea
                          required
                          rows={3}
                          placeholder="Share your experience with this harvest lot..."
                          value={formComment}
                          onChange={(e) => setFormComment(e.target.value)}
                          className="w-full bg-white px-3.5 py-2 rounded-xl text-xs text-[#1e3a1f] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                        />
                      </div>
                      {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
                      <button
                        type="submit"
                        disabled={reviewSubmitting}
                        className="bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {reviewSubmitting ? "Submitting…" : "Submit Review"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Review Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preset Review 1 */}
                  <div className="bg-[#fbf9f6] p-5 rounded-2xl shadow-2xs border border-gray-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-[#c9ecc4] text-[#1e3a1f] font-black flex items-center justify-center text-xs">
                          AN
                        </div>
                        <div>
                          <span className="text-xs font-black text-[#1e3a1f] block">Ananya, New Delhi</span>
                          <span className="text-[10px] text-[#486800] font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> Community Experience • New Delhi
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400">3 days ago</span>
                    </div>
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-xs text-[#434936] leading-relaxed">
                      &ldquo;Unmatched size. I had previously bought grocery store packets that were half crushed and chewy. These popped makhana kernels are huge, completely round, and roast to glass-like crispiness in 3 minutes!&rdquo;
                    </p>
                  </div>

                  {/* Preset Review 2 */}
                  <div className="bg-[#fbf9f6] p-5 rounded-2xl shadow-2xs border border-gray-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-[#ffdcc3] text-[#904d00] font-black flex items-center justify-center text-xs">
                          VK
                        </div>
                        <div>
                          <span className="text-xs font-black text-[#1e3a1f] block">Vikram, Chandigarh</span>
                          <span className="text-[10px] text-[#486800] font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> Community Experience • Chandigarh
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400">1 week ago</span>
                    </div>
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-xs text-[#434936] leading-relaxed">
                      &ldquo;Zero chemical smell. Most commercial brands use sulfur to whiten foxnuts. You can genuinely taste the difference here — pure, clean, and packed with high protein crunch.&rdquo;
                    </p>
                  </div>

                  {/* Dynamic user reviews */}
                  {reviews.map((r) => (
                    <div key={r.id} className="bg-[#fbf9f6] p-5 rounded-2xl shadow-2xs border border-gray-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-800 font-black flex items-center justify-center text-xs">
                            {r.name ? r.name.substring(0, 2).toUpperCase() : "AG"}
                          </div>
                          <div>
                            <span className="text-xs font-black text-[#1e3a1f] block">{r.name || "Community Member"}</span>
                            <span className="text-[10px] text-[#486800] font-bold flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> Community Feedback
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex text-amber-400">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      {r.title && <h5 className="text-xs font-bold text-[#1e3a1f]">{r.title}</h5>}
                      <p className="text-xs text-[#434936] leading-relaxed">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── You May Also Like / Companion Harvests ── */}
        {similar.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#486800]">
                  Companion Harvests
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] mt-1">
                  You May Also Like
                </h2>
              </div>
              <Link
                to="/products"
                className="text-xs sm:text-sm font-bold text-[#486800] hover:text-[#1e3a1f] transition-colors flex items-center gap-1"
              >
                <span>View Full Catalog</span>
                <span>→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similar.map((p) => (
                <ProductCard key={p.mongoId} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
