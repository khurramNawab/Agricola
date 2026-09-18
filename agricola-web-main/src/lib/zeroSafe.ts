import React from "react";

/**
 * Zero-Safe Input Sanitizer & Helpers
 *
 * Prevents leading zeros (e.g. "0599" -> "599", "00" -> "0"),
 * auto-selects input on focus, blocks mouse-wheel scrolling,
 * prevents negative & scientific notation keys ('-', 'e', 'E', '+'),
 * and provides safe fallbacks.
 */

export const sanitizeZeroSafeNumber = (
  raw: string | number | undefined | null,
  allowEmpty: boolean = true
): string => {
  if (raw === undefined || raw === null) return allowEmpty ? "" : "0";
  const str = String(raw).replace(/[^0-9]/g, "");
  if (!str) return allowEmpty ? "" : "0";
  // Strip leading zeros if followed by another digit (e.g. "0599" -> "599", "0050" -> "50", "00" -> "0")
  return str.replace(/^0+(?=\d)/, "");
};

export const parseZeroSafeInt = (
  raw: string | number | undefined | null,
  fallback: number = 0,
  min: number = 0,
  max?: number
): number => {
  const sanitized = sanitizeZeroSafeNumber(raw, true);
  if (!sanitized) return fallback;
  let parsed = parseInt(sanitized, 10);
  if (isNaN(parsed)) return fallback;
  if (parsed < min) parsed = min;
  if (max !== undefined && parsed > max) parsed = max;
  return parsed;
};

export const zeroSafeInputProps = {
  inputMode: "numeric" as const,
  autoComplete: "off",
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  },
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  },
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
      e.preventDefault();
    }
  },
};
