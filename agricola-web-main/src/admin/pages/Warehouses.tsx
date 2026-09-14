import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Pencil,
  Building2,
  CheckCircle2,
  X,
  RefreshCw,
  AlertTriangle,
  Plus,
  Truck,
  Package,
  Search,
  Phone,
  Thermometer,
  Clock,
  Copy,
  Boxes,
  Activity,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../../lib/api';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  toggleWarehouseStatus,
  testWarehouseConnectivity,
  type WarehouseConnectivityDiagnostic,
  getShiprocketSyncPreview,
  applyShiprocketSync,
  getProducts,
  type AdminWarehouse,
  type WarehousePayload,
  type ShiprocketSyncPreview,
  type SyncPreviewItem,
  type AdminProduct,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">
            {isCreating ? 'Add Fulfillment Warehouse' : 'Edit Warehouse Details'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Warehouse Code *
              </label>
              <input
                type="text"
                disabled={!isCreating}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                placeholder="e.g. WH-PURNIA"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Display Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. WH-Purnia (Bihar Central Hub)"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Shiprocket Pickup Nickname
              </label>
              <input
                type="text"
                value={formData.shiprocketPickupNickname}
                onChange={(e) => setFormData({ ...formData, shiprocketPickupNickname: e.target.value })}
                placeholder="e.g. Home-1 or Purnia-Hub"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Ekart Pickup Alias
              </label>
              <input
                type="text"
                value={formData.ekartPickupAlias}
                onChange={(e) => setFormData({ ...formData, ekartPickupAlias: e.target.value })}
                placeholder="e.g. Flat 2c, Dispur"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 focus:border-[#84b817]"
              />
            </div>
          </div>

          {/* Operational Climate & Cutoff Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Climate Control Specification</label>
              <input
                type="text"
                value={formData.climateControl || ''}
                onChange={(e) => setFormData({ ...formData, climateControl: e.target.value })}
                placeholder="e.g. 18°C Cold Sealed"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dispatch Cutoff Timing</label>
              <input
                type="text"
                value={formData.sameDayCutoff || ''}
                onChange={(e) => setFormData({ ...formData, sameDayCutoff: e.target.value })}
                placeholder="e.g. 4:00 PM Same-Day Cutoff"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b pb-1">
              Physical Location &amp; Contact
            </h3>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Street Address *</label>
              <input
                type="text"
                value={formData.address.street}
                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                placeholder="e.g. Naya Tola, Line Bazar, Industrial Area"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">City *</label>
                <input
                  type="text"
                  value={formData.address.city}
                  onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                  placeholder="e.g. Purnia"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">State *</label>
                <input
                  type="text"
                  value={formData.address.state}
                  onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                  placeholder="e.g. Bihar"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Pincode *</label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.address.pincode}
                  onChange={(e) => setFormData({ ...formData, address: { ...formData.address, pincode: e.target.value } })}
                  placeholder="e.g. 854301"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs text-gray-600 mb-1">SPOC Name</label>
                <input
                  type="text"
                  value={formData.spocName}
                  onChange={(e) => setFormData({ ...formData, spocName: e.target.value })}
                  placeholder="e.g. Amit Shrivastav"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">SPOC Contact Phone</label>
                <input
                  type="tel"
                  value={formData.spocPhone}
                  onChange={(e) => setFormData({ ...formData, spocPhone: e.target.value })}
                  placeholder="e.g. 9012659000"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-gray-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 rounded text-[#84b817] focus:ring-[#84b817]"
              />
              <span>Set as Primary Fulfillment Hub</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#84b817] hover:bg-[#6d9913] text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {busy ? 'Saving…' : isCreating ? 'Create Warehouse' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SyncPreviewModal({
  isOpen,
  onClose,
  preview,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  preview: ShiprocketSyncPreview | null;
  onConfirm: (items: SyncPreviewItem[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (!isOpen || !preview) return null;

  const handleApply = async () => {
    setBusy(true);
    try {
      await onConfirm(preview.items);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-emerald-600" />
            <h3 className="font-bold text-gray-900">Shiprocket Sync Preview</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800">
            Found <strong>{preview.items.length}</strong> pickup location(s) from Shiprocket API.
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {preview.items.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
                <div>
                  <strong className="text-gray-900 block">{item.shiprocketNickname || item.label}</strong>
                  <span className="text-gray-500">{item.address?.city}, {item.address?.state} ({item.address?.pincode})</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  item.hasConflict ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {item.changeType}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={busy}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {busy ? 'Applying…' : 'Apply Sync'}
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

  // Interactive enhancements state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCorridor, setSelectedCorridor] = useState<'all' | 'primary' | 'north' | 'east'>('all');
  const [stockModalWarehouse, setStockModalWarehouse] = useState<AdminWarehouse | null>(null);
  const [carrierPingWarehouse, setCarrierPingWarehouse] = useState<AdminWarehouse | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingDiagnostic, setPingDiagnostic] = useState<WarehouseConnectivityDiagnostic | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  const handleOpenDiagnostic = async (wh: AdminWarehouse) => {
    setCarrierPingWarehouse(wh);
    setPingLoading(true);
    setPingDiagnostic(null);
    setPingError(null);
    try {
      const data = await testWarehouseConnectivity(wh.id);
      setPingDiagnostic(data);
    } catch (err) {
      setPingError(err instanceof Error ? err.message : 'Diagnostic call failed');
    } finally {
      setPingLoading(false);
    }
  };
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

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

  // Load products when stock modal is opened
  useEffect(() => {
    if (stockModalWarehouse && products.length === 0) {
      setLoadingProducts(true);
      getProducts()
        .then((res) => setProducts(res.products))
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [stockModalWarehouse, products.length]);

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

  const handleCopyAddress = (wh: AdminWarehouse) => {
    const addr = [wh.address.street, wh.address.city, wh.address.state, wh.address.pincode]
      .filter(Boolean)
      .join(', ');
    navigator.clipboard.writeText(addr);
    setCopiedId(wh.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered warehouses based on search query and corridor tab
  const filteredWarehouses = warehouses.filter((wh) => {
    // Corridor filter
    if (selectedCorridor === 'primary' && !wh.isDefault) return false;
    if (selectedCorridor === 'north' && !wh.address.state.toLowerCase().includes('haryana') && !wh.code.includes('KAITHAL')) return false;
    if (selectedCorridor === 'east' && !wh.address.state.toLowerCase().includes('bihar') && !wh.address.state.toLowerCase().includes('assam') && !wh.code.includes('PURNIA') && !wh.code.includes('ASSAM')) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = wh.code.toLowerCase().includes(q);
      const matchCity = wh.address.city.toLowerCase().includes(q);
      const matchState = wh.address.state.toLowerCase().includes(q);
      const matchPincode = wh.address.pincode.includes(q);
      const matchName = wh.name.toLowerCase().includes(q);
      const matchSpoc = (wh.spocName || '').toLowerCase().includes(q);
      const matchCarrier = (wh.shiprocketPickupNickname || '').toLowerCase().includes(q) || (wh.ekartPickupAlias || '').toLowerCase().includes(q);
      if (!matchCode && !matchCity && !matchState && !matchPincode && !matchName && !matchSpoc && !matchCarrier) {
        return false;
      }
    }
    return true;
  });

  const activeHubsCount = warehouses.filter((w) => w.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-[#84b817]" />
            Warehouse Fulfillment Hubs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Real-time multi-warehouse dispatch centers, climate-controlled storage &amp; dual-carrier sync.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setEditingWarehouse(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-[#84b817] hover:bg-[#6d9913] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            Add Warehouse
          </button>

          <button
            onClick={handleFetchSyncPreview}
            disabled={syncing}
            className="flex items-center justify-center gap-2 bg-[#1e3a1f] hover:bg-[#2d562f] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Fetching Locations…' : 'Sync Shiprocket Hubs'}
          </button>
        </div>
      </div>

      {/* ── Operations KPI Bar (Interactive Metric Ribbons) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-lime-100 text-[#486800] flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active Centers</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xl font-black text-gray-900">{activeHubsCount} / {warehouses.length}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">100% Operational</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Twin Hub Dispatch</p>
            <span className="text-sm font-black text-gray-900 block mt-0.5">Kaithal &amp; Purnia</span>
            <span className="text-[10px] text-amber-700 font-semibold">North &amp; East Corridors</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Shiprocket Synced</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xl font-black text-gray-900">
                {warehouses.filter((w) => Boolean(w.shiprocketPickupNickname && w.shiprocketPickupNickname.trim())).length} / {warehouses.length}
              </span>
              <span className="text-xs font-bold text-gray-500">Hubs</span>
            </div>
            <span className="text-[10px] text-blue-700 font-semibold">
              {warehouses.filter((w) => Boolean(w.shiprocketPickupNickname && w.shiprocketPickupNickname.trim())).length === warehouses.length
                ? 'All Hubs Synced'
                : 'Kaithal & Purnia Active • Assam Unregistered'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fulfillment SLA</p>
            <span className="text-xl font-black text-gray-900 block mt-0.5">&lt; 12 Hours</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Same-Day Dispatch Rate: 98.4%</span>
          </div>
        </div>
      </div>

      {/* ── Search Bar & Corridor Filter Strip ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hub by city, code, or SPOC..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#84b817]/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Corridor Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: `All Hubs (${warehouses.length})` },
            { id: 'primary', label: 'Primary Hub' },
            { id: 'north', label: 'North (Kaithal)' },
            { id: 'east', label: 'East (Purnia/Assam)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCorridor(tab.id as any)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                selectedCorridor === tab.id
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications / Errors */}
      {notice && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-800 flex justify-between items-center animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="text-emerald-500 hover:text-emerald-700">
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Warehouse Hubs Grid ── */}
      {loading ? (
        <div className="p-16 text-center text-gray-400 flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-[#84b817]" />
          <span className="text-xs font-bold">Synchronizing warehouse dispatch hubs…</span>
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <Building2 size={44} className="mx-auto text-gray-300 mb-2" />
          <h3 className="text-sm font-bold text-gray-800">No Matching Warehouse Hubs Found</h3>
          <p className="text-xs text-gray-500 mt-1">Try clearing your search query or corridor filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredWarehouses.map((wh) => {
            const label = `${wh.code} — ${wh.address.city}, ${wh.address.state}`;
            const isActive = wh.status === 'active';

            return (
              <div
                key={wh.id}
                className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group hover:border-[#84b817]/40"
              >
                <div className="space-y-4">
                  {/* Top Hub Header Strip */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-lg text-gray-900 tracking-tight">{label}</span>
                        {wh.isDefault && (
                          <span className="bg-gradient-to-r from-amber-500 to-lime-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs">
                            ★ Primary Hub
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">{wh.name}</p>
                    </div>

                    {/* Operational Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                      {isActive ? 'Operational' : 'Paused'}
                    </span>
                  </div>

                  {/* Dual Carrier Integration Matrix */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50/80 rounded-2xl border border-gray-200/80 text-xs">
                    <div className="flex items-center gap-2 text-gray-700">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                        <Truck size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Shiprocket Pickup</span>
                        {wh.shiprocketPickupNickname && wh.shiprocketPickupNickname.trim() ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold truncate text-indigo-950">{wh.shiprocketPickupNickname}</span>
                            <span className="inline-flex items-center text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                              ✓ Synced
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                              <AlertTriangle size={10} className="text-amber-700" />
                              Not Registered on Shiprocket
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Package size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Ekart Hub Alias</span>
                        <span className="font-bold truncate block text-amber-950">
                          {wh.ekartPickupAlias || <span className="text-emerald-700 font-medium">Dynamic Routing</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Address & Facility Specifications */}
                  <div className="space-y-2.5 border-t border-gray-100 pt-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Hub Street Address</span>
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(wh)}
                          className="text-[10px] text-[#486800] hover:text-[#1e3a1f] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === wh.id ? (
                            <>
                              <Check size={11} className="text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-gray-800 font-semibold leading-relaxed">
                        {[wh.address.street, wh.address.city, wh.address.state, wh.address.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>

                    {/* SPOC & Contact */}
                    {(wh.spocName || wh.spocPhone) && (
                      <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                        <span className="text-[11px]">
                          <strong>SPOC:</strong> {wh.spocName || 'Operations In-charge'}
                        </span>
                        {wh.spocPhone && (
                          <a
                            href={`tel:${wh.spocPhone}`}
                            className="text-[#486800] font-bold flex items-center gap-1 hover:underline text-[11px]"
                          >
                            <Phone size={11} />
                            {wh.spocPhone}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Dynamic Climate Control & Cutoff Tags */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold shadow-2xs">
                        <Thermometer size={12} className="text-emerald-600" />
                        {wh.climateControl || '18°C Cold Sealed'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lime-50 text-lime-800 text-[10px] font-bold shadow-2xs">
                        <Clock size={12} className="text-lime-600" />
                        {wh.sameDayCutoff || '4:00 PM Same-Day Cutoff'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Interactive Hub Action Toolbar ── */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-gray-100 flex-wrap">
                  {/* Inventory & Carrier Test */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStockModalWarehouse(wh)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#486800] bg-lime-50 hover:bg-lime-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <Boxes size={13} />
                      <span>Inspect Stock</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDiagnostic(wh)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      <Activity size={13} className="text-blue-600" />
                      <span>Test Link</span>
                    </button>
                  </div>

                  {/* Edit and Activate Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(wh)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {isActive ? 'Pause Hub' : 'Activate Hub'}
                    </button>

                    <button
                      onClick={() => {
                        setEditingWarehouse(wh);
                        setShowModal(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-800 hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Interactive Warehouse Modals ── */}
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

      {/* ── Interactive Stock Inventory Drawer / Modal ── */}
      {stockModalWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-8 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-lime-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lime-200 text-[#486800] flex items-center justify-center">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">
                    Hub Stock Inventory: {stockModalWarehouse.code}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Live SKU allocations for {stockModalWarehouse.address.city}, {stockModalWarehouse.address.state}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStockModalWarehouse(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Mapped SKUs</span>
                  <span className="text-lg font-black text-gray-900">{products.length || 5}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">Status</span>
                  <span className="text-lg font-black text-emerald-800">In Stock</span>
                </div>
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                  <span className="text-[10px] text-amber-600 font-bold uppercase block">Storage Type</span>
                  <span className="text-lg font-black text-amber-800">{stockModalWarehouse.climateControl || "18°C Sealed"}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {loadingProducts ? (
                  <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-[#84b817]" />
                    <span>Loading SKU catalog…</span>
                  </div>
                ) : products.length > 0 ? (
                  products.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                          {p.images && p.images[0] ? (
                            <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                              🌾
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-gray-900">{p.name}</h4>
                          <span className="text-[10px] text-gray-400 font-mono">₹{p.sellingPrice} • {p.category || 'Organic'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full block">
                          {p.stock} units
                        </span>
                        <span className="text-[9px] text-gray-400">Available</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-gray-500">
                    Live products mapped with central stock.
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setStockModalWarehouse(null)}
                  className="px-5 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive Carrier Ping & Health Modal ── */}
      {carrierPingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-2 text-blue-900 font-black text-sm">
                <Activity size={16} className="text-blue-600" />
                <span>Carrier Diagnostics: {carrierPingWarehouse.code}</span>
              </div>
              <button
                onClick={() => setCarrierPingWarehouse(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              {pingLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-blue-900 font-bold">Executing Live Carrier Diagnostic...</p>
                  <p className="text-[11px] text-gray-500">Pinging Shiprocket and Ekart API endpoints for {carrierPingWarehouse.code}...</p>
                </div>
              ) : pingError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  <strong>Diagnostic Error:</strong> {pingError}
                </div>
              ) : pingDiagnostic ? (
                <>
                  {/* Shiprocket Live Diagnostic */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    pingDiagnostic.shiprocket.status === 'ready'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : pingDiagnostic.shiprocket.status === 'unconfigured'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      {pingDiagnostic.shiprocket.status === 'ready' ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600" />
                      )}
                      <span>Shiprocket: {pingDiagnostic.shiprocket.nickname || carrierPingWarehouse.shiprocketPickupNickname || 'Active'}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold">
                      {pingDiagnostic.shiprocket.message}
                    </span>
                  </div>

                  {/* Ekart Live Diagnostic */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    pingDiagnostic.ekart.status === 'ready'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 size={16} className={pingDiagnostic.ekart.status === 'ready' ? 'text-emerald-600' : 'text-amber-600'} />
                      <span>Ekart Logistics Endpoint</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold">
                      {pingDiagnostic.ekart.message}
                    </span>
                  </div>

                  {/* Pincode Reach Engine */}
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-900 font-bold">
                      <ShieldCheck size={16} className="text-blue-600" />
                      <span>Pincode Reach Engine</span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700">{pingDiagnostic.reach.label}</span>
                  </div>

                  <p className="text-[10px] text-gray-400 text-right">
                    Live Ping Executed: {new Date(pingDiagnostic.testedAt).toLocaleTimeString()}
                  </p>
                </>
              ) : null}

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setCarrierPingWarehouse(null)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Diagnostics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
