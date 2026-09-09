// Storefront cart API. Every route requires the customer token (the backend
// guards all /cart endpoints with `authenticate`), so these always send the
// customer session token via the `token` override.

import { apiData } from "./api";
import { getCustomerToken } from "./storefrontAuth";

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  weight: string | null;
  price: number;
  qty: number;
  image: string | null;
  inStock: boolean;
  lineTotal: number;
}

export interface CartData {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export const EMPTY_CART: CartData = { items: [], subtotal: 0, itemCount: 0 };

// Spreads the customer token into request options. `null` means "no session" —
// the backend will reply 401, which callers treat as "log in first".
const authOpts = () => ({ token: getCustomerToken() });

export async function getCart(signal?: AbortSignal): Promise<CartData> {
  return apiData<CartData>("/cart", { ...authOpts(), signal });
}

export async function addToCart(
  productId: string,
  weight: string | null,
  qty = 1
): Promise<CartData> {
  return apiData<CartData>("/cart/items", {
    method: "POST",
    ...authOpts(),
    body: { productId, weight, qty },
  });
}

export async function updateCartItem(id: string, qty: number): Promise<CartData> {
  return apiData<CartData>(`/cart/items/${id}`, {
    method: "PATCH",
    ...authOpts(),
    body: { qty },
  });
}

export async function removeCartItem(id: string): Promise<CartData> {
  return apiData<CartData>(`/cart/items/${id}`, {
    method: "DELETE",
    ...authOpts(),
  });
}

export async function clearCart(): Promise<CartData> {
  return apiData<CartData>("/cart", { method: "DELETE", ...authOpts() });
}
