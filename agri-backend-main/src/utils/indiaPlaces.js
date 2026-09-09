// Normalizes place names that arrive from carrier APIs.
//
// Carriers are inconsistent: Shiprocket returns "Maharashtra" for one pincode and
// "UTTAR PRADESH"/"ASSAM" for others, and Ekart returns state codes. The storefront
// address form picks the state from a fixed title-case dropdown, so an un-normalized
// value silently fails to match and the customer sees an empty/invalid State field.

// India's 28 states + 8 UTs, spelled exactly as the storefront dropdown lists them
// (agri/src/components/checkout/AddressModal.tsx).
const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

const key = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

const BY_KEY = new Map(STATES.map((s) => [key(s), s]));

// Older spellings and the two-letter codes carriers use.
const ALIASES = {
  orissa: 'Odisha', pondicherry: 'Puducherry', uttaranchal: 'Uttarakhand',
  nctofdelhi: 'Delhi', newdelhi: 'Delhi', delhinct: 'Delhi',
  jammukashmir: 'Jammu and Kashmir', dadranagarhaveli: 'Dadra and Nagar Haveli and Daman and Diu',
  damandiu: 'Dadra and Nagar Haveli and Daman and Diu', andaman: 'Andaman and Nicobar Islands',
  ap: 'Andhra Pradesh', ar: 'Arunachal Pradesh', as: 'Assam', br: 'Bihar', cg: 'Chhattisgarh',
  ga: 'Goa', gj: 'Gujarat', hr: 'Haryana', hp: 'Himachal Pradesh', jh: 'Jharkhand',
  ka: 'Karnataka', kl: 'Kerala', mp: 'Madhya Pradesh', mh: 'Maharashtra', mn: 'Manipur',
  ml: 'Meghalaya', mz: 'Mizoram', nl: 'Nagaland', od: 'Odisha', or: 'Odisha', pb: 'Punjab',
  rj: 'Rajasthan', sk: 'Sikkim', tn: 'Tamil Nadu', tg: 'Telangana', ts: 'Telangana',
  tr: 'Tripura', up: 'Uttar Pradesh', uk: 'Uttarakhand', ut: 'Uttarakhand', wb: 'West Bengal',
  an: 'Andaman and Nicobar Islands', ch: 'Chandigarh', dl: 'Delhi', dn: 'Dadra and Nagar Haveli and Daman and Diu',
  jk: 'Jammu and Kashmir', la: 'Ladakh', ld: 'Lakshadweep', py: 'Puducherry'
};

/** "GUWAHATI" -> "Guwahati", "central delhi" -> "Central Delhi". */
const titleCasePlace = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    // Keep the small joining words lowercase, as the canonical spellings have them.
    .replace(/\b(And|Of|The)\b/g, (w) => w.toLowerCase());
};

/**
 * Canonical Indian state/UT name, matching the storefront dropdown. Falls back to a
 * title-cased version of whatever the carrier sent when it isn't recognised, so an
 * unknown value is at least presentable.
 * @returns {string|null}
 */
const canonicalState = (value) => {
  const k = key(value);
  if (!k) return null;
  return BY_KEY.get(k) || ALIASES[k] || titleCasePlace(value);
};

module.exports = { STATES, canonicalState, titleCasePlace };
