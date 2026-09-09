import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, ImageIcon, Star } from 'lucide-react';
import StatCard from '../components/StatsCard';
import AddProductModal from '../components/AddProductModel';
import AddCategoryModal from '../components/AddCategoryModel';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../../lib/api';
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
} from '../api/adminApi';

const statusColor = (status: string) => {
  if (status === 'In Stock') return 'text-green-600';
  if (status === 'Out of Stock') return 'text-red-500';
  return 'text-yellow-600';
};

function ThumbCell({ src }: { src?: string }) {
  if (src) {
    return <img src={src} alt="" className="h-12 w-12 rounded object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-gray-300">
      <ImageIcon size={20} />
    </div>
  );
}

export default function Products() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'categories' | 'products'>('products');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminCategoryDetail | null>(null);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, totalCategories: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      setError('');
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
          setError(err instanceof Error ? err.message : 'Failed to load catalog.');
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

  // Edit opens after fetching the full record by id (fresh images/keys + the
  // category's current product list).
  const openEditProduct = async (p: AdminProduct) => {
    setNotice('');
    try {
      setEditingProduct(await getProduct(p.id));
    } catch (err) {
      handleError(err, 'Failed to load product.');
    }
  };

  const openEditCategory = async (c: AdminCategory) => {
    setNotice('');
    try {
      setEditingCategory(await getCategory(c.id));
    } catch (err) {
      handleError(err, 'Failed to load category.');
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

  // Toggle a product's best-seller (featured) flag, which drives the storefront
  // "Our Best Sellers" section. Optimistic update; revert the row on failure.
  const toggleBestSeller = async (p: AdminProduct) => {
    setNotice('');
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, featured: !x.featured } : x))
    );
    try {
      await updateProduct(p.id, { featured: !p.featured });
    } catch (err) {
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, featured: p.featured } : x))
      );
      handleError(err, 'Failed to update best seller.');
    }
  };

  const handleDeleteProduct = async (p: AdminProduct) => {
    if (!window.confirm(`Delete product "${p.name}"?`)) return;
    setNotice('');
    try {
      await deleteProduct(p.id);
      await load();
    } catch (err) {
      handleError(err, 'Failed to delete product.');
    }
  };

  const handleDeleteCategory = async (c: AdminCategory) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    setNotice('');
    try {
      await deleteCategory(c.id);
      await load();
    } catch (err) {
      handleError(err, 'Failed to delete category.');
    }
  };

  return (
    <div className="p-8">
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Categories" value={stats.totalCategories} />
        <StatCard label="Total Products" value={stats.totalProducts} />
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-medium text-amber-700 hover:text-amber-900">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'categories'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Categories
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'products'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Products
              </button>
            </div>

            <button
              onClick={() => (activeTab === 'products' ? setShowProductModal(true) : setShowCategoryModal(true))}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              <span>{activeTab === 'products' ? 'Add Product' : 'Add Category'}</span>
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500">Loading…</div>
          ) : error ? (
            <div className="px-6 py-12 text-center text-red-500">{error}</div>
          ) : activeTab === 'products' ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Image</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Product Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Price</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Best Seller</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No products yet. Click “Add Product” to create one.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <ThumbCell src={product.images[0]?.url} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">₹{product.sellingPrice}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.category || '—'}</td>
                      <td className={`px-6 py-4 text-sm ${statusColor(product.status)}`}>
                        {product.status}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleBestSeller(product)}
                          title={product.featured ? 'Best Seller — click to remove' : 'Mark as Best Seller'}
                          aria-pressed={product.featured}
                          className="rounded p-1.5 transition-colors hover:bg-gray-100"
                        >
                          <Star
                            size={18}
                            className={
                              product.featured
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditProduct(product)}
                            title="Edit"
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Pencil size={16} className="text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            title="Delete"
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Trash2 size={16} className="text-red-500" />
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
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Image</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Category Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Products</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No categories yet. Click “Add Category” to create one.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <ThumbCell src={cat.image ?? undefined} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{cat.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{cat.productCount ?? 0}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            cat.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {cat.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditCategory(cat)}
                            title="Edit"
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Pencil size={16} className="text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            title="Delete"
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Trash2 size={16} className="text-red-500" />
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
