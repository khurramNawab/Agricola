import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import ImageDropzone from './ImageDropzone';
import { getProducts, type AdminCategoryDetail, type AdminProduct, type CategoryPayload } from '../api/adminApi';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (categoryData: CategoryPayload) => Promise<void>;
  /** When set, the modal edits this category (with its current products) instead of creating one. */
  initial?: AdminCategoryDetail;
}

type PickedProduct = { id: string; name: string };

export default function AddCategoryModal({ isOpen, onClose, onSubmit, initial }: AddCategoryModalProps) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [selected, setSelected] = useState<PickedProduct[]>([]);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AdminProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Load products to choose from when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getProducts({ limit: 100 })
      .then((res) => active && setOptions(res.products))
      .catch(() => active && setOptions([]));
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Prefill from `initial` when opening in edit mode; clear when adding.
  // The category detail (fetched by id) includes its current products, so the
  // picker is pre-populated rather than starting empty.
  useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name ?? '');
    setImage(initial?.image ?? null);
    setSelected(initial?.products?.map((p) => ({ id: p.id, name: p.name })) ?? []);
    setQuery('');
    setError('');
  }, [isOpen, initial]);

  const reset = () => {
    setName('');
    setImage(null);
    setSelected([]);
    setQuery('');
    setError('');
  };

  const matches =
    query.trim().length > 0
      ? options
          .filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) &&
              !selected.some((s) => s.id === p.id)
          )
          .slice(0, 6)
      : [];

  const addProduct = (p: AdminProduct) => {
    setSelected((prev) => [...prev, { id: p.id, name: p.name }]);
    setQuery('');
  };

  const removeProduct = (id: string) =>
    setSelected((prev) => prev.filter((p) => p.id !== id));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        image: image || undefined,
        products: selected.map((p) => p.id),
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{isEdit ? 'Edit Category' : 'Add Category'}</h2>
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

          <div className="space-y-6">
            <ImageDropzone
              variant="primary"
              folder="categories"
              value={image}
              onUploaded={(img) => setImage(img.url)}
              onRemove={() => setImage(null)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Category Name
              </label>
              <input
                type="text"
                placeholder="Category Name here"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Add Products
              </label>
              {isEdit && (
                <p className="-mt-1 mb-2 text-xs text-gray-400">
                  Products already in this category are shown. To move one out,
                  change its category from the product editor.
                </p>
              )}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Products"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
                {matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => addProduct(p)}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                    >
                      {p.name}
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-6 py-3 bg-[#84b817] text-white rounded-lg font-medium hover:bg-[#6d9913] transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Category'}
          </button>
        </form>
      </div>
    </div>
  );
}
