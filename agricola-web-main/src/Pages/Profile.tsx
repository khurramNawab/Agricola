import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import AddressModal, {
  type AddressForm,
} from "../components/checkout/AddressModal";
import { useStorefront } from "../storefront/StorefrontContext";
import {
  type Address,
  type CustomerProfile,
  type OrderDetail,
  getMyOrders,
  getProfile,
  updateProfile,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../lib/checkout";

const toAddressForm = (a: Address): AddressForm => ({
  name: a.name,
  mobile: a.mobile,
  pincode: a.pincode,
  state: a.state,
  house: a.house,
  address: a.address,
  locality: a.locality,
  city: a.city,
  type: a.type,
});

export default function Profile() {
  const { isLoggedIn, openAuth, updateUser, logout } = useStorefront();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrErr, setAddrErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrInitial, setAddrInitial] = useState<Partial<AddressForm> | null>(null);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    const controller = new AbortController();
    getProfile(controller.signal)
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setEmail(p.email || "");
      })
      .catch(() => {});
    getAddresses(controller.signal).then(setAddresses).catch(() => {});
    setOrdersLoading(true);
    getMyOrders({ limit: 10 }, controller.signal)
      .then((res) => setOrders(res.orders))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
    return () => controller.abort();
  }, [isLoggedIn]);

  const handleSave = async () => {
    setSaveErr("");
    setSaveMsg("");
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setSaveErr("Please enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim(), email: trimmedEmail });
      setProfile(updated);
      updateUser({ name: updated.name, email: updated.email });
      setSaveMsg("Profile details saved successfully.");
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Couldn't update profile.");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setAddrErr("");
    setEditingId(null);
    setAddrInitial({ name, mobile: (profile?.phone || "").replace("+91", "") });
    setAddrOpen(true);
  };

  const openEdit = (a: Address) => {
    setAddrErr("");
    setEditingId(a.id);
    setAddrInitial(toAddressForm(a));
    setAddrOpen(true);
  };

  const handleSaveAddr = async (form: AddressForm) => {
    setAddrErr("");
    setAddrSaving(true);
    try {
      if (editingId) {
        const u = await updateAddress(editingId, form);
        setAddresses((prev) => prev.map((a) => (a.id === u.id ? u : a)));
      } else {
        const created = await createAddress(form);
        setAddresses((prev) => [created, ...prev]);
      }
      setAddrOpen(false);
      setEditingId(null);
    } catch (err) {
      setAddrErr(err instanceof Error ? err.message : "Couldn't save address.");
    } finally {
      setAddrSaving(false);
    }
  };

  const handleDeleteAddr = async (id: string) => {
    if (!window.confirm("Delete this delivery address?")) return;
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      /* ignore */
    }
  };

  if (!isLoggedIn) {
    return (
      <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 pt-8 pb-16">
          <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto my-12 border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#c9ecc4]/60 flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a1f] mb-2">Sign In to View Account</h2>
            <p className="text-sm text-[#434936] mb-6 leading-relaxed">
              Access your harvest orders, saved delivery addresses, and personal profile with your phone number.
            </p>
            <button
              onClick={() => openAuth()}
              className="rounded-full bg-[#486800] hover:bg-[#1e3a1f] px-8 py-3.5 text-sm font-bold text-white transition-all shadow-md cursor-pointer"
            >
              Login / Sign Up via OTP
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb & Live Context Strip */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">My Account</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#486800]" />
            <span className="text-xs font-bold text-[#434936]">
              AgriCola Verified Patron
            </span>
          </div>
        </section>

        {/* Member Banner Card */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-[#c9ecc4] text-[#486800] flex items-center justify-center font-black text-2xl shadow-2xs shrink-0">
              {name ? name.charAt(0).toUpperCase() : "A"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#1e3a1f]">
                  {name || "Organic Food Lover"}
                </h1>
                <span className="bg-[#c9ecc4]/80 text-[#486800] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Active Member
                </span>
              </div>
              <p className="text-xs text-[#434936] mt-0.5 font-medium">
                📱 {profile?.phone || "Verified via OTP"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/track"
              className="px-5 py-2.5 rounded-full bg-[#f5f3f0] hover:bg-[#eae5dc] text-[#1e3a1f] text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-[#486800]">local_shipping</span>
              <span>Track Orders</span>
            </Link>
            <button
              onClick={() => logout()}
              className="px-4 py-2.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </section>

        {/* Main Grid: Profile Details & Addresses (12-Col) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Personal Profile (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <span className="material-symbols-outlined text-[#486800] text-xl">person</span>
                <h2 className="text-base font-extrabold text-[#1e3a1f]">Personal Information</h2>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1e3a1f] block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-[#f5f3f0] rounded-2xl px-4 py-2.5 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1e3a1f] block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full bg-[#f5f3f0] rounded-2xl px-4 py-2.5 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Invoices &amp; dispatch notifications are sent here.</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1e3a1f] block mb-1">
                    Registered Mobile
                  </label>
                  <input
                    type="text"
                    value={profile?.phone || ""}
                    disabled
                    className="w-full bg-gray-100 rounded-2xl px-4 py-2.5 text-xs font-bold text-gray-500 border border-gray-200 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#486800] mt-1 font-semibold">✓ Verified via Secure OTP</p>
                </div>

                {saveErr && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                    {saveErr}
                  </div>
                )}
                {saveMsg && (
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-bold">
                    {saveMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-extrabold py-3 rounded-full shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  {saving ? "Saving Changes…" : "Save Changes"}
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Saved Delivery Addresses (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#486800] text-xl">home_pin</span>
                  <h2 className="text-base font-extrabold text-[#1e3a1f]">Saved Delivery Addresses</h2>
                </div>
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#c9ecc4]/60 hover:bg-[#c9ecc4] text-[#486800] text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Add New</span>
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="bg-[#f5f3f0] rounded-2xl p-8 text-center">
                  <p className="text-xs text-[#434936] mb-3">
                    You haven't saved any delivery addresses yet.
                  </p>
                  <button
                    type="button"
                    onClick={openAdd}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_location_alt</span>
                    <span>Add Delivery Address</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {addresses.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-2xl bg-[#f5f3f0]/60 border border-gray-200/70 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1e3a1f]">{a.name}</span>
                          <span className="text-[10px] font-bold uppercase bg-[#eae5dc] text-[#434936] px-2 py-0.5 rounded-md">
                            {a.type}
                          </span>
                          {a.isDefault && (
                            <span className="text-[10px] font-bold bg-[#c9ecc4] text-[#486800] px-2 py-0.5 rounded-md">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => openEdit(a)}
                            className="font-bold text-[#486800] hover:text-[#1e3a1f] underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddr(a.id)}
                            className="font-bold text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#434936] leading-relaxed">
                        {[a.house, a.address, a.locality, a.city, a.state, a.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>

                      {a.mobile && (
                        <p className="text-[11px] text-gray-500 font-semibold">📞 Mobile: {a.mobile}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        
        {/* Recent Orders Section (Full Width) */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 mt-8">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#c9ecc4]/60 text-[#486800] flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">package_2</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1e3a1f]">Recent Orders &amp; Dispatches</h2>
                <p className="text-xs text-[#434936]">Live updates on your organic kitchen harvests</p>
              </div>
            </div>
            <Link
              to="/products"
              className="text-xs font-bold text-[#486800] hover:text-[#1e3a1f] flex items-center gap-1"
            >
              <span>Explore Harvests</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          {ordersLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
              <span className="material-symbols-outlined animate-spin text-2xl text-[#486800]">
                progress_activity
              </span>
              <span className="text-xs font-medium">Loading your orders…</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-[#fbf9f6] rounded-2xl p-8 sm:p-12 text-center border border-gray-200/60">
              <div className="w-14 h-14 rounded-2xl bg-white text-[#486800] flex items-center justify-center text-2xl mx-auto mb-3 shadow-2xs">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <h3 className="text-sm font-bold text-[#1e3a1f] mb-1">No Orders Placed Yet</h3>
              <p className="text-xs text-[#434936] max-w-md mx-auto mb-5 leading-relaxed">
                When you order from our farm-fresh harvests, your order tracking, invoice copies, and dispatch timeline will appear right here.
              </p>
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs font-bold transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-sm">storefront</span>
                <span>Browse Harvest Catalog</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-[#fbf9f6] rounded-2xl p-5 border border-gray-200/70 hover:border-[#84b817]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#1e3a1f]">
                        {ord.orderId}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          ord.status === "delivered"
                            ? "bg-emerald-100 text-emerald-800"
                            : ord.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : ord.status === "in_transit" || ord.status === "dispatched"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ord.status.replace("_", " ")}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(ord.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-[#434936] font-medium">
                      {ord.items.map((i) => `${i.title} (${i.weight || "1 unit"} × ${i.qty})`).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-gray-200">
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
                        Total Amount
                      </span>
                      <span className="text-sm font-black text-[#1e3a1f]">
                        ₹{ord.pricing.total.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/track?orderId=${encodeURIComponent(ord.orderId)}`}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-[#434936] transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs text-[#486800]">local_shipping</span>
                        <span>Track</span>
                      </Link>
                      <Link
                        to={`/order/${ord.id}`}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#486800] hover:bg-[#1e3a1f] text-xs font-bold text-white transition-colors"
                      >
                        <span>Details</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Address Modal (Add / Edit) */}
        <AddressModal
          open={addrOpen}
          onClose={() => {
            setAddrOpen(false);
            setEditingId(null);
          }}
          onSave={handleSaveAddr}
          saving={addrSaving}
          error={addrErr}
          initial={addrInitial}
          title={editingId ? "Edit Delivery Address" : "Add Delivery Address"}
        />
      </main>
      <Footer />
    </div>
  );
}
