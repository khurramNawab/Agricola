import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { checkPincodeServiceability } from "../../lib/checkout";
import { getSavedPincode } from "../../lib/pincode";

interface AddressForm {
  name: string;
  mobile: string;
  pincode: string;
  state: string;
  house: string;
  address: string;
  locality: string;
  city: string;
  type: "Home" | "Office";
}

const emptyForm: AddressForm = {
  name: "",
  mobile: "",
  pincode: "",
  state: "",
  house: "",
  address: "",
  locality: "",
  city: "",
  type: "Home",
};

type FieldErrors = Partial<Record<keyof AddressForm, string>>;

// India's 28 states + 8 union territories — used for the State dropdown so the
// value is always a valid Indian state/UT rather than free text.
const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

// Client-side mirror of the backend rules (agri-backend/src/routes/addresses.js)
// so users get inline feedback instead of a generic 400 on save. Mobile and
// pincode use Indian formats.
const validate = (f: AddressForm): FieldErrors => {
  const e: FieldErrors = {};
  if (!f.name.trim()) e.name = "Name is required";
  if (!/^[6-9][0-9]{9}$/.test(f.mobile))
    e.mobile = "Enter a valid 10-digit Indian mobile number";
  if (!/^[1-9][0-9]{5}$/.test(f.pincode))
    e.pincode = "Enter a valid 6-digit pincode";
  if (!INDIAN_STATES.includes(f.state as (typeof INDIAN_STATES)[number]))
    e.state = "Select a state";
  if (!f.address.trim()) e.address = "Address is required";
  if (!f.city.trim()) e.city = "City is required";
  return e;
};

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (form: AddressForm) => void;
  saving?: boolean;
  error?: string;
  /** When set, the form opens pre-filled (editing, or a new address seeded from the user). */
  initial?: Partial<AddressForm> | null;
  /** Heading text; defaults to "Address". */
  title?: string;
}

const inputClass =
  "w-full rounded-full border border-gray-200 px-5 py-3 text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500";

const AddressModal: React.FC<AddressModalProps> = ({
  open,
  onClose,
  onSave,
  saving = false,
  error,
  initial,
  title = "Address",
}) => {
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Pincode serviceability: idle | checking | ok | no | unverified.
  const [pin, setPin] = useState<{ state: "idle" | "checking" | "ok" | "no" | "unverified"; label: string }>({
    state: "idle",
    label: "",
  });

  useEffect(() => {
    if (open) {
      // For a new address, start from the pincode the shopper already checked on the
      // product/cart pages so they don't enter it twice.
      const prefill = initial ? {} : { pincode: getSavedPincode() };
      setForm({ ...emptyForm, ...prefill, ...(initial ?? {}) });
      setErrors({});
      setPin({ state: "idle", label: "" });
    }
  }, [open, initial]);

  // When a full pincode is entered, check carrier serviceability + auto-fill city/state.
  useEffect(() => {
    if (!open) return;
    if (!/^[1-9][0-9]{5}$/.test(form.pincode)) {
      setPin({ state: "idle", label: "" });
      return;
    }
    const controller = new AbortController();
    setPin({ state: "checking", label: "Checking delivery availability…" });
    const t = setTimeout(() => {
      checkPincodeServiceability(form.pincode, controller.signal)
        .then((r) => {
          if (r.unverified) {
            setPin({ state: "unverified", label: "" });
            return;
          }
          if (r.serviceable) {
            const where = [r.city, r.state].filter(Boolean).join(", ");
            setPin({ state: "ok", label: where ? `Delivers to ${where}` : "Delivery available" });
            // Auto-fill city/state from the pincode (r.state matches our dropdown values).
            if (r.city || r.state) {
              setForm((prev) => ({
                ...prev,
                city: r.city || prev.city,
                state: r.state || prev.state,
              }));
              setErrors((prev) => ({ ...prev, city: undefined, state: undefined }));
            }
          } else {
            setPin({ state: "no", label: "Sorry, we don’t deliver to this pincode yet." });
          }
        })
        .catch(() => setPin({ state: "idle", label: "" }));
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [open, form.pincode]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  // A plain render helper (NOT a nested component) so inputs keep focus between renders.
  const renderField = (
    key: keyof AddressForm,
    placeholder: string,
    numericMax?: number
  ) => (
    <div>
      <input
        className={`${inputClass} ${
          errors[key] ? "border-red-400 focus:ring-red-400" : ""
        }`}
        placeholder={placeholder}
        value={form[key]}
        inputMode={numericMax ? "numeric" : undefined}
        maxLength={numericMax}
        onChange={(e) => {
          const value = numericMax
            ? e.target.value.replace(/\D/g, "").slice(0, numericMax)
            : e.target.value;
          setForm((prev) => ({ ...prev, [key]: value }));
          if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
        }}
      />
      {errors[key] && (
        <p className="mt-1 px-4 text-xs text-red-500">{errors[key]}</p>
      )}
    </div>
  );

  const handleSave = () => {
    const found = validate(form);
    if (pin.state === "no")
      found.pincode = "We don’t deliver to this pincode yet.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-title"
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2
            id="address-title"
            className="flex-1 text-center text-xl font-bold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {renderField("name", "Name*")}
          {renderField("mobile", "Mobile*", 10)}

          <hr className="border-gray-100" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {renderField("pincode", "Pincode*", 6)}
            <div>
              <select
                className={`${inputClass} ${
                  errors.state ? "border-red-400 focus:ring-red-400" : ""
                } ${form.state ? "text-gray-700" : "text-gray-400"}`}
                value={form.state}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev) => ({ ...prev, state: value }));
                  if (errors.state)
                    setErrors((prev) => ({ ...prev, state: undefined }));
                }}
              >
                <option value="">State*</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.state && (
                <p className="mt-1 px-4 text-xs text-red-500">{errors.state}</p>
              )}
            </div>
          </div>
          {pin.label && (
            <p
              className={`px-4 text-xs ${
                pin.state === "no"
                  ? "text-red-500"
                  : pin.state === "ok"
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              {pin.label}
            </p>
          )}
          {renderField("house", "House Number / Tower / Block")}
          {renderField("address", "Address (Building, Street, Area)*")}
          {renderField("locality", "Locality / Town")}
          {renderField("city", "City / District*")}

          <hr className="border-gray-100" />

          <div>
            <p className="mb-3 text-gray-500">Type of Address</p>
            <div className="flex gap-10">
              {(["Home", "Office"] as const).map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-gray-800"
                >
                  <input
                    type="radio"
                    name="addressType"
                    checked={form.type === option}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, type: option }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          <div className="mt-2 flex gap-4">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg bg-gray-200 py-3 font-medium text-gray-500 transition-colors hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || pin.state === "checking" || pin.state === "no"}
              className="flex-1 rounded-lg bg-[#84b817] py-3 font-medium text-white transition-colors hover:bg-[#6d9913] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export type { AddressForm };
export default AddressModal;
