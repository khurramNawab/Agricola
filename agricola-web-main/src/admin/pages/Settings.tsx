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
  FileText,
  Mail,
  Download,
  Send,
  Ticket,
  Printer,
  FileCheck,
} from "lucide-react";
import {
  getAdminSettings,
  updateAdminSettings,
  downloadSampleInvoice,
  emailSampleInvoice,
  type AdminStoreSettings,
} from "../api/adminApi";
import { sanitizeZeroSafeNumber, zeroSafeInputProps } from "../../lib/zeroSafe";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminStoreSettings>({
    storeName: "AgriCola Organics",
    supportEmail: "support@agricola.co.in",
    supportPhone: "+91 9012659000",
    supportWhatsApp: "+91 9012659000",
    businessHours: "Mon - Sat: 9:00 AM - 7:00 PM IST",
    storeAddress: "AgriCola Headquarters, Organic Hub, Kaithal, Haryana (136027) INDIA",
    enableMultiWarehouse: true,
    defaultCarrier: "both",
    freeShippingThreshold: 799,
    standardDeliveryCharge: 50,
    enableWhatsAppNotifications: true,
    enableEmailNotifications: true,
    enableCod: true,
    maxCodAmount: 9999,
    allowCouponStacking: false,
    maxStackedCoupons: 2,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"general" | "shipping" | "payments" | "notifications" | "invoices">("general");

  // Sample Invoice Preview & Email Testing State
  const [sampleEmail, setSampleEmail] = useState("");
  const [sampleEmailSending, setSampleEmailSending] = useState(false);
  const [sampleEmailSuccess, setSampleEmailSuccess] = useState<string | null>(null);
  const [downloadingSample, setDownloadingSample] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminSettings();
      if (data) {
        setSettings({
          ...data,
          allowCouponStacking: data.allowCouponStacking ?? false,
          maxStackedCoupons: data.maxStackedCoupons || 2,
        });
        if (!sampleEmail && data.supportEmail) {
          setSampleEmail(data.supportEmail);
        }
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
      const payload: AdminStoreSettings = {
        ...settings,
        freeShippingThreshold: Number(settings.freeShippingThreshold) || 0,
        standardDeliveryCharge: Number(settings.standardDeliveryCharge) || 0,
        maxCodAmount: Number(settings.maxCodAmount) || 0,
      };
      const updated = await updateAdminSettings(payload);
      setSettings(updated);
      setSuccessMessage("Settings saved and applied successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSample = async (size?: "4x6") => {
    try {
      setDownloadingSample(size || "a4");
      setError(null);
      await downloadSampleInvoice(size);
    } catch (err: any) {
      setError(err.message || "Failed to generate sample invoice");
    } finally {
      setDownloadingSample(null);
    }
  };

  const handleSendSampleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = (sampleEmail || settings.supportEmail).trim();
    if (!target || !/^\S+@\S+\.\S+$/.test(target)) {
      setError("Please provide a valid email address to test invoice delivery.");
      return;
    }
    try {
      setSampleEmailSending(true);
      setError(null);
      setSampleEmailSuccess(null);
      const res = await emailSampleInvoice(target);
      setSampleEmailSuccess(res.message || `Sample GST Tax Invoice PDF dispatched to ${target}!`);
      setTimeout(() => setSampleEmailSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to email sample invoice.");
    } finally {
      setSampleEmailSending(false);
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
            Configure store profile, fulfillment routing, payments, notifications, and unified tax invoices.
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-gray-100 p-1.5 rounded-2xl">
        {[
          { id: "general", label: "Store Profile", icon: Store },
          { id: "shipping", label: "Shipping & Fulfillment", icon: Truck },
          { id: "payments", label: "Payments & COD", icon: CreditCard },
          { id: "notifications", label: "Alerts & Notifications", icon: Bell },
          { id: "invoices", label: "Tax Invoice & Sample", icon: FileText },
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
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Multi-Warehouse Fulfillment Mode</h4>
                  <p className="text-xs text-gray-500">
                    When enabled, orders wait in unassigned state until routed to the nearest warehouse hub.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, enableMultiWarehouse: !settings.enableMultiWarehouse })}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "both", label: "Smart Hybrid (Ekart + Shiprocket)" },
                  { id: "ekart", label: "Ekart Logistics Priority" },
                  { id: "shiprocket", label: "Shiprocket Priority" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, defaultCarrier: c.id as any })}
                    className={`py-3 px-3 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                      settings.defaultCarrier === c.id
                        ? "bg-green-50 border-green-600 text-green-800 shadow-xs ring-1 ring-green-600"
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
                  type="text"
                  {...zeroSafeInputProps}
                  value={settings.freeShippingThreshold === 0 ? "0" : (settings.freeShippingThreshold || "")}
                  onChange={(e) => {
                    const clean = sanitizeZeroSafeNumber(e.target.value);
                    setSettings({ ...settings, freeShippingThreshold: clean === "" ? ("" as any) : Number(clean) });
                  }}
                  onBlur={() => {
                    if (settings.freeShippingThreshold === ("" as any) || settings.freeShippingThreshold === undefined) {
                      setSettings((prev) => ({ ...prev, freeShippingThreshold: 0 }));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white font-bold"
                />
                <p className="text-[11px] text-gray-400 mt-1">Orders above this subtotal qualify for free delivery (Currently ₹{settings.freeShippingThreshold || 0}).</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Standard Delivery Fee (₹)
                </label>
                <input
                  type="text"
                  {...zeroSafeInputProps}
                  value={settings.standardDeliveryCharge === 0 ? "0" : (settings.standardDeliveryCharge || "")}
                  onChange={(e) => {
                    const clean = sanitizeZeroSafeNumber(e.target.value);
                    setSettings({ ...settings, standardDeliveryCharge: clean === "" ? ("" as any) : Number(clean) });
                  }}
                  onBlur={() => {
                    if (settings.standardDeliveryCharge === ("" as any) || settings.standardDeliveryCharge === undefined) {
                      setSettings((prev) => ({ ...prev, standardDeliveryCharge: 0 }));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white font-bold"
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
              <p className="text-xs text-gray-500">Configure online payment gateways, coupon stacking, and Cash on Delivery rules.</p>
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
                type="text"
                {...zeroSafeInputProps}
                value={settings.maxCodAmount === 0 ? "0" : (settings.maxCodAmount || "")}
                onChange={(e) => {
                  const clean = sanitizeZeroSafeNumber(e.target.value);
                  setSettings({ ...settings, maxCodAmount: clean === "" ? ("" as any) : Number(clean) });
                }}
                onBlur={() => {
                  if (settings.maxCodAmount === ("" as any) || settings.maxCodAmount === undefined) {
                    setSettings((prev) => ({ ...prev, maxCodAmount: 0 }));
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#84b817] focus:bg-white font-bold"
              />
              <p className="text-[11px] text-gray-400 mt-1">Orders exceeding this amount must be prepaid online.</p>
            </div>

            {/* Coupon Stacking Policy */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Multi-Coupon Stacking Policy</h4>
                  <p className="text-xs text-gray-500">
                    Allow shoppers to combine up to 2 coupons on a single order.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, allowCouponStacking: !settings.allowCouponStacking })}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.allowCouponStacking ? "bg-[#84b817]" : "bg-gray-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.allowCouponStacking ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* 4. NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Communication &amp; Alerts</h3>
              <p className="text-xs text-gray-500">Automated order updates, invoice dispatching, and messaging triggers.</p>
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
                  Send PDF tax invoices and dispatch updates to customer &amp; admin emails automatically upon order placement.
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

        {/* 5. TAX INVOICE & SAMPLE PREVIEW */}
        {activeTab === "invoices" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Official GST Tax Invoice &amp; Sample Inspection</h3>
              <p className="text-xs text-gray-500">
                Preview sample invoices and test live email delivery. The syntax, layout, and GST calculations are 100% identical for customers and administrators.
              </p>
            </div>

            {/* Architecture / Template Integrity Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <FileCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-950">Unified Invoice Template Guarantee</h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Both customer downloads, admin order details, courier shipping slips, and automated email attachments share the exact same PDF generation pipeline (<code>buildInvoiceData</code> engine in <code>src/utils/invoice.js</code>). GSTIN, SAC/HSN codes, CGST/SGST/IGST breakdown, and packaging slips remain strictly unified across all endpoints.
                </p>
              </div>
            </div>

            {/* Sample Download Actions */}
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-[#84b817]" />
                Download Live Sample Invoices
              </h4>
              <p className="text-xs text-gray-500">
                Click below to instantly inspect how the official invoice renders with live branding and tax formatting.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  disabled={!!downloadingSample}
                  onClick={() => handleDownloadSample()}
                  className="px-4 py-2.5 bg-white border border-gray-300 hover:border-[#84b817] hover:text-[#486800] rounded-xl text-xs font-bold text-gray-800 transition-all shadow-2xs cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {downloadingSample === "a4" ? (
                    <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-green-700" />
                  )}
                  <span>Download Sample A4 Tax Invoice (PDF)</span>
                </button>

                <button
                  type="button"
                  disabled={!!downloadingSample}
                  onClick={() => handleDownloadSample("4x6")}
                  className="px-4 py-2.5 bg-white border border-gray-300 hover:border-[#84b817] hover:text-[#486800] rounded-xl text-xs font-bold text-gray-800 transition-all shadow-2xs cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {downloadingSample === "4x6" ? (
                    <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4 text-gray-700" />
                  )}
                  <span>Download Sample 4×6 Thermal Courier Label (PDF)</span>
                </button>
              </div>
            </div>

            {/* Test Email Dispatch Form */}
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#84b817]" />
                    Test Live Email Invoice Delivery
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Send a real sample invoice PDF directly to your email address to confirm Zoho SMTP dispatch and formatting.
                  </p>
                </div>
              </div>

              {sampleEmailSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{sampleEmailSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="email"
                  placeholder="Enter your email (e.g. admin@agricola.co.in)"
                  value={sampleEmail}
                  onChange={(e) => setSampleEmail(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#84b817]"
                />
                <button
                  type="button"
                  disabled={sampleEmailSending}
                  onClick={handleSendSampleEmail}
                  className="px-5 py-2.5 bg-[#1e3a1f] hover:bg-[#486800] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sampleEmailSending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#84b817]" />
                  )}
                  <span>{sampleEmailSending ? "Sending Invoice…" : "Send Test Invoice Email"}</span>
                </button>
              </div>
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
