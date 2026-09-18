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
import { sanitizeZeroSafeNumber, zeroSafeInputProps } from '../../lib/zeroSafe';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: ProductPayload) => Promise<void>;
  categories: string[];
  /** When set, the modal edits this product instead of creating a new one. */
  initial?: AdminProduct;
}

const IMAGE_SLOTS = 6; // cover + 5 extra

export interface VariantRow {
  id: string;
  size: string;
  stock: string;
  price: string;
}

const VARIANT_PRESETS = ['100g', '150g', '200g', '250g', '300g', '500g', '1kg'];

const emptyForm = () => ({
  name: '',
  category: '',
  originalPrice: '',
  sellingPrice: '',
  stock: '',
  featured: false,
  isOrganic: true,
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
  const [variantsList, setVariantsList] = useState<VariantRow[]>([]);
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
      let initialVariants: VariantRow[] = [];
      if (initial.variantStocks && initial.variantStocks.length > 0) {
        initialVariants = initial.variantStocks.slice(0, 5).map((vs, idx) => ({
          id: `var-${idx}-${Date.now()}`,
          size: vs.size,
          stock: String(vs.stock ?? 0),
          price: vs.price !== undefined && vs.price !== null ? String(vs.price) : '',
        }));
      } else if (initial.sizes && initial.sizes.length > 0) {
        initialVariants = initial.sizes.slice(0, 5).map((s, idx) => ({
          id: `var-${idx}-${Date.now()}`,
          size: s,
          stock: String(initial.stock || 0),
          price: '',
        }));
      }
      setVariantsList(initialVariants);

      setFormData({
        name: initial.name,
        category: initial.category ?? '',
        originalPrice: initial.originalPrice != null ? String(initial.originalPrice) : '',
        sellingPrice: String(initial.sellingPrice),
        stock: String(initial.stock),
        featured: !!initial.featured,
        isOrganic: initial.isOrganic !== false,
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
      setVariantsList([]);
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
    setVariantsList([]);
    setError('');
  };

  const setImageAt = (i: number, img: ProductImage | null) =>
    setImages((prev) => prev.map((cur, idx) => (idx === i ? img : cur)));

  const handleCleanNumberInput = (field: "originalPrice" | "sellingPrice" | "stock", val: string) => {
    const cleaned = sanitizeZeroSafeNumber(val, true);
    setFormData((prev) => ({ ...prev, [field]: cleaned }));
  };

  const handleWhStockChange = (whId: string, val: string) => {
    const cleaned = sanitizeZeroSafeNumber(val, true);
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
      const validVariants = variantsList
        .map((v) => ({
          size: v.size.trim(),
          stock: Math.max(0, parseInt(v.stock || '0', 10) || 0),
          price: v.price ? Number(v.price) : undefined,
        }))
        .filter((v) => v.size.length > 0);

      await onSubmit({
        name: formData.name.trim(),
        category: formData.category,
        originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
        sellingPrice: Number(formData.sellingPrice),
        stock: formData.stock ? Number(formData.stock) : undefined,
        featured: formData.featured,
        isOrganic: formData.isOrganic,
        variants: Object.fromEntries(validVariants.map((v) => [v.size, true])),
        variantStocks: validVariants,
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

  const handleAddVariant = (preset?: string) => {
    if (variantsList.length >= 5) return;
    const size = preset || '';
    if (size && variantsList.some((v) => v.size.toLowerCase() === size.toLowerCase())) return;
    setVariantsList((prev) => [
      ...prev,
      { id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, size, stock: '0', price: '' },
    ]);
  };

  const handleRemoveVariant = (id: string) => {
    setVariantsList((prev) => {
      const next = prev.filter((v) => v.id !== id);
      const total = next.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
      if (next.length > 0) {
        setFormData((f) => ({ ...f, stock: String(total) }));
      }
      return next;
    });
  };

  const handleUpdateVariant = (id: string, field: 'size' | 'stock' | 'price', val: string) => {
    let cleaned = val;
    if (field === 'stock' || field === 'price') {
      cleaned = sanitizeZeroSafeNumber(val, true);
    }
    setVariantsList((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, [field]: cleaned } : v));
      if (field === 'stock') {
        const total = next.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
        setFormData((f) => ({ ...f, stock: String(total) }));
      }
      return next;
    });
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
                    type="text"
                    {...zeroSafeInputProps}
                    placeholder="0"
                    value={formData.originalPrice}
                    onChange={(e) => handleCleanNumberInput("originalPrice", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selling Price
                  </label>
                  <input
                    type="text"
                    {...zeroSafeInputProps}
                    placeholder="0"
                    value={formData.sellingPrice}
                    onChange={(e) => handleCleanNumberInput("sellingPrice", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Storefront Stock
                  </label>
                  <input
                    type="text"
                    {...zeroSafeInputProps}
                    placeholder="0"
                    value={formData.stock}
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
                              type="text"
                              {...zeroSafeInputProps}
                              value={whStockMap[wh.id] ?? ''}
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

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <label className="block text-sm font-bold text-gray-800">
                      Pack &amp; Weight Variants (Up to 5)
                    </label>
                    <p className="text-xs text-gray-500">
                      Add custom weights (e.g. 150g, 200g, 250g, 300g) with individual stock &amp; price.
                    </p>
                  </div>
                  {variantsList.length < 5 && (
                    <button
                      type="button"
                      onClick={() => handleAddVariant()}
                      className="self-start sm:self-auto px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">add</span>
                      <span>Add Variant ({variantsList.length}/5)</span>
                    </button>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200/80">
                  <span className="text-[11px] font-bold text-gray-500 mr-1">Quick Add:</span>
                  {VARIANT_PRESETS.map((preset) => {
                    const isAdded = variantsList.some((v) => v.size.toLowerCase() === preset.toLowerCase());
                    const isMax = variantsList.length >= 5;
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={isAdded || isMax}
                        onClick={() => handleAddVariant(preset)}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
                          isAdded
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed line-through"
                            : isMax
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-green-600 hover:text-green-700 cursor-pointer shadow-2xs"
                        }`}
                        title={isAdded ? "Already added" : isMax ? "Max 5 variants reached" : `Add ${preset}`}
                      >
                        +{preset}
                      </button>
                    );
                  })}
                </div>

                {/* Variant Rows */}
                {variantsList.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <span className="material-symbols-outlined text-gray-400 text-3xl mb-1">scale</span>
                    <p className="text-xs font-semibold text-gray-600">No variants added yet</p>
                    <p className="text-[11px] text-gray-400 mb-3">Product will be sold as a single default size.</p>
                    <button
                      type="button"
                      onClick={() => handleAddVariant()}
                      className="px-3.5 py-1.5 bg-white border border-gray-300 hover:border-green-600 hover:text-green-700 text-xs font-bold rounded-lg shadow-2xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">add</span>
                      <span>Add First Variant</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {variantsList.map((v, index) => (
                      <div
                        key={v.id}
                        className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center gap-2.5 transition-all hover:border-gray-300"
                      >
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Variant #{index + 1} Pack / Weight
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 150g, 200g, 300g"
                            value={v.size}
                            onChange={(e) => handleUpdateVariant(v.id, "size", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>

                        <div className="w-full sm:w-28">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Stock (units)
                          </label>
                          <input
                            type="text"
                            {...zeroSafeInputProps}
                            placeholder="0"
                            value={v.stock}
                            onChange={(e) => handleUpdateVariant(v.id, "stock", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-right font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>

                        <div className="w-full sm:w-32">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Price (₹ opt.)
                          </label>
                          <input
                            type="text"
                            {...zeroSafeInputProps}
                            placeholder="Default"
                            value={v.price}
                            onChange={(e) => handleUpdateVariant(v.id, "price", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-right text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>

                        <div className="sm:pt-5 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(v.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove variant"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
