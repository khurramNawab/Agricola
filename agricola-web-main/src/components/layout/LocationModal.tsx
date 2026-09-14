import React, { useState } from "react";
import {
  detectUserLocation,
  lookupPincode,
  isValidPincode,
  type DeliveryLocation,
} from "../../lib/pincode";

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onLocationSelected: (loc: DeliveryLocation) => void;
}

const POPULAR_CITIES = [
  { name: "New Delhi", pincode: "110001", state: "Delhi" },
  { name: "Bengaluru", pincode: "560001", state: "Karnataka" },
  { name: "Mumbai", pincode: "400001", state: "Maharashtra" },
  { name: "Patna", pincode: "800001", state: "Bihar" },
  { name: "Gurugram", pincode: "122001", state: "Haryana" },
  { name: "Pune", pincode: "411001", state: "Maharashtra" },
];

const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onClose,
  onLocationSelected,
}) => {
  const [pincodeInput, setPincodeInput] = useState("");
  const [detectingGps, setDetectingGps] = useState(false);
  const [error, setError] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);

  if (!open) return null;

  const handleGpsDetect = async () => {
    setError("");
    setDetectingGps(true);
    try {
      const loc = await detectUserLocation();
      onLocationSelected(loc);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detect location.");
    } finally {
      setDetectingGps(false);
    }
  };

  const handleManualApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pincodeInput.trim();
    if (!isValidPincode(pin)) {
      setError("Please enter a valid 6-digit Indian PIN code.");
      return;
    }

    setError("");
    setLoadingLookup(true);
    try {
      const info = await lookupPincode(pin);
      const loc: DeliveryLocation = {
        pincode: pin,
        city: info?.city || "India",
        state: info?.state || "India",
        district: info?.district,
        source: "manual",
      };
      onLocationSelected(loc);
      onClose();
    } catch {
      const loc: DeliveryLocation = {
        pincode: pin,
        city: "India",
        state: "India",
        source: "manual",
      };
      onLocationSelected(loc);
      onClose();
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleCitySelect = (c: typeof POPULAR_CITIES[0]) => {
    const loc: DeliveryLocation = {
      pincode: c.pincode,
      city: c.name,
      state: c.state,
      source: "manual",
    };
    onLocationSelected(loc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#fbf9f6] p-6 shadow-2xl border border-gray-100 flex flex-col gap-5 text-[#1b1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-[#486800]">
              near_me
            </span>
            <div>
              <h3 className="text-base font-black text-[#1e3a1f]">
                Select Delivery Location
              </h3>
              <p className="text-[11px] text-[#434936]">
                Check express cold-chain delivery availability
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white text-gray-400 hover:text-gray-700 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* 1-Click GPS Detect Button */}
        <button
          type="button"
          onClick={handleGpsDetect}
          disabled={detectingGps}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#c9ecc4] hover:bg-[#84b817] text-[#1e3a1f] hover:text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          {detectingGps ? (
            <>
              <span className="material-symbols-outlined text-lg animate-spin">
                progress_activity
              </span>
              <span>Detecting Your Real-Time Location…</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg text-[#486800]">
                my_location
              </span>
              <span>Use Current Location (GPS Auto-Detect)</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="font-semibold text-[10px] uppercase tracking-wider text-[#737965]">
            Or Enter Pincode
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Manual Input Form */}
        <form onSubmit={handleManualApply} className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={pincodeInput}
            onChange={(e) => {
              setPincodeInput(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="Enter 6-digit PIN code (e.g. 110001)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#1b1c1a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817] shadow-2xs"
          />
          <button
            type="submit"
            disabled={loadingLookup || pincodeInput.length !== 6}
            className="px-5 py-2.5 rounded-xl bg-[#1e3a1f] hover:bg-[#486800] text-white text-xs font-bold transition-all disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {loadingLookup ? "Checking…" : "Apply"}
          </button>
        </form>

        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#1e3a1f]">
              <span className="material-symbols-outlined text-base text-amber-600">location_off</span>
              <span>GPS Location Fallback</span>
            </div>
            <p className="text-[11px] text-[#434936]">
              {error} Please enter your 6-digit PIN code manually above or pick your city from the list below.
            </p>
          </div>
        )}

        {/* Popular Cities */}
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#434936]">
            Popular Metro Cities
          </span>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => handleCitySelect(c)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#f5f3f0] border border-gray-200/70 text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="text-xs font-bold text-[#1e3a1f] block group-hover:text-[#486800]">
                    {c.name}
                  </span>
                  <span className="text-[10px] text-gray-400">PIN: {c.pincode}</span>
                </div>
                <span className="material-symbols-outlined text-sm text-gray-400 group-hover:text-[#486800]">
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationModal;
