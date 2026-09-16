// Storefront checkout/order/address API. All order + address routes require the
// customer token (sent via the `token` override). Payment methods are public.

import { apiData, apiFetch, BASE_URL } from "./api";
import { getCustomerToken } from "./storefrontAuth";

export interface Address {
  id: string;
  name: string;
  mobile: string;
  pincode: string;
  state: string;
  house: string;
  address: string;
  locality: string;
  city: string;
  type: "Home" | "Office";
  isDefault: boolean;
}

export interface AddressInput {
  name: string;
  mobile: string;
  pincode: string;
  state: string;
  house?: string;
  address: string;
  locality?: string;
  city: string;
  type?: "Home" | "Office";
}

export interface PaymentMethod {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface OrderItemInput {
  productId: string;
  weight: string | null;
  qty: number;
}

export interface CheckoutSummary {
  subtotal: number;
  discount: number;
  charges: number;
  total: number;
  items: {
    productId: string;
    title: string;
    weight: string | null;
    price: number;
    qty: number;
    image: string;
    subtotal: number;
  }[];
}

export interface PaymentIntent {
  gateway: string; // 'razorpay' | 'cod'
  redirectUrl?: string | null;
  status?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  key?: string;
}

export interface PlacedOrder {
  orderId: string;
  id: string;
  payment: PaymentIntent | null;
  order: {
    orderId: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    pricing: { subtotal: number; discount: number; charges: number; total: number };
  };
  /** Set when the order was created but the gateway couldn't be initiated. */
  warning?: string;
}

const authOpts = () => ({ token: getCustomerToken() });

export async function getAddresses(signal?: AbortSignal): Promise<Address[]> {
  return apiData<Address[]>("/addresses", { ...authOpts(), signal });
}

export async function submitFeedback(input: {
  message: string;
  rating?: number;
  name?: string;
  email?: string;
  page?: string;
}): Promise<void> {
  await apiFetch("/support/feedback", {
    method: "POST",
    ...authOpts(),
    body: input,
  });
}

export interface CustomerProfile {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email: string | null;
}

interface RawProfile {
  _id: string;
  userId?: string;
  name?: string;
  phone: string;
  email?: string | null;
}

const mapProfile = (u: RawProfile): CustomerProfile => ({
  id: u._id,
  userId: u.userId,
  name: u.name || "",
  phone: u.phone,
  email: u.email || null,
});

export async function getProfile(signal?: AbortSignal): Promise<CustomerProfile> {
  return mapProfile(await apiData<RawProfile>("/users/profile", { ...authOpts(), signal }));
}

export async function updateProfile(input: {
  name?: string;
  email?: string;
}): Promise<CustomerProfile> {
  return mapProfile(
    await apiData<RawProfile>("/users/profile", {
      method: "PUT",
      ...authOpts(),
      body: input,
    })
  );
}

export async function createAddress(input: AddressInput): Promise<Address> {
  return apiData<Address>("/addresses", {
    method: "POST",
    ...authOpts(),
    body: input,
  });
}

export async function updateAddress(
  id: string,
  input: AddressInput
): Promise<Address> {
  return apiData<Address>(`/addresses/${id}`, {
    method: "PUT",
    ...authOpts(),
    body: input,
  });
}

export async function deleteAddress(id: string): Promise<void> {
  await apiFetch(`/addresses/${id}`, { method: "DELETE", ...authOpts() });
}

export async function getPaymentMethods(
  signal?: AbortSignal
): Promise<PaymentMethod[]> {
  return apiData<PaymentMethod[]>("/checkout/payment-methods", {
    auth: false,
    signal,
  });
}

export interface CheckoutConfig {
  freeShippingThreshold: number;
  allowCouponStacking?: boolean;
  maxStackedCoupons?: number;
}

export async function getCheckoutConfig(
  signal?: AbortSignal
): Promise<CheckoutConfig> {
  return apiData<CheckoutConfig>("/checkout/config", { auth: false, signal });
}

export interface PincodeServiceability {
  pincode: string;
  serviceable: boolean;
  city?: string | null;
  state?: string | null;
  cod?: boolean;
  provider?: string | null;
  eta?: { date: string | null; days: number | null } | null;
  /** True when the carrier couldn't be reached — treated as serviceable, don't block. */
  unverified?: boolean;
}

export async function checkPincodeServiceability(
  pincode: string,
  signal?: AbortSignal
): Promise<PincodeServiceability> {
  return apiData<PincodeServiceability>(
    `/shipping/serviceability/${encodeURIComponent(pincode)}`,
    { auth: false, signal }
  );
}

export interface DeliveryQuote extends PincodeServiceability {
  /** Carrier that covers this pincode ("shiprocket" | "ekart"), null if none does. */
  provider?: string | null;
  /** Provider's own estimate — `date` as the carrier formatted it. */
  eta?: { date: string | null; days: number | null } | null;
  courierName?: string | null;
  /** Present only when cart items were sent; matches what checkout will charge. */
  delivery?: {
    charge: number;
    free: boolean;
    freeShippingThreshold: number;
  } | null;
}

/**
 * Pre-checkout delivery answer: can we deliver to this pincode, by when, for how much.
 * Public — guests can check before signing in. Pass cart lines to get a real charge.
 */
export async function getDeliveryQuote(
  input: {
    pincode: string;
    /** `weight` is the selected pack size ("200g") — it drives the parcel weight. */
    items?: { productId: string; qty: number; weight?: string | null }[];
  },
  signal?: AbortSignal
): Promise<DeliveryQuote> {
  return apiData<DeliveryQuote>("/shipping/quote", {
    method: "POST",
    auth: false,
    body: { pincode: input.pincode, items: input.items },
    signal,
  });
}

export async function getCheckoutSummary(
  input: { items: OrderItemInput[]; discountCode?: string; shippingAddressId?: string },
  signal?: AbortSignal
): Promise<CheckoutSummary> {
  return apiData<CheckoutSummary>("/checkout/summary", {
    method: "POST",
    ...authOpts(),
    body: input,
    signal,
  });
}

export interface DiscountResult {
  valid: boolean;
  discount: number;
  message?: string;
  code?: string;
}

export async function validateDiscount(
  code: string,
  subtotal: number,
  existingCodes?: string[]
): Promise<DiscountResult> {
  return apiData<DiscountResult>("/checkout/discount", {
    method: "POST",
    ...authOpts(),
    body: { code, subtotal, existingCodes },
  });
}

export async function placeOrder(input: {
  items: OrderItemInput[];
  shippingAddressId: string;
  paymentMethod: string;
  email: string;
  billingAddress?: "same" | Record<string, unknown>;
  discountCode?: string;
}): Promise<PlacedOrder> {
  // Use apiFetch (not apiData) to also read the top-level `warning` field that
  // the backend returns when an order is created but the gateway is unconfigured.
  const env = await apiFetch<Omit<PlacedOrder, "warning">>("/orders", {
    method: "POST",
    ...authOpts(),
    body: {
      items: input.items,
      shippingAddressId: input.shippingAddressId,
      billingAddress: input.billingAddress ?? "same",
      paymentMethod: input.paymentMethod,
      email: input.email,
      discountCode: input.discountCode,
    },
  });
  return {
    ...(env.data as Omit<PlacedOrder, "warning">),
    warning: typeof env.warning === "string" ? env.warning : undefined,
  };
}

/** Discard an unpaid pending order (customer cancelled the payment). Best-effort. */
export async function abandonOrder(id: string): Promise<void> {
  await apiFetch(`/orders/${id}`, { method: "DELETE", ...authOpts() });
}

export interface OrderDetail {
  id: string;
  orderId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  pricing: { subtotal: number; discount: number; charges: number; total: number };
  items: {
    productId: string | null;
    title: string;
    weight: string | null;
    price: number;
    qty: number;
    image: string;
    subtotal: number;
  }[];
  address: {
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  } | null;
  shipping?: {
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    estimatedDelivery: string | null;
  } | null;
  timeline: { status: string; message: string; at: string }[];
  createdAt: string;
}

export async function getOrder(
  id: string,
  signal?: AbortSignal
): Promise<OrderDetail> {
  return apiData<OrderDetail>(`/orders/${id}`, { ...authOpts(), signal });
}

export async function getMyOrders(
  params?: { page?: number; limit?: number; status?: string },
  signal?: AbortSignal
): Promise<{ orders: OrderDetail[]; pagination?: { current: number; pages: number; total: number; limit: number } }> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.limit) query.limit = params.limit;
  if (params?.status) query.status = params.status;
  const res = await apiFetch<OrderDetail[]>("/orders/my-orders", {
    ...authOpts(),
    query,
    signal,
  });
  return {
    orders: res.data || [],
    pagination: res.pagination as any,
  };
}

/** Download authentic GST tax invoice PDF for an order (identical to admin invoice). */
export async function downloadOrderInvoice(id: string, orderId: string): Promise<void> {
  const token = getCustomerToken();
  const res = await fetch(`${BASE_URL}/orders/${id}/invoice`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Failed to download invoice (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${orderId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Guest order tracking: orderId + the mobile on the order's shipping address.
// Public endpoint (no login) — returns status, timeline, items, and address.
export type TrackedOrder = Pick<
  OrderDetail,
  "orderId" | "status" | "shipping" | "timeline" | "items" | "address"
>;

export async function trackOrder(
  orderId: string,
  mobile: string
): Promise<TrackedOrder> {
  return apiData<TrackedOrder>("/orders/track", {
    method: "POST",
    auth: false,
    body: { orderId: orderId.trim(), mobile: mobile.trim() },
  });
}

export async function verifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<unknown> {
  return apiData("/payments/verify", {
    method: "POST",
    ...authOpts(),
    body: payload,
  });
}

// Razorpay Checkout is loaded on demand so the script isn't shipped to visitors
// who never reach checkout. Resolves false if the script can't be loaded.
export function loadRazorpayCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}
