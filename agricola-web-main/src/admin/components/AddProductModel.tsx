import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import ImageDropzone from './ImageDropzone';
import {
  getWarehouses,
  updateProductWarehouseStock,
  type AdminProduct,
  type ProductImage,
  type ProductPayload,
  type AdminWarehouse,
} from '../api/adminApi';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: ProductPayload) => Promise<void>;
  categories: string[];
  /** When set, the modal edits this product instead of creating a new one. */
  initial?: AdminProduct;
}

const IMAGE_SLOTS = 6; // cover + 5 extra

// Available weight variants offered when adding/editing a product.
// `key` is stored (in product.sizes); `label` is what the admin sees.
const VARIANT_OPTIONS = [
  { key: '30g', label: '30g' },
  { key: '40g', label: '40g' },
  { key: '50g', label: '50g' },
  { key: '60g', label: '60g' },
  { key: '100g', label: '100g' },
  { key: '200g', label: '200g' },
  { key: '250g', label: '250g' },
  { key: '500g', label: '500g' },
  { key: '1kg', label: '1 KG' },
  { key: '5kg', label: '5 KG' },
] as const;

const emptyVariants = (): Record<string, boolean> =>
  Object.fromEntries(VARIANT_OPTIONS.map((v) => [v.key, false]));

const emptyForm = () => ({
  name: '',
  category: '',
  originalPrice: '',
  sellingPrice: '',
  stock: '',
  featured: false,
  isOrganic: true,
  variants: emptyVariants(),
  shortDescription: '',
  about: '',
  usageInstructions: '',
  whyChoose: '',
});

