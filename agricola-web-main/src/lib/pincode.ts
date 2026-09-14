// Delivery pincode & real-time location detection utilities.
const PINCODE_KEY = "agricola.pincode";
const LOCATION_KEY = "agricola.deliveryLocation";

export interface DeliveryLocation {
  pincode: string;
  city: string;
  state: string;
  district?: string;
  locality?: string;
  source?: "gps" | "manual" | "default";
}

export const isValidPincode = (pincode: string): boolean =>
  /^[1-9][0-9]{5}$/.test(pincode.trim());

export function getSavedPincode(): string {
  try {
    const saved = localStorage.getItem(PINCODE_KEY) ?? "";
    return isValidPincode(saved) ? saved.trim() : "";
  } catch {
    return "";
  }
}

export function savePincode(pincode: string): void {
  const clean = pincode.trim();
  if (!isValidPincode(clean)) return;
  try {
    localStorage.setItem(PINCODE_KEY, clean);
  } catch {
    // Non-fatal
  }
}

export function getSavedLocation(): DeliveryLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const loc = JSON.parse(raw) as DeliveryLocation;
    if (loc && loc.pincode && isValidPincode(loc.pincode)) {
      return loc;
    }
  } catch {
    // Fall back
  }
  return null;
}

export function saveLocation(loc: DeliveryLocation): void {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    if (loc.pincode) {
      savePincode(loc.pincode);
    }
  } catch {
    // Non-fatal
  }
}

export async function reverseGeocodeCoords(lat: number, lon: number): Promise<DeliveryLocation> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const postcode = data.postcode || "";
      const city = data.city || data.locality || data.principalSubdivision || "";
      const state = data.principalSubdivision || "";
      const locality = data.locality || data.localityInfo?.administrative?.[3]?.name || "";

      if (postcode && isValidPincode(postcode)) {
        return {
          pincode: postcode.trim(),
          city: city || "India",
          state: state || "India",
          locality,
          source: "gps",
        };
      }
    }
  } catch (e) {
    console.warn("BigDataCloud geocode failed, trying fallback...", e);
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "AgriColaStorefront/2.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const postcode = addr.postcode || "";
      const city = addr.city || addr.town || addr.village || addr.state_district || "";
      const state = addr.state || "";
      const locality = addr.suburb || addr.neighbourhood || addr.road || "";

      if (postcode && isValidPincode(postcode)) {
        return {
          pincode: postcode.trim(),
          city: city || "India",
          state: state || "India",
          locality,
          source: "gps",
        };
      }
    }
  } catch (e) {
    console.warn("OSM Nominatim fallback failed", e);
  }

  throw new Error("Unable to determine postal code for your GPS coordinates.");
}

export async function lookupPincode(pincode: string): Promise<{ city: string; state: string; district: string } | null> {
  const clean = pincode.trim();
  if (!isValidPincode(clean)) return null;

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === "Success" && data[0]?.PostOffice?.[0]) {
        const po = data[0].PostOffice[0];
        return {
          city: po.District || po.Division || po.Name || "India",
          state: po.State || "India",
          district: po.District || "",
        };
      }
    }
  } catch {
    // Non-fatal
  }
  return null;
}

export function detectUserLocation(): Promise<DeliveryLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocodeCoords(pos.coords.latitude, pos.coords.longitude);
          saveLocation(loc);
          resolve(loc);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Failed to resolve GPS coordinates."));
        }
      },
      (err) => {
        let msg = "Location permission was denied.";
        if (err.code === err.POSITION_UNAVAILABLE) msg = "Location information is unavailable.";
        if (err.code === err.TIMEOUT) msg = "The request to get user location timed out.";
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
