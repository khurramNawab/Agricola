// Maps internal Mongoose documents to the shapes the frontend expects
// (per API_SPECIFICATION.md). Keeps DB schema and API contract decoupled.

const imageUrls = (images) =>
  (images || []).map((img) => (typeof img === 'string' ? img : img?.url)).filter(Boolean);

const primaryImage = (images) => imageUrls(images)[0] || '';

/**
 * Full product shape for grid + detail pages.
 * @param {object} product - Product document (optionally populated category)
 */
const toProduct = (product) => {
  if (!product) return null;
  const p = typeof product.toObject === 'function' ? product.toObject({ virtuals: true }) : product;
  return {
    id: p.productId || String(p._id),
    _id: String(p._id),
    title: p.name,
    price: p.price,
    oldPrice: p.compareAtPrice || null,
    rating: p.rating?.average || 0,
    reviewsCount: p.rating?.count || 0,
    tags: p.tags || [],
    sizes: p.sizes || [],
    variantStocks: (p.variantStocks || []).map((v) => ({
      size: v.size,
      stock: v.stock !== undefined ? v.stock : 0,
      price: v.price || p.price
    })),
    images: imageUrls(p.images),
    image: primaryImage(p.images),
    newlyAdded: !!p.newlyAdded,
    about: p.about || '',
    usageInstructions: p.usageInstructions || '',
    stock: p.stock !== undefined ? p.stock : 0,
    inStock: (p.stock || 0) > 0 && p.status === 'active',
    // isOrganic defaults to true for existing products that don't have the field set yet.
    isOrganic: p.isOrganic !== false,
    category: p.category && typeof p.category === 'object'
      ? { id: String(p.category._id), name: p.category.name, slug: p.category.slug }
      : (p.category ? String(p.category) : null)
  };
};

/**
 * Compact "trending"/search-card shape: { id, title, weight, price, oldPrice, image }
 */
const toProductCard = (product) => {
  if (!product) return null;
  const p = typeof product.toObject === 'function' ? product.toObject() : product;
  return {
    id: p.productId || String(p._id),
    title: p.name,
    weight: (p.sizes && p.sizes[0]) || null,
    price: p.price,
    oldPrice: p.compareAtPrice || null,
    image: primaryImage(p.images)
  };
};

/**
 * Category shape: { id, name, image, productCount }
 */
const toCategory = (category) => {
  if (!category) return null;
  const c = typeof category.toObject === 'function' ? category.toObject({ virtuals: true }) : category;
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    image: c.image?.url || null,
    productCount: typeof c.productCount === 'number' ? c.productCount : (c.productCount || 0)
  };
};

module.exports = {
  toProduct,
  toProductCard,
  toCategory,
  imageUrls,
  primaryImage
};