export default function AddProductModal({ isOpen, onClose, onSubmit, categories, initial }: AddProductModalProps) {
  const isEdit = !!initial;
  const [formData, setFormData] = useState(emptyForm());
  const [images, setImages] = useState<(ProductImage | null)[]>(
    Array(IMAGE_SLOTS).fill(null)
  );
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoKey, setVideoKey] = useState<string>('');
  const [warehouses, setWarehouses] = useState<AdminWarehouse[]>([]);
  const [whStockMap, setWhStockMap] = useState<Record<string, string>>({});
  const [variantStocksMap, setVariantStocksMap] = useState<Record<string, string>>({});
  const [variantPricesMap, setVariantPricesMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Prefill from `initial` when opening in edit mode; clear when adding.
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    getWarehouses()
      .then((whs) => {
        if (!mounted) return;
        setWarehouses(whs);
        const map: Record<string, string> = {};

        if (initial?.warehouseStock && initial.warehouseStock.length > 0) {
          initial.warehouseStock.forEach((ws) => {
            if (ws.warehouseId) {
              map[ws.warehouseId] = String(ws.stock);
            }
          });
        }
        whs.forEach((wh) => {
          if (map[wh.id] === undefined) {
            map[wh.id] = '0';
          }
        });
        setWhStockMap(map);
      })
      .catch(() => {
        // Silently handle warehouse load failure
      });

    if (initial) {
      const vStockMap: Record<string, string> = {};
      const vPriceMap: Record<string, string> = {};
      if (initial.variantStocks && initial.variantStocks.length > 0) {
        initial.variantStocks.forEach((vs) => {
          vStockMap[vs.size] = String(vs.stock ?? 0);
          if (vs.price !== undefined && vs.price !== null) {
            vPriceMap[vs.size] = String(vs.price);
          }
        });
      }
      setVariantStocksMap(vStockMap);
      setVariantPricesMap(vPriceMap);

      setFormData({
        name: initial.name,
        category: initial.category ?? '',
        originalPrice: initial.originalPrice != null ? String(initial.originalPrice) : '',
        sellingPrice: String(initial.sellingPrice),
        stock: String(initial.stock),
        featured: !!initial.featured,
        isOrganic: initial.isOrganic !== false,
        variants: Object.fromEntries(
          VARIANT_OPTIONS.map((v) => [
            v.key,
            (initial.variantStocks && initial.variantStocks.some(vs => vs.size === v.key)) ||
            (initial.sizes && initial.sizes.includes(v.key))
          ])
        ),
        shortDescription: initial.shortDescription || '',
        about: initial.about || '',
        usageInstructions: initial.usageInstructions || '',
        whyChoose: initial.whyChoose || '',
      });
      const imgs: (ProductImage | null)[] = Array(IMAGE_SLOTS).fill(null);
      initial.images.slice(0, IMAGE_SLOTS).forEach((im, i) => {
        imgs[i] = im;
      });
      setImages(imgs);
      setVideoUrl(initial.video?.url || initial.videoUrl || '');
      setVideoKey(initial.video?.publicId || '');
    } else {
      setFormData(emptyForm());
      setImages(Array(IMAGE_SLOTS).fill(null));
      setVideoUrl('');
      setVideoKey('');
      setWhStockMap({});
      setVariantStocksMap({});
      setVariantPricesMap({});
    }
    setError('');

    return () => {
      mounted = false;
    };
  }, [isOpen, initial]);

  const reset = () => {
    setFormData(emptyForm());
    setImages(Array(IMAGE_SLOTS).fill(null));
    setVideoUrl('');
    setVideoKey('');
    setWhStockMap({});
    setVariantStocksMap({});
    setVariantPricesMap({});
    setError('');
  };

  const setImageAt = (i: number, img: ProductImage | null) =>
    setImages((prev) => prev.map((cur, idx) => (idx === i ? img : cur)));

  const handleCleanNumberInput = (field: "originalPrice" | "sellingPrice" | "stock", val: string) => {
    let cleaned = val.replace(/[^0-9]/g, "");
    if (/^0[0-9]+/.test(cleaned)) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    setFormData((prev) => ({ ...prev, [field]: cleaned }));
  };

  const handleWhStockChange = (whId: string, val: string) => {
    let cleaned = val.replace(/[^0-9]/g, "");
    if (/^0[0-9]+/.test(cleaned)) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    const nextMap = { ...whStockMap, [whId]: cleaned };
    setWhStockMap(nextMap);
    // Auto-calculate aggregate storefront stock from warehouse inputs
    const total = Object.values(nextMap).reduce((sum, curr) => sum + (parseInt(curr, 10) || 0), 0);
    setFormData((prev) => ({ ...prev, stock: String(total) }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim() || !formData.category || !formData.sellingPrice) {
      setError('Name, category and selling price are required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        category: formData.category,
        originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
        sellingPrice: Number(formData.sellingPrice),
        stock: formData.stock ? Number(formData.stock) : undefined,
        featured: formData.featured,
        isOrganic: formData.isOrganic,
        variants: formData.variants,
        variantStocks: VARIANT_OPTIONS
          .filter((v) => !!formData.variants[v.key])
          .map((v) => ({
            size: v.key,
            stock: Math.max(0, parseInt(variantStocksMap[v.key] || '0', 10) || 0),
            price: variantPricesMap[v.key] ? Number(variantPricesMap[v.key]) : undefined,
          })),
        shortDescription: formData.shortDescription,
        about: formData.about,
        usageInstructions: formData.usageInstructions,
        whyChoose: formData.whyChoose,
        images: images.filter((im): im is ProductImage => !!im),
        video: videoUrl.trim() ? { url: videoUrl.trim(), publicId: videoKey || undefined } : undefined,
        videoUrl: videoUrl.trim() || undefined,
      });

      // Update per-warehouse stock if editing existing product
      if (initial?.id && Object.keys(whStockMap).length > 0) {
        const payload = Object.entries(whStockMap).map(([warehouseId, stockStr]) => ({
          warehouseId,
          stock: Math.max(0, parseInt(stockStr, 10) || 0),
        }));
        await updateProductWarehouseStock(initial.id, payload);
      }

      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setBusy(false);
    }
  };

  const handleVariantChange = (variant: string) => {
    const willBeChecked = !formData.variants[variant];
    const nextVariants = {
      ...formData.variants,
      [variant]: willBeChecked,
    };
    setFormData((prev) => ({
      ...prev,
      variants: nextVariants,
    }));

    if (willBeChecked && !variantStocksMap[variant]) {
      setVariantStocksMap((prev) => ({ ...prev, [variant]: '0' }));
    }
  };

  const handleVariantStockChange = (variant: string, val: string) => {
    let cleaned = val.replace(/[^0-9]/g, "");
    if (/^0[0-9]+/.test(cleaned)) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    const nextMap = { ...variantStocksMap, [variant]: cleaned };
    setVariantStocksMap(nextMap);

    // Auto-calculate aggregate storefront stock from active variant stocks
    const activeKeys = VARIANT_OPTIONS.filter((v) => v.key === variant || !!formData.variants[v.key]);
    const total = activeKeys.reduce((sum, v) => {
      const stockVal = v.key === variant ? cleaned : nextMap[v.key] || '0';
      return sum + (parseInt(stockVal, 10) || 0);
    }, 0);
    setFormData((prev) => ({ ...prev, stock: String(total) }));
  };

  const handleVariantPriceChange = (variant: string, val: string) => {
    let cleaned = val.replace(/[^0-9]/g, "");
    if (/^0[0-9]+/.test(cleaned)) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    setVariantPricesMap((prev) => ({ ...prev, [variant]: cleaned }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <ImageDropzone
                variant="primary"
                folder="products"
                caption="(Cover Photo)"
                value={images[0]?.url ?? null}
                onUploaded={(img) => setImageAt(0, { url: img.url, publicId: img.key })}
                onRemove={() => setImageAt(0, null)}
              />
              {Array.from({ length: IMAGE_SLOTS - 1 }).map((_, idx) => {
                const i = idx + 1;
                return (
                  <ImageDropzone
                    key={i}
                    folder="products"
                    value={images[i]?.url ?? null}
                    onUploaded={(img) => setImageAt(i, { url: img.url, publicId: img.key })}
                    onRemove={() => setImageAt(i, null)}
                  />
                );
              })}
            </div>

            {/* Product Video Section (Myntra / Flipkart Style) */}
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-green-700 text-lg">smart_display</span>
                  <span>Product Video / Reel (Myntra &amp; Flipkart Style)</span>
                </label>
                <span className="text-xs text-gray-400">MP4, WebM, MOV (Max 50MB)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <ImageDropzone
                  folder="products/videos"
                  caption="(Upload Video File)"
                  value={videoUrl || null}
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  isVideo={true}
                  onUploaded={(file) => {
                    setVideoUrl(file.url);
                    setVideoKey(file.key);
                  }}
                  onRemove={() => {
                    setVideoUrl('');
                    setVideoKey('');
                  }}
                />
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Or Direct Video URL (CDN / S3 / Direct Link)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/demo.mp4"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                  />
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Appears directly in the product image gallery with a Play button thumbnail.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  placeholder="Product Name here"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 text-gray-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.originalPrice}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => {
                      if (e.target.value === "0") e.target.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => handleCleanNumberInput("originalPrice", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.sellingPrice}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => {
                      if (e.target.value === "0") e.target.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => handleCleanNumberInput("sellingPrice", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Storefront Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.stock}
                    onWheel={(e) => e.currentTarget.blur()}
                    onFocus={(e) => {
                      if (e.target.value === "0") e.target.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => handleCleanNumberInput("stock", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 font-semibold bg-gray-50"
                  />
                </div>
              </div>

              {warehouses.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-800">
                      Warehouse Stock Allocation
                    </label>
                    <span className="text-xs text-gray-500">Per-location inventory levels</span>
                  </div>
                  <div className="space-y-2">
                    {warehouses.map((wh) => {
                      const whLabel = `${wh.code} — ${wh.address.city}, ${wh.address.state}`;
                      return (
                        <div key={wh.id} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                          <span className="text-xs font-medium text-gray-800">{whLabel}</span>
                          <div className="flex items-center gap-1.5 w-28">
                            <input
                              type="number"
                              min="0"
                              value={whStockMap[wh.id] ?? '0'}
                              onWheel={(e) => e.currentTarget.blur()}
                              onFocus={(e) => {
                                if (e.target.value === "0") e.target.select();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                              }}
                              onChange={(e) => handleWhStockChange(wh.id, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-right text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <span className="text-xs text-gray-400">units</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-800">
                    Select Available Variants &amp; Stock Levels
                  </label>
                  <span className="text-xs text-gray-500">Specify inventory per pack size</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200/80">
                  {VARIANT_OPTIONS.map((v) => {
                    const isChecked = !!formData.variants[v.key];
                    return (
                      <div
                        key={v.key}
                        className={`flex flex-col p-3 rounded-lg border transition-all ${
                          isChecked
                            ? "bg-white border-green-400 shadow-2xs"
                            : "bg-white/60 border-gray-200 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <label className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleVariantChange(v.key)}
                              className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300 cursor-pointer"
                            />
                            <span className="text-sm font-bold text-gray-800">{v.label}</span>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                              Active
                            </span>
                          )}
                        </label>

                        {isChecked && (
                          <div className="mt-2.5 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                                Stock (units)
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={variantStocksMap[v.key] ?? '0'}
                                onWheel={(e) => e.currentTarget.blur()}
                                onFocus={(e) => {
                                  if (e.target.value === "0") e.target.select();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                                }}
                                onChange={(e) => handleVariantStockChange(v.key, e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-200 rounded font-bold text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                                Price (₹ opt.)
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Default"
                                value={variantPricesMap[v.key] ?? ''}
                                onWheel={(e) => e.currentTarget.blur()}
                                onKeyDown={(e) => {
                                  if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                                }}
                                onChange={(e) => handleVariantPriceChange(v.key, e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Mark as Best Seller{' '}
                    <span className="font-normal text-gray-400">
                      (shown in “Our Best Sellers” on the homepage)
                    </span>
                  </span>
                </label>
              </div>

              <div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isOrganic}
                    onChange={(e) => setFormData({ ...formData, isOrganic: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Organic Product{' '}
                    <span className="font-normal text-gray-400">
                      (shows “🌿 Organic” badge; uncheck for non-organic items)
                    </span>
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                <textarea
                  placeholder="Type here"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  About This Product
                </label>
                <textarea
                  placeholder="Type here"
                  value={formData.about}
                  onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How to Use
                </label>
                <textarea
                  placeholder="Type here"
                  value={formData.usageInstructions}
                  onChange={(e) => setFormData({ ...formData, usageInstructions: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why Choose This Product
                </label>
                <textarea
                  placeholder="Type here"
                  value={formData.whyChoose}
                  onChange={(e) => setFormData({ ...formData, whyChoose: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-6 py-3 bg-[#84b817] text-white rounded-lg font-medium hover:bg-[#6d9913] transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  );
}
