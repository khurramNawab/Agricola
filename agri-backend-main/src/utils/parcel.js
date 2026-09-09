// Parcel measurement: how much does a cart/order line actually weigh?
//
// The catalog stores two different "weights":
//   product.sizes    -> the pack variants an admin offers, e.g. ["200g", "1kg"]
//   product.weight   -> {value, unit}, a physical weight the admin UI has no field for
//
// The admin only ever sets `sizes`, and the selected one is copied onto every cart/order
// line (`item.weight === "200g"`), so THAT is the authoritative shipping weight. Falling
// back to product.weight alone meant every line was quoted and booked at the 0.5kg
// default — over-stating a 200g pouch and under-stating anything above half a kilo.
//
// Unit handling matters as much as the source: a `{value: 250, unit: 'g'}` product read
// as plain kilograms quotes a 250kg parcel.

const KG_PER_UNIT = { g: 0.001, gm: 0.001, gms: 0.001, gram: 0.001, grams: 0.001, kg: 1, kgs: 1, kilogram: 1, kilograms: 1, lb: 0.453592, lbs: 0.453592 };

// Shiprocket's minimum billable weight, and a sane floor for any carrier.
const MIN_PARCEL_KG = 0.5;

/** Weight in kg from a value+unit pair, e.g. (250, 'g') -> 0.25. */
const toKg = (value, unit) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n * (KG_PER_UNIT[String(unit || 'kg').toLowerCase()] ?? 1);
};

/**
 * Weight in kg from a pack-size label: "200g" -> 0.2, "1kg" -> 1, "1.5 KG" -> 1.5.
 * Returns null for anything that isn't a weight (e.g. "Small", "500ml").
 */
const parseSizeToKg = (label) => {
  const match = /^\s*([\d.]+)\s*(g|gm|gms|gram|grams|kg|kgs|kilogram|kilograms|lb|lbs)\s*$/i.exec(String(label || ''));
  return match ? toKg(match[1], match[2].toLowerCase()) : null;
};

/**
 * Per-unit shipping weight for one line, in kg. Precedence: the selected pack size,
 * then the product's physical weight, then the default.
 * @param {{sizeLabel?: string|null, product?: object}} line
 * @returns {number} kg for a single unit (never zero)
 */
const unitWeightKg = ({ sizeLabel, product } = {}) =>
  parseSizeToKg(sizeLabel) ||
  toKg(product?.weight?.value, product?.weight?.unit) ||
  // A single-size product whose label wasn't carried on the line (e.g. an older order).
  parseSizeToKg(Array.isArray(product?.sizes) && product.sizes.length === 1 ? product.sizes[0] : null) ||
  MIN_PARCEL_KG;

/**
 * Total shipping weight in kg for a set of lines.
 * @param {Array<{weight?: string|null, quantity?: number, qty?: number, product?: object}>} lines
 */
const totalWeightKg = (lines = []) =>
  lines.reduce((sum, line) => {
    const qty = Number(line.quantity ?? line.qty ?? 1) || 1;
    const product = line.product && typeof line.product === 'object' ? line.product : null;
    return sum + unitWeightKg({ sizeLabel: line.weight, product }) * qty;
  }, 0);

/**
 * Parcel dimensions in cm when the catalog has none. Volumetric weight is billed off
 * these, so they are env-tunable without a deploy.
 */
const defaultDimsCm = () => ({
  length: parseFloat(process.env.PARCEL_DEFAULT_LENGTH_CM) || 20,
  width: parseFloat(process.env.PARCEL_DEFAULT_WIDTH_CM) || 20,
  height: parseFloat(process.env.PARCEL_DEFAULT_HEIGHT_CM) || 10
});

const toCm = (value, unit) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'inch' ? n * 2.54 : n;
};

/**
 * Dimensions (cm) of the single box these lines ship in: widest footprint, heights
 * stacked by quantity.
 *
 * Only REAL per-item dimensions stack. A product with no dimensions contributes the
 * default box once, because that default describes a parcel, not one item — stacking it
 * per unit turned 3 pouches into a 30cm tower and 2.4kg of volumetric weight, which
 * carriers bill instead of the 0.6kg the parcel actually weighs. Set the real numbers
 * via PARCEL_DEFAULT_*_CM (or per product) to tighten this further.
 */
const parcelDimsCm = (lines = []) => {
  const fallback = defaultDimsCm();
  let length = 0;
  let width = 0;
  let stackedHeight = 0;

  for (const line of lines) {
    const product = line.product && typeof line.product === 'object' ? line.product : null;
    const dims = product?.dimensions;
    const unit = dims?.unit || 'cm';
    const qty = Number(line.quantity ?? line.qty ?? 1) || 1;

    const l = toCm(dims?.length, unit);
    const w = toCm(dims?.width, unit);
    const h = toCm(dims?.height, unit);

    if (l) length = Math.max(length, l);
    if (w) width = Math.max(width, w);
    if (h) stackedHeight += h * qty;
  }

  return {
    length: Math.max(1, Math.round(length || fallback.length)),
    width: Math.max(1, Math.round(width || fallback.width)),
    height: Math.max(1, Math.round(stackedHeight || fallback.height))
  };
};

module.exports = { MIN_PARCEL_KG, toKg, toCm, parseSizeToKg, unitWeightKg, totalWeightKg, defaultDimsCm, parcelDimsCm };
