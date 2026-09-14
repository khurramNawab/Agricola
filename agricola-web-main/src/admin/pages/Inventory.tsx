import { useState, useEffect, useCallback } from "react";
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  Warehouse,
  Save,
  Plus,
  Minus,
} from "lucide-react";
import {
  getAdminInventory,
  updateAdminInventoryStock,
  type InventoryItem,
} from "../api/adminApi";

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "healthy">("all");
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedAllocations, setExpandedAllocations] = useState<Record<string, boolean>>({});

  const fetchInventory = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminInventory(signal);
      setItems(data);
      const initial: Record<string, number> = {};
      data.forEach((item) => {
        initial[item.id] = item.stock;
      });
      setEditedStocks(initial);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to load inventory stock");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchInventory(controller.signal);
    return () => controller.abort();
  }, [fetchInventory]);

  const handleStockChange = (id: string, value: number) => {
    setEditedStocks((prev) => ({
      ...prev,
      [id]: Math.max(0, value),
    }));
  };

  const handleQuickDelta = (id: string, delta: number) => {
    setEditedStocks((prev) => {
      const current = prev[id] ?? items.find((i) => i.id === id)?.stock ?? 0;
      return {
        ...prev,
        [id]: Math.max(0, current + delta),
      };
    });
  };

  const handleSaveStock = async (id: string) => {
    const newStock = editedStocks[id];
    if (newStock === undefined) return;
    try {
      setSavingId(id);
      setError(null);
      const res = await updateAdminInventoryStock(id, newStock);
      setNotice(
        `Updated stock for ${res.name} to ${res.stock} units. Storefront will now reflect this available quantity.`
      );
      setTimeout(() => setNotice(null), 4000);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                stock: res.stock,
                isLowStock: res.isLowStock,
                isOutOfStock: res.isOutOfStock,
              }
            : item
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to update stock count");
    } finally {
      setSavingId(null);
    }
  };

  // KPI Calculations
  const totalProducts = items.length;
  const totalStockUnits = items.reduce((sum, item) => sum + (item.stock || 0), 0);
  const lowStockCount = items.filter((i) => i.isLowStock).length;
  const outOfStockCount = items.filter((i) => i.isOutOfStock).length;

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filter === "low" && !item.isLowStock) return false;
    if (filter === "out" && !item.isOutOfStock) return false;
    if (filter === "healthy" && (item.isLowStock || item.isOutOfStock)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchCategory = (item.category || "").toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchCategory) return false;
    }
    return true;
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <Boxes className="w-8 h-8 text-[#84b817]" />
            Real-Time Inventory &amp; Stock Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manually update warehouse stock counts. Changes sync in real-time and trigger storefront urgency cues (e.g. &ldquo;Only 3 left in stock&rdquo;).
          </p>
        </div>

        <button
          onClick={() => fetchInventory()}
          disabled={loading}
          className="flex items-center gap-2 bg-[#1e3a1f] hover:bg-[#2d562f] text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* ── Notification alerts ── */}
      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI Stats Ribbon ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Total Catalog Items</span>
          <span className="text-2xl sm:text-3xl font-black text-gray-900 mt-1 block">{totalProducts}</span>
          <span className="text-[11px] text-gray-400 mt-1 block">Active Superfood SKUs</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Total Available Units</span>
          <span className="text-2xl sm:text-3xl font-black text-[#1e3a1f] mt-1 block">{totalStockUnits}</span>
          <span className="text-[11px] text-emerald-600 font-bold mt-1 block">Across All Hubs</span>
        </div>

        <div
          onClick={() => setFilter(filter === "low" ? "all" : "low")}
          className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all shadow-xs ${
            filter === "low" ? "bg-amber-100/60 border-amber-400 ring-2 ring-amber-300" : "bg-amber-50/70 border-amber-200 hover:bg-amber-100/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-bold uppercase tracking-wider">Low Stock (&le; 5 units)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-900 mt-1 block">{lowStockCount}</span>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">Shows Urgency Badge to Shoppers</span>
        </div>

        <div
          onClick={() => setFilter(filter === "out" ? "all" : "out")}
          className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all shadow-xs ${
            filter === "out" ? "bg-red-100/60 border-red-400 ring-2 ring-red-300" : "bg-red-50/70 border-red-200 hover:bg-red-100/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-800 font-bold uppercase tracking-wider">Out of Stock</span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-black text-red-900 mt-1 block">{outOfStockCount}</span>
          <span className="text-[11px] text-red-700 font-medium mt-1 block">Purchases Blocked</span>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full bg-gray-50 pl-10 pr-4 py-2 rounded-xl text-xs text-gray-900 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "all" ? "bg-[#1e3a1f] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            onClick={() => setFilter("low")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "low" ? "bg-amber-600 text-white shadow-xs" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            Low Stock (&le; 5)
          </button>
          <button
            onClick={() => setFilter("out")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "out" ? "bg-red-600 text-white shadow-xs" : "bg-red-50 text-red-800 hover:bg-red-100"
            }`}
          >
            Out of Stock (0)
          </button>
          <button
            onClick={() => setFilter("healthy")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "healthy" ? "bg-[#486800] text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Healthy Stock (&gt; 5)
          </button>
        </div>
      </div>

      {/* ── Inventory Product List ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[#84b817]" />
            <span className="text-sm font-medium">Loading inventory stock records…</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <p className="font-bold text-base">No products match this filter.</p>
            <button
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
              className="mt-3 text-xs text-[#84b817] font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item) => {
              const currentEditedStock = editedStocks[item.id] ?? item.stock;
              const hasChanged = currentEditedStock !== item.stock;
              const isSaving = savingId === item.id;
              const isLow = currentEditedStock > 0 && currentEditedStock <= 5;
              const isOut = currentEditedStock === 0;

              return (
                <div
                  key={item.id}
                  className="p-5 sm:p-6 hover:bg-gray-50/60 transition-colors flex flex-col gap-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Product Thumbnail & Meta */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                        {item.images && item.images[0] ? (
                          <img
                            src={typeof item.images[0] === "string" ? item.images[0] : item.images[0].url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">🌾</div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                            {item.sku}
                          </span>
                          <span className="text-[10px] font-bold text-[#486800] bg-[#c9ecc4]/60 px-2 py-0.5 rounded-md">
                            {item.category || "Organic"}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base mt-1 truncate">
                          {item.name}
                        </h3>
                        <span className="text-xs text-gray-400 font-semibold block mt-0.5">
                          MRP: ₹{item.price} • Selling: ₹{item.sellingPrice}
                        </span>
                      </div>
                    </div>

                    {/* Stock Input & Stepper Controls */}
                    <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
                      {/* Urgency status pill */}
                      {isLow ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Only {currentEditedStock} left (Urgency Active)
                        </span>
                      ) : isOut ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          Out of Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Healthy Stock ({currentEditedStock})
                        </span>
                      )}

                      {/* Stock Quantity Stepper */}
                      <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
                        <button
                          type="button"
                          onClick={() => handleQuickDelta(item.id, -1)}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                          title="Decrease 1 unit"
                        >
                          <Minus size={13} />
                        </button>

                        <input
                          type="number"
                          min={0}
                          value={currentEditedStock}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => {
                            if (e.target.value === "0") e.target.select();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                          }}
                          onChange={(e) => {
                            let raw = e.target.value.replace(/[^0-9]/g, "");
                            if (/^0[0-9]+/.test(raw)) {
                              raw = raw.replace(/^0+/, "");
                            }
                            handleStockChange(item.id, Math.max(0, parseInt(raw, 10) || 0));
                          }}
                          className="w-16 text-center font-black text-sm text-gray-900 bg-transparent focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => handleQuickDelta(item.id, 1)}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                          title="Increase 1 unit"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Quick +10 button */}
                      <button
                        type="button"
                        onClick={() => handleQuickDelta(item.id, 10)}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[11px] font-bold text-gray-700 transition-all cursor-pointer"
                        title="Add 10 units"
                      >
                        +10
                      </button>

                      {/* Save Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveStock(item.id)}
                        disabled={isSaving || !hasChanged}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          hasChanged
                            ? "bg-[#84b817] hover:bg-[#6d9913] text-white ring-2 ring-[#84b817]/40 active:scale-95"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <Save size={14} className={isSaving ? "animate-spin" : ""} />
                        <span>{isSaving ? "Saving…" : "Save Stock"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Warehouse Distribution Accordion Link */}
                  {item.allocations && item.allocations.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedAllocations((p) => ({
                            ...p,
                            [item.id]: !p[item.id],
                          }))
                        }
                        className="text-[#486800] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Warehouse size={13} />
                        <span>
                          {expandedAllocations[item.id] ? "Hide" : "View"} Hub Distribution ({item.allocations.length} hubs)
                        </span>
                      </button>

                      <span className="font-mono text-[11px] text-gray-400">
                        Central Catalog Stock: {item.stock} units
                      </span>
                    </div>
                  )}

                  {/* Expanded Warehouse Breakdown */}
                  {expandedAllocations[item.id] && item.allocations && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs">
                      {item.allocations.map((alloc) => (
                        <div
                          key={alloc.warehouseId}
                          className="bg-white p-2.5 rounded-xl border border-gray-200 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-gray-900 block">{alloc.warehouseName}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{alloc.warehouseCode}</span>
                          </div>
                          <span className="font-black text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                            {alloc.stock} units
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
