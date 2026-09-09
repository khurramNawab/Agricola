import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Building2, CheckCircle2, XCircle, X, AlertCircle, RefreshCw, AlertTriangle, Plus, Truck, Package } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../../lib/api';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  toggleWarehouseStatus,
  getShiprocketSyncPreview,
  applyShiprocketSync,
  type AdminWarehouse,
  type WarehousePayload,
  type ShiprocketSyncPreview,
  type SyncPreviewItem,
} from '../api/adminApi';

const emptyForm = (): WarehousePayload => ({
  code: '',
  name: '',
  shiprocketPickupNickname: '',
  ekartPickupAlias: '',
  ekartGstin: '',
  address: {
    street: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
  },
  spocName: '',
  spocPhone: '',
  isDefault: false,
  status: 'active',
});

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: WarehousePayload) => Promise<void>;
  initial?: AdminWarehouse | null;
}

function WarehouseModal({ isOpen, onClose, onSubmit, initial }: WarehouseModalProps) {
  const [formData, setFormData] = useState<WarehousePayload>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isCreating = !initial;

  useEffect(() => {
    if (!isOpen) return;
    if (initial) {
      setFormData({
        code: initial.code || '',
        name: initial.name || '',
        shiprocketPickupNickname: initial.shiprocketPickupNickname || '',
        ekartPickupAlias: initial.ekartPickupAlias || '',
        ekartGstin: initial.ekartGstin || '',
        address: {
          street: initial.address?.street || '',
          city: initial.address?.city || '',
          state: initial.address?.state || '',
          pincode: initial.address?.pincode || '',
          phone: initial.address?.phone || '',
        },
        spocName: initial.spocName || '',
        spocPhone: initial.spocPhone || '',
        isDefault: !!initial.isDefault,
        status: initial.status || 'active',
      });
    } else {
      setFormData(emptyForm());
    }
    setError('');
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Warehouse display name is required.');
      return;
    }
    if (!formData.address.street.trim() || !formData.address.city.trim() || !formData.address.state.trim()) {
      setError('Street address, city, and state are required.');
      return;
    }
    if (!formData.address.pincode.trim() || !/^[1-9][0-9]{5}$/.test(formData.address.pincode.trim())) {
      setError('A valid 6-digit Indian pincode is required.');
      return;
    }

    setBusy(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save warehouse.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {isCreating ? 'Add New Warehouse' : `Edit Warehouse (${formData.code})`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse Code {isCreating && <span className="text-xs text-gray-400 font-normal">(e.g. WH-ASSAM)</span>}
              </label>
              <input
                type="text"
                placeholder="e.g. WH-ASSAM"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                disabled={!isCreating}
                className={`w-full px-3 py-2 border border-gray-200 rounded-lg ${
                  !isCreating ? 'bg-gray-100 text-gray-500 font-semibold cursor-not-allowed' : 'focus:ring-2 focus:ring-green-500 focus:outline-none'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                placeholder="e.g. WH-Guwahati (Assam)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Truck size={15} className="text-indigo-600" />
                Shiprocket Pickup Nickname
              </label>
              <input
                type="text"
                placeholder="e.g. Home, Home-1"
                value={formData.shiprocketPickupNickname || ''}
                onChange={(e) => setFormData({ ...formData, shiprocketPickupNickname: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Matches nickname registered in Shiprocket dashboard.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Package size={15} className="text-amber-600" />
                Ekart Pickup Alias
              </label>
              <input
                type="text"
                placeholder="e.g. Flat 2c, PURNIA, Bihar"
                value={formData.ekartPickupAlias || ''}
                onChange={(e) => setFormData({ ...formData, ekartPickupAlias: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Matches registered address name/alias in Ekart Elite portal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 06ACLFA9681L1ZP"
                value={formData.ekartGstin || ''}
                onChange={(e) => setFormData({ ...formData, ekartGstin: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-800">Address Details *</h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Street Address *</label>
                <input
                  type="text"
                  placeholder="e.g. Sree nagar bye lane 1 house 8"
                  value={formData.address.street}
                  onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                  <input
                    type="text"
                    placeholder="e.g. Guwahati"
                    value={formData.address.city}
                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
                  <input
                    type="text"
                    placeholder="e.g. Assam"
                    value={formData.address.state}
                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pincode *</label>
                  <input
                    type="text"
                    placeholder="e.g. 781005"
                    value={formData.address.pincode}
                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, pincode: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Warehouse Phone</label>
                <input
                  type="text"
                  placeholder="e.g. 9896230791"
                  value={formData.address.phone || ''}
                  onChange={(e) => setFormData({ ...formData, address: { ...formData.address, phone: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">SPOC Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SPOC Name</label>
                <input
                  type="text"
                  placeholder="Contact Person Name"
                  value={formData.spocName || ''}
                  onChange={(e) => setFormData({ ...formData, spocName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SPOC Phone</label>
                <input
                  type="text"
                  placeholder="Contact Person Phone"
                  value={formData.spocPhone || ''}
                  onChange={(e) => setFormData({ ...formData, spocPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">Set as Primary / Default Warehouse</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Status:</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-[#84b817] text-white rounded-lg text-sm font-medium hover:bg-[#6d9913] disabled:opacity-50"
            >
              {busy ? 'Saving…' : isCreating ? 'Add Warehouse' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SyncPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: ShiprocketSyncPreview | null;
  onConfirm: (items: SyncPreviewItem[]) => Promise<void>;
}

function SyncPreviewModal({ isOpen, onClose, preview, onConfirm }: SyncPreviewModalProps) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !preview) return null;

  const validItems = preview.items.filter((item) => !item.hasConflict && item.changeType !== 'unchanged');
  const hasChanges = validItems.length > 0;

  const handleApply = async () => {
    setError('');
    setApplying(true);
    try {
      await onConfirm(validItems);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply sync changes.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Shiprocket Pickup Locations Sync</h2>
              <p className="text-xs text-gray-500 mt-1">
                Preview changes before applying to local database.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <span className="text-xs font-medium text-emerald-600 block">New Hubs</span>
              <span className="text-xl font-bold text-emerald-700">{preview.newCount}</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <span className="text-xs font-medium text-blue-600 block">Updates</span>
              <span className="text-xl font-bold text-blue-700">{preview.updateCount}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
              <span className="text-xs font-medium text-gray-600 block">Unchanged</span>
              <span className="text-xl font-bold text-gray-700">{preview.unchangedCount}</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <span className="text-xs font-medium text-amber-600 block">Conflicts</span>
              <span className="text-xl font-bold text-amber-700">{preview.conflictCount}</span>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {preview.items.length === 0 ? (
              <p className="text-center py-6 text-gray-400 text-sm">No locations found in Shiprocket account.</p>
            ) : (
              preview.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.hasConflict
                      ? 'bg-amber-50/60 border-amber-200'
                      : item.changeType === 'new'
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : item.changeType === 'update'
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{item.label}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.hasConflict
                            ? 'bg-amber-200 text-amber-900'
                            : item.changeType === 'new'
                            ? 'bg-emerald-200 text-emerald-800'
                            : item.changeType === 'update'
                            ? 'bg-blue-200 text-blue-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {item.hasConflict ? 'Conflict' : item.changeType.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      {item.address.street}, {item.address.city}, {item.address.state} - {item.address.pincode}
                    </p>

                    {item.hasConflict && (
                      <p className="text-xs text-amber-700 font-medium mt-1.5 flex items-center gap-1">
                        <AlertTriangle size={13} className="shrink-0" />
                        {item.conflictMessage}
                      </p>
                    )}
                  </div>

                  <div className="text-xs font-medium text-gray-500 text-right sm:text-left shrink-0">
                    Nickname: <span className="text-gray-800 font-semibold">{item.shiprocketNickname}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-6 flex items-center justify-between border-t border-gray-100 mt-6">
          <p className="text-xs text-gray-400">
            {hasChanges ? `${validItems.length} changes ready to sync.` : 'All locations up-to-date.'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || !hasChanges}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              {applying ? 'Applying Changes…' : 'Apply Sync'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Warehouses() {
  const { logout } = useAuth();
  const [warehouses, setWarehouses] = useState<AdminWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editingWarehouse, setEditingWarehouse] = useState<AdminWarehouse | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncPreview, setSyncPreview] = useState<ShiprocketSyncPreview | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const loadWarehouses = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const data = await getWarehouses(signal);
      setWarehouses(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof ApiError && err.status === 401) return logout();
      setError(err instanceof Error ? err.message : 'Failed to load warehouses.');
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const controller = new AbortController();
    loadWarehouses(controller.signal);
    return () => controller.abort();
  }, [loadWarehouses]);

  const handleSaveWarehouse = async (payload: WarehousePayload) => {
    if (editingWarehouse) {
      await updateWarehouse(editingWarehouse.id, payload);
      setNotice(`Warehouse updated successfully.`);
    } else {
      await createWarehouse(payload);
      setNotice(`Warehouse created successfully.`);
    }
    await loadWarehouses();
  };

  const handleToggleStatus = async (wh: AdminWarehouse) => {
    const nextStatus = wh.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleWarehouseStatus(wh.id, nextStatus);
      setNotice(`Status updated to ${nextStatus}.`);
      await loadWarehouses();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleFetchSyncPreview = async () => {
    setError('');
    setSyncing(true);
    try {
      const preview = await getShiprocketSyncPreview();
      setSyncPreview(preview);
      setShowSyncModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pickup locations from Shiprocket.');
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmSync = async (items: SyncPreviewItem[]) => {
    const updated = await applyShiprocketSync(items);
    setWarehouses(updated);
    setNotice(`Shiprocket pickup locations synced successfully.`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouse Fulfillment Hubs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage multi-warehouse inventory hubs and dispatch centers verified with Shiprocket & Ekart.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              setEditingWarehouse(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-[#84b817] hover:bg-[#6d9913] text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Warehouse
          </button>

          <button
            onClick={handleFetchSyncPreview}
            disabled={syncing}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Fetching Shiprocket Locations…' : 'Sync from Shiprocket'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700 flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-emerald-500 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading warehouses…</div>
      ) : warehouses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <Building2 size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No Warehouses Found</h3>
          <p className="text-sm text-gray-500 mt-1">No verified warehouses registered in system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {warehouses.map((wh) => {
            const label = `${wh.code} — ${wh.address.city}, ${wh.address.state}`;
            const isActive = wh.status === 'active';

            return (
              <div
                key={wh.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-gray-900">{label}</span>
                        {wh.isDefault && (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{wh.name}</p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Carrier Integration Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 p-2.5 bg-gray-50 rounded-xl text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Truck size={14} className="text-indigo-600 shrink-0" />
                      <span className="truncate">
                        <strong>Shiprocket:</strong> {wh.shiprocketPickupNickname || <span className="text-gray-400 italic">Not linked</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Package size={14} className="text-amber-600 shrink-0" />
                      <span className="truncate" title={wh.ekartPickupAlias || 'Dynamic'}>
                        <strong>Ekart:</strong> {wh.ekartPickupAlias ? <span className="text-emerald-700 font-medium">{wh.ekartPickupAlias}</span> : <span className="text-gray-400 italic">Dynamic Address</span>}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-gray-50 py-3 my-3 text-sm">
                    <div className="text-gray-700">
                      <span className="text-xs font-medium text-gray-400 block mb-0.5">Address</span>
                      {[wh.address.street, wh.address.city, wh.address.state, wh.address.pincode]
                        .filter(Boolean)
                        .join(', ')}
                      {wh.address.phone && (
                        <span className="block text-gray-500 text-xs mt-0.5">
                          Phone: {wh.address.phone}
                        </span>
                      )}
                    </div>

                    {(wh.spocName || wh.spocPhone) && (
                      <div className="text-gray-700 pt-1">
                        <span className="text-xs font-medium text-gray-400 block mb-0.5">SPOC Contact</span>
                        {wh.spocName || '—'} {wh.spocPhone ? `(${wh.spocPhone})` : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleToggleStatus(wh)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      isActive
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    onClick={() => {
                      setEditingWarehouse(wh);
                      setShowModal(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WarehouseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingWarehouse(null);
        }}
        onSubmit={handleSaveWarehouse}
        initial={editingWarehouse}
      />

      <SyncPreviewModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        preview={syncPreview}
        onConfirm={handleConfirmSync}
      />
    </div>
  );
}
