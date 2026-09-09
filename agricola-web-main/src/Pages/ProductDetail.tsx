import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, Heart } from "lucide-react";
import { StarIcon } from "../assets/icons";
import Footer from "../components/layout/Footer";
import ProductCard from "../components/ProductCard";
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
import PincodeCheck from "../components/delivery/PincodeCheck";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=800&q=70";

// --- Static fallbacks shown when a product hasn't been fully filled in yet ----
const FALLBACK_TAGS = ["Organic Certified", "Perfect Gift"];
const FALLBACK_RATING = 4;
const FALLBACK_REVIEWS_COUNT = 63;
const FALLBACK_SIZES = ["250g", "500g"];

const FALLBACK_ABOUT =
  "Sourced with care and packed in small batches, this product is delivered fresh so it reaches you at its very best. Quality you can see, taste, and trust.";
const FALLBACK_USAGE =
  "Store in a cool, dry place away from direct sunlight. For best results, use soon after opening and follow any packaging guidance. Keep sealed to retain freshness.";
const FALLBACK_WHY =
  "Sustainably sourced from trusted farms and carefully selected, so you get wholesome, high-quality produce — perfect for everyday use or gifting.";

const STATIC_REVIEWS = [
  {
    name: "Arjun P.",
    rating: 4,
    text: "Amazing quality! You can really taste the freshness. Also love that it's responsibly sourced — a healthier choice for the whole family.",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Neha S.",
    rating: 5,
    text: "Fresh, clean, and exactly as described. This has quietly become a staple in my kitchen.",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Vikram R.",
    rating: 5,
    text: "Fast delivery and premium packaging. The quality is excellent — highly recommend to anyone who values good produce.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
  },
];

