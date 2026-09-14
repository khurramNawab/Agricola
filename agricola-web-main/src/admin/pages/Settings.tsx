import React, { useState, useEffect } from "react";
import {
  Settings,
  Store,
  Truck,
  CreditCard,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  getAdminSettings,
  updateAdminSettings,
  type AdminStoreSettings,
} from "../api/adminApi";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminStoreSettings>({
    storeName: "AgriCola Organics",
    supportEmail: "support@agricola.co.in",
    supportPhone: "+91 9012659000",
    supportWhatsApp: "+91 9012659000",
    businessHours: "Mon - Sat: 9:00 AM - 7:00 PM IST",
    storeAddress: "AgriCola Headquarters, Organic Hub, Patna, Bihar - 800001",
    enableMultiWarehouse: true,
    defaultCarrier: "both",
    freeShippingThreshold: 999,
    standardDeliveryCharge: 50,
    enableWhatsAppNotifications: true,
    enableEmailNotifications: true,
    enableCod: true,
    maxCodAmount: 49999,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"general" | "shipping" | "payments" | "notifications">("general");

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminSettings();
      if (data) {
        setSettings(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load store settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      const updated = await updateAdminSettings(settings);
      setSettings(updated);
      setSuccessMessage("Settings saved and applied successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-gray-500">
        <RefreshCw className="w-8 h-8 text-[#84b817] animate-spin mx-auto mb-3" />
        <p>Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-[#84b817]" />
            Store &amp; System Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure store contact information, multi-warehouse fulfillment, logistics rules, and payment options.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#84b817] hover:bg-[#6d9913] text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer self-start"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-100 p-1.5 rounded-2xl">
        {[
          { id: "general", label: "Store Profile", icon: Store },
          { id: "shipping", label: "Shipping & Fulfillment", icon: Truck },
          { id: "payments", label: "Payments & COD", icon: CreditCard },
          { id: "notifications", label: "Alerts & Notifications", icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#84b817]" : "text-gray-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xs space-y-6">
        {/* 1. STORE PROFILE */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">General Information</h3>
              <p className="text-xs text-gray-500">Store branding and official public contact credentials.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Store Public Name
                </label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Customer Care Phone
                </label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Official Support WhatsApp
                </label>
                <input
                  type="text"
                  value={settings.supportWhatsApp}
                  onChange={(e) => setSettings({ ...settings, supportWhatsApp: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Business Hours
              </label>
              <input
                type="text"
                value={settings.businessHours}
                onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Official Farm / Headquarters Address
              </label>
              <textarea
                rows={3}
                value={settings.storeAddress}
                onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
              />
            </div>
          </div>
        )}

        {/* 2. SHIPPING & FULFILLMENT */}
        {activeTab === "shipping" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Logistics &amp; Delivery Engine</h3>
              <p className="text-xs text-gray-500">Multi-warehouse allocation and delivery rate policies.</p>
            </div>

            {/* Multi-warehouse switch */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Multi-Warehouse Fulfillment Mode</h4>
                  <p className="text-xs text-gray-500">
                    When enabled, orders are held in <code>awaitingWarehouseAssignment</code> until assigned to a hub.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, enableMultiWarehouse: !settings.enableMultiWarehouse })}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.enableMultiWarehouse ? "bg-[#84b817]" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.enableMultiWarehouse ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Default carrier preference */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Active Logistics Carrier Routing
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "both", label: "Smart Hybrid (Ekart + Shiprocket)" },
                  { id: "ekart", label: "Ekart Logistics Priority" },
                  { id: "shiprocket", label: "Shiprocket Priority" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, defaultCarrier: c.id as any })}
                    className={`py-3 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      settings.defaultCarrier === c.id
                        ? "bg-green-50 border-green-600 text-green-800 shadow-xs"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Free Shipping Minimum Cart Value (₹)
                </label>
                <input
                  type="number"
                  value={settings.freeShippingThreshold}
                  onChange={(e) => setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">Orders above this subtotal qualify for free delivery.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Standard Delivery Fee (₹)
                </label>
                <input
                  type="number"
                  value={settings.standardDeliveryCharge}
                  onChange={(e) => setSettings({ ...settings, standardDeliveryCharge: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">Flat base rate for orders below free shipping threshold.</p>
              </div>
            </div>
          </div>
        )}

        {/* 3. PAYMENTS & COD */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Payment Gateways &amp; COD</h3>
              <p className="text-xs text-gray-500">Configure online payment gateways and Cash on Delivery rules.</p>
            </div>

            {/* Razorpay status badge */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">Razorpay Payment Gateway</h4>
                  <p className="text-xs text-emerald-800">
                    Active &amp; verified. Handles Credit/Debit cards, UPI, Netbanking, and Wallets.
                  </p>
                </div>
              </div>
              <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Active
              </span>
            </div>

            {/* COD Switch */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Enable Cash on Delivery (COD)</h4>
                  <p className="text-xs text-gray-500">
                    Allow customers to pay in cash upon doorstep package delivery.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, enableCod: !settings.enableCod })}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.enableCod ? "bg-[#84b817]" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.enableCod ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Maximum COD Order Cap (₹)
              </label>
              <input
                type="number"
                value={settings.maxCodAmount}
                onChange={(e) => setSettings({ ...settings, maxCodAmount: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white"
              />
              <p className="text-[11px] text-gray-400 mt-1">Orders exceeding this amount must be prepaid online.</p>
            </div>
          </div>
        )}

        {/* 4. NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Communication &amp; Alerts</h3>
              <p className="text-xs text-gray-500">Automated order updates and abandoned cart triggers.</p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">WhatsApp Order Updates</h4>
                <p className="text-xs text-gray-500">
                  Send automated order confirmation and AWB tracking links via WhatsApp.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, enableWhatsAppNotifications: !settings.enableWhatsAppNotifications })}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.enableWhatsAppNotifications ? "bg-[#84b817]" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.enableWhatsAppNotifications ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Automated Email Notifications</h4>
                <p className="text-xs text-gray-500">
                  Send PDF tax invoices and dispatch updates to customer emails.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, enableEmailNotifications: !settings.enableEmailNotifications })}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.enableEmailNotifications ? "bg-[#84b817]" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.enableEmailNotifications ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Save button footer */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#84b817] hover:bg-[#6d9913] text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
