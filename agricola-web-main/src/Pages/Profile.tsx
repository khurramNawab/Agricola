import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Footer from "../components/layout/Footer";
import AddressModal, {
  type AddressForm,
} from "../components/checkout/AddressModal";
import { useStorefront } from "../storefront/StorefrontContext";
import {
  type Address,
  type CustomerProfile,
  getProfile,
  updateProfile,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../lib/checkout";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#84b817]";

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
  const navigate = useNavigate();
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
    return () => controller.abort();
  }, [isLoggedIn]);

  const handleSave = async () => {
    setSaveErr("");
    setSaveMsg("");
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setSaveErr("Enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim(), email: trimmedEmail });
      setProfile(updated);
      updateUser({ name: updated.name, email: updated.email });
      setSaveMsg("Profile updated.");
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
    if (!window.confirm("Delete this address?")) return;
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      /* ignore */
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <main className="flex-1">
          <div className="py-24 text-center">
            <p className="mb-6 text-gray-500">Please log in to view your profile.</p>
            <button
              onClick={() => openAuth()}
              className="rounded-lg bg-[#84b817] px-8 py-3 font-medium text-white transition-colors hover:bg-[#6d9913]"
            >
              Login / Signup
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1">
        <div className="container mx-auto max-w-2xl px-4 py-10">
          <h1 className="mb-8 font-serif text-3xl text-gray-900 sm:text-4xl">My Account</h1>

          {/* Profile */}
          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Profile</h2>
            <label className="mb-1 block text-sm text-gray-600">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mb-4 ${inputClass}`} />
            <label className="mb-1 block text-sm text-gray-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`mb-1 ${inputClass}`}
            />
            <p className="mb-4 text-xs text-gray-400">Order confirmations and updates are sent here.</p>
            <label className="mb-1 block text-sm text-gray-600">Phone</label>
            <input value={profile?.phone || ""} disabled className={`mb-4 ${inputClass} bg-gray-50 text-gray-500`} />
            {saveErr && <p className="mb-2 text-sm text-red-500">{saveErr}</p>}
            {saveMsg && <p className="mb-2 text-sm text-green-600">{saveMsg}</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#84b817] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6d9913] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </section>

          {/* Addresses */}
          <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Saved Addresses</h2>
              <button onClick={openAdd} className="flex items-center gap-1 text-sm font-medium text-[#6d9913] hover:underline">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {addresses.length === 0 ? (
              <p className="text-sm text-gray-500">No saved addresses yet.</p>
            ) : (
              <div className="space-y-3">
                {addresses.map((a) => (
                  <div key={a.id} className="flex justify-between gap-3 rounded-xl border border-gray-100 p-4 text-sm">
                    <div className="text-gray-700">
                      <span className="font-medium">
                        {a.name} · {a.type}
                      </span>
                      {a.isDefault && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Default</span>
                      )}
                      <br />
                      {[a.house, a.address, a.locality, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                      <br />
                      <span className="text-gray-500">Mobile: {a.mobile}</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button onClick={() => openEdit(a)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteAddr(a.id)} className="text-xs font-medium text-red-500 hover:text-red-600">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/track")}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Track an Order
            </button>
            <button
              onClick={() => logout()}
              className="flex-1 rounded-lg border border-red-200 bg-white py-3 font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      </main>
      <Footer />

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
        title={editingId ? "Edit Address" : "Add Address"}
      />
    </div>
  );
}