function Rating({ value }: { value: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={`h-4 w-4 ${
            i < Math.round(value) ? "text-yellow-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

// Page chrome. Module-level so it keeps a stable identity (nesting it would
// remount the subtree each render).
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, openAuth, addItem } = useStorefront();

  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [similar, setSimilar] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState("");

  const [question, setQuestion] = useState("");
  const [questionSent, setQuestionSent] = useState(false);

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
    setQuestionSent(false);
    setQuestion("");
    setReviews([]);
    setReviewSummary(null);
    setReviewDone(false);
    setReviewError("");

    getProduct(id, controller.signal)
      .then((p) => {
        setProduct(p);
        setSelectedSize(p.sizes[0] ?? FALLBACK_SIZES[0]);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Product not found.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    // Reviews (best-effort): real reviews + aggregate summary.
    getReviews(id, controller.signal)
      .then((res) => {
        setReviews(res.reviews);
        setReviewSummary(res.summary);
      })
      .catch(() => {});

    // Similar products: real same-category first; fall back to other products so
    // the section never sits empty. Best-effort — failures are swallowed.
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

  const handleAddToCart = () => {
    if (!product) return;

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
        // Replace any prior review by this user, newest first.
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
      <Shell>
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="h-[480px] animate-pulse rounded-2xl bg-gray-200" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-12 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-11 w-full animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !product) {
    return (
      <Shell>
        <div className="container mx-auto px-4 py-24 text-center">
          <p className="mb-6 text-gray-500">{error || "Product not found."}</p>
          <button
            onClick={() => navigate("/products")}
            className="rounded-lg bg-[#84b817] px-8 py-3 font-medium text-white transition-colors hover:bg-[#6d9913]"
          >
            Back to Products
          </button>
        </div>
      </Shell>
    );
  }

  // Apply static fallbacks for anything the product doesn't have yet.
  const baseImages = product.images.length > 0 ? product.images : [FALLBACK_IMAGE];
  const gallery = [...baseImages];
  while (gallery.length < 6) gallery.push(baseImages[gallery.length % baseImages.length]);

  const tags = product.tags.length > 0 ? product.tags : FALLBACK_TAGS;
  const sizes = product.sizes.length > 0 ? product.sizes : FALLBACK_SIZES;
  // Prefer the live review summary, then the product's stored rating, then static.
  const realCount = reviewSummary?.count ?? product.reviewsCount;
  const realAverage = reviewSummary?.average ?? product.rating;
  const ratingValue = realCount > 0 ? realAverage : FALLBACK_RATING;
  const reviewsCount = realCount > 0 ? realCount : FALLBACK_REVIEWS_COUNT;
  const hasDiscount = !!product.oldPrice && product.oldPrice > product.price;

  const addLabel = adding
    ? "Adding…"
    : added
    ? "Added ✓"
    : !product.inStock
    ? "Out of Stock"
    : "Add to Cart";

  return (
    <Shell>
      {/* Breadcrumb */}
      <div className="border-b border-gray-100">
        <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-sm">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-bold text-green-600">
            Agri<span className="text-gray-700">Cola</span>
          </span>
          <span className="ml-2 flex flex-wrap items-center gap-2 text-gray-400 sm:ml-8">
            Homepage <ChevronRight className="h-3 w-3" />
            {product.category && (
              <>
                {product.category.name} <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-gray-700">{product.title}</span>
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Top: gallery + details */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="relative flex h-[480px] items-center justify-center rounded-2xl bg-gray-100">
              <img
                src={gallery[activeImage]}
                alt={product.title}
                className="h-full w-full rounded-2xl object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              <button
                onClick={() =>
                  setActiveImage((i) => (i - 1 + gallery.length) % gallery.length)
                }
                aria-label="Previous image"
                className="absolute left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow hover:bg-gray-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveImage((i) => (i + 1) % gallery.length)}
                aria-label="Next image"
                className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow hover:bg-gray-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-4">
              {gallery.slice(0, 6).map((thumb, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`h-24 overflow-hidden rounded-xl border-2 ${
                    activeImage === i ? "border-gray-900" : "border-transparent"
                  }`}
                >
                  <img
                    src={thumb}
                    alt={`${product.title} thumbnail ${i + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="mb-3 flex items-center gap-1 text-sm text-yellow-500">
              <Sparkles className="h-4 w-4" />{" "}
              {product.newlyAdded ? "Newly Added" : "Bestseller"}
            </div>
            <h1 className="mb-4 text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-gray-900">
              {product.title}
            </h1>
            <div className="mb-4 flex items-center gap-2">
              <Rating value={ratingValue} />
              <span className="text-sm text-gray-500">{reviewsCount} Reviews</span>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mb-6 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-green-600">
                &#8377;{product.price}
              </span>
              {hasDiscount && (
                <span className="text-3xl font-bold text-gray-300 line-through">
                  &#8377;{product.oldPrice}
                </span>
              )}
            </div>

            <p className="mb-2 text-sm text-gray-500">Select Quantity</p>
            <div className="mb-6 flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                    selectedSize === s
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mb-6 rounded-lg bg-gray-100 p-4 text-sm italic text-gray-600">
              "Experience the freshness and quality of {product.title},
              sourced with care and crafted for those who value the best."
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAddToCart}
                disabled={adding || !product.inStock}
                className="flex-1 rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addLabel}
              </button>
              <button
                aria-label="Add to wishlist"
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-red-500"
              >
                <Heart className="h-5 w-5" />
              </button>
            </div>
            {addError && <p className="mt-3 text-sm text-red-500">{addError}</p>}

            {/* Delivery availability + carrier ETA (advisory — never blocks add-to-cart) */}
            <PincodeCheck variant="product" className="mt-6" />
          </div>
        </div>

        {/* Info sections */}
        <div className="mt-16 max-w-5xl space-y-8">
          <section>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">About This Product</h2>
            <p className="whitespace-pre-line text-gray-600">
              {product.about || FALLBACK_ABOUT}
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              How to Use
            </h2>
            <p className="whitespace-pre-line text-gray-600">
              {product.usageInstructions || FALLBACK_USAGE}
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">
              Why Choose This Product
            </h2>
            <p className="whitespace-pre-line text-gray-600">
              {product.whyChoose || FALLBACK_WHY}
            </p>
          </section>
        </div>

        {/* Reviews: real when present, static placeholders otherwise. */}
        <section className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            What Our Customers Say About this Product
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {reviews.length > 0
              ? reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
                  >
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-lg bg-green-500 text-5xl font-bold text-white">
                      {review.name.charAt(0).toUpperCase()}
                    </div>
                    <h4 className="mb-1 text-xl font-bold text-gray-900">
                      {review.name}
                    </h4>
                    {review.verifiedPurchase && (
                      <span className="mb-2 inline-block rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        Verified Purchase
                      </span>
                    )}
                    <div className="mb-3 flex justify-center">
                      <Rating value={review.rating} />
                    </div>
                    {review.title && (
                      <p className="mb-1 font-medium text-gray-800">
                        {review.title}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">"{review.comment}"</p>
                  </div>
                ))
              : STATIC_REVIEWS.map((review) => (
                  <div
                    key={review.name}
                    className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
                  >
                    <div className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-lg bg-green-500">
                      <img
                        src={review.avatar}
                        alt={review.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <h4 className="mb-2 text-xl font-bold text-gray-900">
                      {review.name}
                    </h4>
                    <div className="mb-3 flex justify-center">
                      <Rating value={review.rating} />
                    </div>
                    <p className="text-sm text-gray-600">"{review.text}"</p>
                  </div>
                ))}
          </div>

          {/* Write a review */}
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-gray-100 bg-white p-6">
            <h3 className="mb-4 text-lg font-bold text-gray-900">
              Write a Review
            </h3>
            {reviewDone ? (
              <p className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                Thanks for your review!
              </p>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setFormRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      <StarIcon
                        className={`h-7 w-7 ${
                          n <= formRating ? "text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <textarea
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Share your thoughts about this product…"
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {reviewError && (
                  <p className="text-sm text-red-500">{reviewError}</p>
                )}
                <button
                  type="submit"
                  disabled={reviewSubmitting || !formComment.trim()}
                  className="rounded-lg bg-[#84b817] px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewSubmitting
                    ? "Submitting…"
                    : isLoggedIn
                    ? "Submit Review"
                    : "Log in to Review"}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Similar products */}
        {similar.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
              Similar Products
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((p) => (
                <ProductCard key={p.mongoId} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Question */}
        <section className="mt-16">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">
            Have a Question in your mind?
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Send us your query. We'll try to reach out to you via your email.
          </p>
          {questionSent ? (
            <p className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              Thanks for reaching out! Our team will get back to you soon.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim()) return;
                setQuestionSent(true);
                setQuestion("");
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Type here"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-8 py-3 font-medium text-white transition-colors hover:bg-gray-800"
              >
                Send
              </button>
            </form>
          )}
        </section>
      </div>
    </Shell>
  );
}
