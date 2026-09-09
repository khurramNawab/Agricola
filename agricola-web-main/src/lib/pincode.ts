// The delivery pincode the shopper last checked.
//
// Kept in localStorage so the answer survives a reload and carries across the funnel:
// product page -> cart gate -> prefilled pincode on the checkout address form.

const KEY = "agricola.pincode";

export const isValidPincode = (pincode: string): boolean =>
  /^[1-9][0-9]{5}$/.test(pincode);

export function getSavedPincode(): string {
  try {
    const saved = localStorage.getItem(KEY) ?? "";
    return isValidPincode(saved) ? saved : "";
  } catch {
    // Private mode / storage disabled — behave as if nothing was saved.
    return "";
  }
}

export function savePincode(pincode: string): void {
  if (!isValidPincode(pincode)) return;
  try {
    localStorage.setItem(KEY, pincode);
  } catch {
    // Non-fatal: the check still works, it just won't be remembered.
  }
}
