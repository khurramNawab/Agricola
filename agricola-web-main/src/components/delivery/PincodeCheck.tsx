import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getDeliveryQuote, type DeliveryQuote } from "../../lib/checkout";
import { getSavedPincode, isValidPincode, savePincode } from "../../lib/pincode";

type Status = "idle" | "checking" | "ok" | "no" | "error";

export interface PincodeCheckProps {
  /**
   * "cart" quotes the real delivery charge for the given lines and is meant to gate
   * checkout; "product" is advisory — availability and ETA only, no price, because a
   * per-item charge would contradict the cart-level free-delivery threshold.
   */
  variant: "cart" | "product";
  /** Cart lines to price (`weight` = selected pack size). Omit on the product page. */
  items?: { productId: string; qty: number; weight?: string | null }[];
  /** Fires whenever a check settles, so a parent can gate its own CTA. */
  onResult?: (result: DeliveryQuote | null) => void;
  className?: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** "Aug 21, 2026" (as the carrier sends it) -> "21 Aug". Falls back to the raw text. */
const shortDate = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function describe(r: DeliveryQuote, variant: "cart" | "product"): string {
  if (r.unverified) return "Delivery available — charges shown at checkout.";

  const parts: string[] = [];
  const where = [r.city, r.state].filter(Boolean).join(", ");
  parts.push(where ? `Delivers to ${where}` : "Delivery available");

  const by = shortDate(r.eta?.date);
  if (by) parts.push(`by ${by}`);
  else if (r.eta?.days) parts.push(`in ${r.eta.days} day${r.eta.days > 1 ? "s" : ""}`);

  if (variant === "cart" && r.delivery) {
    parts.push(r.delivery.free ? "FREE delivery" : `delivery ${inr(r.delivery.charge)}`);
  }
  if (r.cod) parts.push("COD available");

  return `${parts.join(" · ")}.`;
}

/**
 * Delivery-availability check for a pincode, shared by the product page and the cart.
 * Remembers the last checked pincode (see lib/pincode) and re-checks it on mount so a
 * returning shopper sees their answer without retyping.
 */
export default function PincodeCheck({ variant, items, onResult, className = "" }: PincodeCheckProps) {
  const [pin, setPin] = useState(() => {
    const s = getSavedPincode();
    return s === "248011" ? "" : s;
  });
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Signature of what the current result was computed from, so a cart edit re-checks.
  const itemsKey = (items ?? []).map((i) => `${i.productId}:${i.weight ?? ""}:${i.qty}`).join(",");

  const check = useCallback(
    async (pincode: string) => {
      if (!isValidPincode(pincode)) {
        setStatus("no");
        setMessage("Enter a valid 6-digit pincode.");
        onResult?.(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("checking");
      setMessage("Checking delivery…");
      try {
        const result = await getDeliveryQuote(
          { pincode, items: items && items.length ? items : undefined },
          controller.signal
        );
        if (controller.signal.aborted) return;

        if (result.serviceable) {
          savePincode(pincode);
          setStatus("ok");
          setMessage(describe(result, variant));
          onResult?.(result);
        } else {
          setStatus("no");
          setMessage(`Sorry, we don’t deliver to ${pincode} yet.`);
          onResult?.(result);
        }
      } catch {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage("Couldn’t check right now. Please try again.");
        onResult?.(null);
      }
    },
    // `itemsKey` (not `items`) keeps this stable across renders that rebuild the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey, variant, onResult]
  );

  // Re-check the remembered pincode on mount, and again whenever the cart changes so
  // the quoted charge never lags behind the lines it was computed for.
  useEffect(() => {
    const saved = getSavedPincode();
    if (saved && saved !== "248011") check(saved);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    check(pin);
  };

  const tone =
    status === "no"
      ? "text-red-500"
      : status === "ok"
      ? "text-green-600"
      : status === "error"
      ? "text-amber-600"
      : "text-gray-400";

  return (
    <form onSubmit={onSubmit} className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      <p className="mb-2 text-sm font-medium text-gray-800">Check delivery availability</p>
      <div className="flex gap-2">
        <input
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            if (status !== "idle") {
              setStatus("idle");
              setMessage("");
              onResult?.(null);
            }
          }}
          inputMode="numeric"
          aria-label="Delivery pincode"
          placeholder="Enter delivery pincode"
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={status === "checking"}
          className="rounded-lg bg-gray-900 px-5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {status === "checking" ? "…" : "Check"}
        </button>
      </div>
      {message && (
        <p aria-live="polite" className={`mt-2 text-xs ${tone}`}>
          {message}
        </p>
      )}
    </form>
  );
}
