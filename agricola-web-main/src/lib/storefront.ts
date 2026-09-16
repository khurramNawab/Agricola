// Public storefront API (no auth) — products and categories for the landing page
// and collection views. Maps the backend's public shapes to UI-friendly objects.

import { apiFetch } from "./api";
import { getCustomerToken } from "./storefrontAuth";

export interface StorefrontProduct {
  id: string; // productId, e.g. "P005" (used for routing to detail)
  mongoId: string; // Mongo _id
  title: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  sizes: string[];
  tags: string[];
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  stock?: number;
  newlyAdded: boolean;
  /** Admin-controlled organic tag — defaults to true */
  isOrganic: boolean;
  variantStocks?: { size: string; stock: number; price?: number }[];
  category: { id: string; name: string; slug: string } | null;
  video?: { url: string; publicId?: string };
  videoUrl?: string;
}

/** Fuller product shape for the detail page (full gallery + long-form copy). */
export interface StorefrontProductDetail extends StorefrontProduct {
  images: string[];
  about: string;
  usageInstructions: string;
  whyChoose: string;
}

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
  description?: string | null;
  minPrice?: number | null;
}

interface RawProduct {
  id: string;
  _id: string;
  title: string;
  price: number;
  oldPrice: number | null;
  rating?: number;
  reviewsCount?: number;
  tags?: string[];
  sizes?: string[];
  images?: (string | { url: string })[];
  video?: { url: string; publicId?: string };
  videoUrl?: string;
  newlyAdded?: boolean;
  inStock?: boolean;
  stock?: number;
  isOrganic?: boolean;
  variantStocks?: { size: string; stock: number; price?: number }[];
  about?: string;
  usageInstructions?: string;
  whyChoose?: string;
  category?: { id: string; name: string; slug: string } | null;
}

interface RawCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | { url: string } | null;
  productCount?: number;
  minPrice?: number | null;
}

const firstImage = (images?: (string | { url: string })[]): string | null => {
  const first = images?.[0];
  if (!first) return null;
  return typeof first === "string" ? first : first.url ?? null;
};

const mapProduct = (p: RawProduct): StorefrontProduct => ({
  id: p.id,
  mongoId: p._id,
  title: p.title,
  price: p.price,
  oldPrice: p.oldPrice ?? null,
  image: firstImage(p.images),
  sizes: p.sizes ?? [],
  tags: p.tags ?? [],
  rating: p.rating ?? 0,
  reviewsCount: p.reviewsCount ?? 0,
  inStock: p.inStock !== false,
  stock: p.stock,
  newlyAdded: !!p.newlyAdded,
  isOrganic: p.isOrganic !== false, // default true for existing products
  variantStocks: (p.variantStocks || []).map((v: any) => ({
    size: v.size,
    stock: typeof v.stock === 'number' ? v.stock : 0,
    price: v.price || p.price,
  })),
  category: p.category ?? null,
  video: p.video,
  videoUrl: p.videoUrl || p.video?.url,
});

const allImages = (images?: (string | { url: string })[]): string[] =>
  (images ?? [])
    .map((img) => (typeof img === "string" ? img : img?.url))
    .filter((url): url is string => !!url);

const mapProductDetail = (p: RawProduct): StorefrontProductDetail => ({
  ...mapProduct(p),
  images: allImages(p.images),
  about: p.about ?? "",
  usageInstructions: p.usageInstructions ?? "",
  whyChoose: p.whyChoose ?? "",
});

const mapCategory = (c: RawCategory): StorefrontCategory => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  image: c.image ? (typeof c.image === "string" ? c.image : c.image.url) : null,
  productCount: c.productCount ?? 0,
  description: c.description ?? null,
  minPrice: typeof c.minPrice === 'number' ? c.minPrice : null,
});

export async function getProducts(
  params: { page?: number; limit?: number; category?: string; sort?: string; search?: string; ids?: string } = {},
  signal?: AbortSignal
): Promise<StorefrontProduct[]> {
  const res = await apiFetch<RawProduct[]>("/products", {
    auth: false,
    query: {
      page: params.page,
      limit: params.limit,
      category: params.category,
      sort: params.sort,
      search: params.search,
      ids: params.ids,
    },
    signal,
  });
  return (res.data ?? []).map(mapProduct);
}

/** Best sellers for the landing page: featured first, falling back to recent. */
export async function getBestSellers(limit = 4, signal?: AbortSignal): Promise<StorefrontProduct[]> {
  const featured = await apiFetch<RawProduct[]>("/products/featured", {
    auth: false,
    query: { limit },
    signal,
  });
  if (featured.data && featured.data.length) return featured.data.map(mapProduct);
  return getProducts({ limit, sort: "-createdAt" }, signal);
}

export async function getCategories(limit = 8, signal?: AbortSignal): Promise<StorefrontCategory[]> {
  const res = await apiFetch<RawCategory[]>("/categories", {
    auth: false,
    query: { limit },
    signal,
  });
  return (res.data ?? []).map(mapCategory);
}

/** Fetch a single product by Mongo _id or productId ("P005"). */
export async function getProduct(
  identifier: string,
  signal?: AbortSignal
): Promise<StorefrontProductDetail> {
  const res = await apiFetch<RawProduct>(
    `/products/${encodeURIComponent(identifier)}`,
    { auth: false, signal }
  );
  return mapProductDetail(res.data as RawProduct);
}

/** Products in the same category, for the "Similar Products" carousel. */
export async function getSimilarProducts(
  identifier: string,
  limit = 4,
  signal?: AbortSignal
): Promise<StorefrontProduct[]> {
  const res = await apiFetch<RawProduct[]>(
    `/products/${encodeURIComponent(identifier)}/similar`,
    { auth: false, query: { limit }, signal }
  );
  return (res.data ?? []).map(mapProduct);
}

export interface ProductReview {
  id: string;
  name: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
}

export interface ReviewsResponse {
  reviews: ProductReview[];
  summary: ReviewSummary;
}

/** Approved reviews + aggregate rating for a product (public). */
export async function getReviews(
  identifier: string,
  signal?: AbortSignal
): Promise<ReviewsResponse> {
  const res = await apiFetch<ReviewsResponse>(
    `/products/${encodeURIComponent(identifier)}/reviews`,
    { auth: false, signal }
  );
  return res.data ?? { reviews: [], summary: { average: 0, count: 0 } };
}

/** Create/update the logged-in customer's review for a product. */
export async function submitReview(
  identifier: string,
  input: { rating: number; comment: string; title?: string }
): Promise<{ review: ProductReview; summary: ReviewSummary }> {
  const res = await apiFetch<{ review: ProductReview; summary: ReviewSummary }>(
    `/products/${encodeURIComponent(identifier)}/reviews`,
    { method: "POST", token: getCustomerToken(), body: input }
  );
  return res.data as { review: ProductReview; summary: ReviewSummary };
}

/** Popular search terms aggregated from categories and frequent product tags. */
export async function getPopularSearches(signal?: AbortSignal): Promise<string[]> {
  const res = await apiFetch<string[]>("/search/popular", { auth: false, signal });
  return res.data ?? [];
}
