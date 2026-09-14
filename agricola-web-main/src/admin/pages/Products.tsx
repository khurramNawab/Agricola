import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ImageIcon, Star, Search } from "lucide-react";
import StatCard from "../components/StatsCard";
import AddProductModal from "../components/AddProductModel";
import AddCategoryModal from "../components/AddCategoryModel";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../../lib/api";
import {
  getProducts,
  getProduct,
  getCategories,
  getCategory,
  createProduct,
  createCategory,
  updateProduct,
  updateCategory,
  deleteProduct,
  deleteCategory,
  type AdminProduct,
  type AdminCategory,
  type AdminCategoryDetail,
  type ProductPayload,
  type CategoryPayload,
} from "../api/adminApi";

const statusColorBadge = (status: string) => {
  if (status === "In Stock") return "bg-[#c9ecc4] text-[#486800]";
  if (status === "Out of Stock") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
};

function ThumbCell({ src }: { src?: string }) {
  if (src) {
    return <img src={src} alt="" className="h-12 w-12 rounded-xl object-cover border border-gray-100 shadow-2xs" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f3f0] text-gray-400">
      <ImageIcon size={20} />
    </div>
  );
}

export default function Products() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"categories" | "products">("products");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryDetail | null>(null);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, totalCategories: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const handleError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setNotice(err instanceof Error ? err.message : fallback);
    },
    [logout]
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      return Promise.all([getProducts({ limit: 100 }, signal), getCategories(signal)])
        .then(([prodPage, cats]) => {
          setProducts(prodPage.products);
          setCategories(cats);
          setStats({
            totalProducts: prodPage.stats.totalProducts,
            totalCategories: prodPage.stats.totalCategories || cats.length,
          });
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (err instanceof ApiError && err.status === 401) return logout();
          setError(err instanceof Error ? err.message : "Failed to load catalog.");
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [logout]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openEditProduct = async (p: AdminProduct) => {
    setNotice("");
    try {
      setEditingProduct(await getProduct(p.id));
    } catch (err) {
      handleError(err, "Failed to load product.");
    }
  };

  const openEditCategory = async (c: AdminCategory) => {
    setNotice("");
    try {
      setEditingCategory(await getCategory(c.id));
    } catch (err) {
      handleError(err, "Failed to load category.");
    }
  };

  const handleSaveProduct = async (payload: ProductPayload) => {
    if (editingProduct) await updateProduct(editingProduct.id, payload);
    else await createProduct(payload);
    await load();
  };

  const handleSaveCategory = async (payload: CategoryPayload) => {
    if (editingCategory) await updateCategory(editingCategory.id, payload);
    else await createCategory(payload);
    await load();
  };

  const toggleBestSeller = async (p: AdminProduct) => {
    setNotice("");
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, featured: !x.featured } : x))
    );
    try {
      await updateProduct(p.id, { featured: !p.featured });
    } catch (err) {
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, featured: p.featured } : x))
      );
      handleError(err, "Failed to update best seller.");
    }
  };

  const handleDeleteProduct = async (p: AdminProduct) => {
    if (!window.confirm(`Delete product "${p.name}"?`)) return;
    setNotice("");
    try {
      await deleteProduct(p.id);
      await load();
    } catch (err) {
      handleError(err, "Failed to delete product.");
    }
  };

  const handleDeleteCategory = async (c: AdminCategory) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    setNotice("");
    try {
      await deleteCategory(c.id);
      await load();
    } catch (err) {
      handleError(err, "Failed to delete category.");
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!filterSearch.trim()) return true;
    const clean = filterSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(clean) ||
      (p.category && p.category.toLowerCase().includes(clean))
    );
  });

  const filteredCategories = categories.filter((c) => {
    if (!filterSearch.trim()) return true;
    return c.name.toLowerCase().includes(filterSearch.toLowerCase());
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          subtext="Active SKUs in catalog"
          valueColor="text-[#1e3a1f]"
        />
        <StatCard
          label="Total Categories"
          value={stats.totalCategories}
          subtext="Harvest departments"
        />
        <StatCard
          label="Featured Best Sellers"
          value={products.filter((p) => p.featured).length}
          subtext="Homepage spotlight"
          valueColor="text-amber-600"
        />
        <StatCard
          label="In Stock Rate"
          value={`${Math.round(
            (products.filter((p) => p.status === "In Stock").length / (products.length || 1)) * 100
          )}%`}
          subtext="Multi-hub available"
          valueColor="text-[#486800]"
        />
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm font-bold text-amber-800 shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="font-extrabold text-amber-700 hover:text-amber-900 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Catalog Card */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-[#1e3a1f]/10 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)] overflow-hidden">
        <div className="border-b border-gray-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-[#f5f3f0] p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab("products")}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === "products"
                  ? "bg-[#1e3a1f] text-white shadow-xs"
                  : "text-[#434936] hover:text-[#1e3a1f]"
              }`}
            >
              Harvest Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === "categories"
                  ? "bg-[#1e3a1f] text-white shadow-xs"
                  : "text-[#434936] hover:text-[#1e3a1f]"
              }`}
            >
              Categories ({categories.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-9 pr-3 py-2 bg-[#f5f3f0] rounded-xl text-xs font-bold text-[#1e3a1f] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817]/40 focus:bg-white transition-all"
              />
            </div>

            <button
              onClick={() => (activeTab === "products" ? setShowProductModal(true) : setShowCategoryModal(true))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#486800] hover:bg-[#1e3a1f] text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus size={16} />
              <span>{activeTab === "products" ? "Add Product" : "Add Category"}</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500 font-bold text-xs">Loading harvest catalog…</div>
          ) : error ? (
            <div className="px-6 py-12 text-center text-red-500 font-bold text-xs">{error}</div>
          ) : activeTab === "products" ? (
            <table className="w-full">
              <thead className="bg-[#f5f3f0]/80 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Item</th>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Category</th>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Price (₹)</th>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-center text-xs uppercase font-bold text-[#434936] tracking-wider">Organic</th>
                  <th className="px-6 py-3.5 text-center text-xs uppercase font-bold text-[#434936] tracking-wider">Best Seller</th>
                  <th className="px-6 py-3.5 text-right text-xs uppercase font-bold text-[#434936] tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-bold">
                      {filterSearch ? `No products match "${filterSearch}".` : "No products yet. Click \u201cAdd Product\u201d to create one."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[#f5f3f0]/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <ThumbCell src={product.images[0]?.url} />
                          <div>
                            <span className="font-extrabold text-[#1e3a1f] text-xs sm:text-sm block">
                              {product.name}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase font-mono">
                              ID: {product.id.slice(0, 8)}…
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f5f3f0] text-[#434936] font-bold text-[11px]">
                          {product.category || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-black text-[#1e3a1f] text-xs sm:text-sm">
                        ₹{product.sellingPrice.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${statusColorBadge(product.status)}`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {product.isOrganic ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c9ecc4] text-[#486800] font-bold text-[10px]">
                            🌿 Organic
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold text-[10px]">
                            Non-Organic
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <button
                          onClick={() => toggleBestSeller(product)}
                          title={product.featured ? "Best Seller — click to remove" : "Mark as Best Seller"}
                          aria-pressed={product.featured}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[#f5f3f0] cursor-pointer inline-flex items-center justify-center"
                        >
                          <Star
                            size={18}
                            className={
                              product.featured
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300 hover:text-amber-300"
                            }
                          />
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditProduct(product)}
                            title="Edit Product"
                            className="p-2 hover:bg-[#c9ecc4]/60 text-[#486800] rounded-xl transition-colors cursor-pointer"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            title="Delete Product"
                            className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-[#f5f3f0]/80 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Category</th>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Assigned Products</th>
                  <th className="px-6 py-3.5 text-left text-xs uppercase font-bold text-[#434936] tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-right text-xs uppercase font-bold text-[#434936] tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-bold">
                      {filterSearch ? `No categories match "${filterSearch}".` : "No categories yet. Click “Add Category” to create one."}
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-[#f5f3f0]/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <ThumbCell src={cat.image ?? undefined} />
                          <span className="font-extrabold text-[#1e3a1f] text-xs sm:text-sm">
                            {cat.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600 font-semibold">
                        {cat.productCount ?? 0} {cat.productCount === 1 ? "Product" : "Products"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            cat.status === "active"
                              ? "bg-[#c9ecc4] text-[#486800]"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {cat.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditCategory(cat)}
                            title="Edit Category"
                            className="p-2 hover:bg-[#c9ecc4]/60 text-[#486800] rounded-xl transition-colors cursor-pointer"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            title="Delete Category"
                            className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddProductModal
        isOpen={showProductModal || !!editingProduct}
        initial={editingProduct ?? undefined}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSaveProduct}
        categories={categories.map((c) => c.name)}
      />

      <AddCategoryModal
        isOpen={showCategoryModal || !!editingCategory}
        initial={editingCategory ?? undefined}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
        }}
        onSubmit={handleSaveCategory}
      />
    </div>
  );
}
