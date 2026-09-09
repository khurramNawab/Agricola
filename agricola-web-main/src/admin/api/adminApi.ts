// Admin API surface — auth (phone + password + OTP), dashboard stats, and user
// management. Maps the backend's raw documents onto the shapes the admin UI uses.

import {
  apiData,
  apiFetch,
  apiUpload,
  getToken,
  BASE_URL,
  type ApiPagination,
} from "../../lib/api";

// ----- Types ---------------------------------------------------------------

export interface AdminProfile {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  enableMultiWarehouse?: boolean;
}

export type UserStatus = "active" | "banned" | "inactive";

export interface AdminUser {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string;
  joinDate: string; // ISO date (createdAt)
  orders: number;
  status: UserStatus;
}

export interface UsersPage {
  users: AdminUser[];
  pagination: ApiPagination;
}

// Raw user doc as returned by the backend (sensitive fields stripped server-side).
interface RawUser {
  _id: string;
  userId: string;
  name?: string;
  email?: string | null;
  phone: string;
  createdAt: string;
  orders?: number;
  status: UserStatus;
}

function mapUser(u: RawUser): AdminUser {
  return {
    id: u._id,
    userId: u.userId,
    name: u.name || "—",
    email: u.email || null,
    phone: u.phone,
    joinDate: u.createdAt,
    orders: u.orders ?? 0,
    status: u.status,
  };
}

// ----- Auth ----------------------------------------------------------------

/**
 * Single-step admin login: post a Firebase phone-auth ID token (proves phone
 * ownership) + the admin password. The backend verifies both and returns an
 * admin session token + profile.
 */
export async function adminFirebaseLogin(
  idToken: string,
  password: string
): Promise<{ token: string; user: AdminProfile }> {
  return apiData<{ token: string; user: AdminProfile }>(
    "/admin/auth/firebase-login",
    { method: "POST", auth: false, body: { idToken, password } }
  );
}

export async function adminLogout(): Promise<void> {
  await apiFetch("/admin/auth/logout", { method: "POST" }).catch(() => {
    // Token is stateless; ignore logout transport errors.
  });
}

// ----- Dashboard -----------------------------------------------------------

export async function getDashboardStats(
  signal?: AbortSignal
): Promise<DashboardStats> {
  return apiData<DashboardStats>("/admin/dashboard/stats", { signal });
}

// ----- Users ---------------------------------------------------------------

export async function getUsers(
  params: { page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal
): Promise<UsersPage> {
  const res = await apiFetch<RawUser[]>("/admin/users", {
    query: {
      page: params.page,
      limit: params.limit,
      search: params.search,
    },
    signal,
  });
  return {
    users: (res.data || []).map(mapUser),
    pagination:
      res.pagination ??
      { page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
  };
}

export async function updateUser(
  id: string,
  data: Partial<Pick<AdminUser, "name" | "email" | "phone"> & { status: UserStatus }>
): Promise<void> {
  await apiFetch(`/admin/users/${id}`, { method: "PUT", body: data });
}

export async function banUser(id: string): Promise<void> {
  await apiFetch(`/admin/users/${id}/ban`, { method: "POST" });
}

export async function unbanUser(id: string): Promise<void> {
  await apiFetch(`/admin/users/${id}/unban`, { method: "POST" });
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
}

// ----- Image upload (S3) ---------------------------------------------------

export interface UploadedImage {
  url: string;
  key: string;
}

/** Upload one or more images; returns the stored { url, key } for each. */
export async function uploadImages(
  files: File[],
  folder = "uploads"
): Promise<UploadedImage[]> {
  const res = await apiUpload<UploadedImage | UploadedImage[]>(
    "/admin/upload",
    files,
    { field: "files", query: { folder } }
  );
  const data = res.files ?? res.data;
  return Array.isArray(data) ? data : data ? [data as UploadedImage] : [];
}

// ----- Products ------------------------------------------------------------

export type ProductStatus = "In Stock" | "Out of Stock" | "Limited Stock";

/** An image as stored on the backend: public URL + its S3 object key. */
export interface ProductImage {
  url: string;
  publicId?: string | null;
}

export interface AdminProduct {
  id: string;
  productId: string;
  name: string;
  category: string | null;
  categoryId: string | null;
  sellingPrice: number;
  originalPrice: number | null;
  stock: number;
  status: ProductStatus;
  sizes: string[];
  images: ProductImage[];
  featured: boolean;
  shortDescription: string;
  about: string;
  usageInstructions: string;
  whyChoose: string;
  createdAt: string;
  warehouseStock?: {
    warehouseId?: string;
    code?: string;
    name?: string;
    city?: string;
    state?: string;
    stock: number;
  }[];
}

export interface ProductsPage {
  products: AdminProduct[];
  stats: { totalProducts: number; totalCategories: number };
  pagination: ApiPagination;
}

// Payload the AddProductModel builds (maps onto the backend Product fields).
export interface ProductPayload {
  name: string;
  category: string; // category id or name
  originalPrice?: number;
  sellingPrice: number;
  variants?: Record<string, boolean> | string[];
  shortDescription?: string;
  about?: string;
  usageInstructions?: string;
  whyChoose?: string;
  // Strings (new uploads as plain URLs) or full objects (to preserve the S3 key).
  images?: (string | ProductImage)[];
  stock?: number;
  featured?: boolean;
}

export async function getProducts(
  params: { page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal
): Promise<ProductsPage> {
  const res = await apiFetch<AdminProduct[]>("/admin/products", {
    query: { page: params.page, limit: params.limit, search: params.search },
    signal,
  });
  return {
    products: res.data || [],
    stats: (res.stats as ProductsPage["stats"]) ?? {
      totalProducts: 0,
      totalCategories: 0,
    },
    pagination:
      res.pagination ??
      { page: 1, limit: 20, total: 0, totalPages: 1 },
  };
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<AdminProduct> {
  return apiData<AdminProduct>(`/admin/products/${id}`, { signal });
}

export async function createProduct(payload: ProductPayload): Promise<AdminProduct> {
  return apiData<AdminProduct>("/admin/products", { method: "POST", body: payload });
}

export async function updateProduct(
  id: string,
  payload: Partial<ProductPayload>
): Promise<AdminProduct> {
  return apiData<AdminProduct>(`/admin/products/${id}`, { method: "PUT", body: payload });
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch(`/admin/products/${id}`, { method: "DELETE" });
}

// ----- Categories ----------------------------------------------------------

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount?: number;
  status: "active" | "inactive";
}

export interface CategoryPayload {
  name: string;
  image?: string;
  products?: string[]; // product ids or productIds (P001)
}

/** Category detail includes the products currently assigned to it. */
export interface AdminCategoryDetail extends AdminCategory {
  products: { id: string; productId: string; name: string }[];
}

export async function getCategories(signal?: AbortSignal): Promise<AdminCategory[]> {
  return apiData<AdminCategory[]>("/admin/categories", { signal });
}

export async function getCategory(
  id: string,
  signal?: AbortSignal
): Promise<AdminCategoryDetail> {
  return apiData<AdminCategoryDetail>(`/admin/categories/${id}`, { signal });
}

export async function createCategory(payload: CategoryPayload): Promise<AdminCategory> {
  return apiData<AdminCategory>("/admin/categories", { method: "POST", body: payload });
}

export async function updateCategory(
  id: string,
  payload: Partial<CategoryPayload>
): Promise<AdminCategory> {
  return apiData<AdminCategory>(`/admin/categories/${id}`, { method: "PUT", body: payload });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch(`/admin/categories/${id}`, { method: "DELETE" });
}

// ----- Payments (derived from Orders) --------------------------------------

export type PaymentStatusLabel =
  | "Success"
  | "Failed"
  | "Pending"
  | "Refunded"
  | "Partially Refunded";

export interface AdminPayment {
  id: string; // order id
  transactionId: string | null;
  orderId: string;
  name: string;
  email: string | null;
  method: string;
  status: PaymentStatusLabel;
  amount: number;
  date: string; // ISO
}

export interface PaymentStats {
  totalTransactions: number;
  successful: number;
  failed: number;
  pending: number;
  revenue: number;
}

export interface PaymentsPage {
  payments: AdminPayment[];
  stats: PaymentStats;
  pagination: ApiPagination;
}

export interface PaymentDetail extends AdminPayment {
  paymentMethodRaw: string;
  statusRaw: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  refundId: string | null;
  refundAmount: number | null;
  failureReason: string | null;
  pricing: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
  } | null;
  items: { name: string; weight?: string; price: number; quantity: number; subtotal: number }[];
  customer: { name: string; email: string | null; phone: string; userId: string } | null;
  createdAt: string;
  paymentDate: string | null;
}

export async function getPayments(
  params: { page?: number; limit?: number; search?: string; status?: string } = {},
  signal?: AbortSignal
): Promise<PaymentsPage> {
  const res = await apiFetch<AdminPayment[]>("/admin/payments", {
    query: {
      page: params.page,
      limit: params.limit,
      search: params.search,
      status: params.status,
    },
    signal,
  });
  return {
    payments: res.data || [],
    stats:
      (res.stats as PaymentStats) ?? {
        totalTransactions: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        revenue: 0,
      },
    pagination: res.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 },
  };
}

export async function getPayment(id: string, signal?: AbortSignal): Promise<PaymentDetail> {
  return apiData<PaymentDetail>(`/admin/payments/${id}`, { signal });
}

// ----- Orders / Shipment ---------------------------------------------------

export type OrderStatusRaw =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export const ORDER_STATUS_VALUES: OrderStatusRaw[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export interface AdminOrder {
  id: string;
  orderId: string;
  customer: string;
  email: string | null;
  items: number;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string; // capitalized label
  date: string; // ISO
}

export interface OrderStats {
  totalOrders: number;
  delivered: number;
  shipped: number;
  pendingDispatch: number;
  cancelledReturned: number;
}

export interface OrdersPage {
  orders: AdminOrder[];
  stats: OrderStats;
  pagination: ApiPagination;
}

export interface OrderDetail extends Omit<AdminOrder, "customer" | "items"> {
  statusRaw: OrderStatusRaw;
  paymentStatusRaw: string;
  items: {
    name: string;
    weight?: string;
    price: number;
    quantity: number;
    subtotal: number;
    image: string | null;
  }[];
  pricing: { subtotal: number; shipping: number; tax: number; discount: number; total: number } | null;
  customer: { name: string; email: string | null; phone: string; userId: string } | null;
  shippingAddress: {
    name?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  } | null;
  shipping: {
    method: string | null;
    /** The courier carrying the parcel, e.g. "Xpressbees Surface". */
    carrier: string | null;
    trackingNumber: string | null;
    /** Logistics provider that booked it: "shiprocket" | "ekart". */
    provider: string | null;
    courierName: string | null;
    providerShipmentId: string | null;
    /** Courier AWB label PDF (Shiprocket) — the label couriers require at pickup. */
    labelUrl: string | null;
    trackingUrl: string | null;
    /** Legacy field for orders booked with Ekart before the provider switch. */
    ekartShipmentId: string | null;
    estimatedDelivery: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  timeline: { status: string; message?: string; timestamp: string }[];
  createdAt: string;
}

export async function getOrders(
  params: { page?: number; limit?: number; search?: string; status?: string } = {},
  signal?: AbortSignal
): Promise<OrdersPage> {
  const res = await apiFetch<AdminOrder[]>("/admin/orders", {
    query: {
      page: params.page,
      limit: params.limit,
      search: params.search,
      status: params.status,
    },
    signal,
  });
  return {
    orders: res.data || [],
    stats:
      (res.stats as OrderStats) ?? {
        totalOrders: 0,
        delivered: 0,
        shipped: 0,
        pendingDispatch: 0,
        cancelledReturned: 0,
      },
    pagination: res.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 },
  };
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<OrderDetail> {
  return apiData<OrderDetail>(`/admin/orders/${id}`, { signal });
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatusRaw,
  note?: string
): Promise<AdminOrder> {
  return apiData<AdminOrder>(`/admin/orders/${id}/status`, {
    method: "PUT",
    body: { status, ...(note ? { note } : {}) },
  });
}

// Fetch a PDF (admin-auth) and trigger a browser download.
async function downloadPdf(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) throw new Error("Failed to generate PDF.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download the order invoice PDF — A4 by default, or "4x6" for thermal printers. */
export async function downloadInvoice(id: string, orderId: string, size?: "4x6"): Promise<void> {
  const q = size === "4x6" ? "?size=4x6" : "";
  await downloadPdf(`/admin/orders/${id}/invoice${q}`, `invoice-${orderId}${size === "4x6" ? "-4x6" : ""}.pdf`);
}

// Fetch the 4×6 thermal shipping/address label PDF.
export async function downloadLabel(id: string, orderId: string): Promise<void> {
  await downloadPdf(`/admin/orders/${id}/label`, `label-${orderId}.pdf`);
}

// ----- Warehouses -----------------------------------------------------------

export interface AdminWarehouse {
  id: string;
  code: string;
  name: string;
  shiprocketPickupNickname?: string;
  ekartPickupAlias?: string;
  ekartGstin?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  spocName?: string;
  spocPhone?: string;
  isDefault: boolean;
  status: "active" | "inactive";
  createdAt?: string;
}

export interface WarehousePayload {
  code?: string;
  name: string;
  shiprocketPickupNickname?: string;
  ekartPickupAlias?: string;
  ekartGstin?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  spocName?: string;
  spocPhone?: string;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

export interface SyncPreviewItem {
  shiprocketNickname: string;
  label: string; // Format: "nickname (city, state, pincode)"
  code?: string;
  name?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  spocName?: string;
  spocPhone?: string;
  status?: "active" | "inactive";
  matchedWarehouseId?: string | null;
  changeType: "new" | "update" | "unchanged" | "conflict";
  hasConflict: boolean;
  conflictMessage?: string;
}

export interface ShiprocketSyncPreview {
  items: SyncPreviewItem[];
  totalCount: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  conflictCount: number;
}

export async function getWarehouses(signal?: AbortSignal): Promise<AdminWarehouse[]> {
  return apiData<AdminWarehouse[]>("/admin/warehouses", { signal });
}

export async function getShiprocketSyncPreview(signal?: AbortSignal): Promise<ShiprocketSyncPreview> {
  return apiData<ShiprocketSyncPreview>("/admin/warehouses/sync-preview", { signal });
}

export async function applyShiprocketSync(items: SyncPreviewItem[]): Promise<AdminWarehouse[]> {
  return apiData<AdminWarehouse[]>("/admin/warehouses/sync-apply", { method: "POST", body: { items } });
}

export async function createWarehouse(payload: WarehousePayload): Promise<AdminWarehouse> {
  return apiData<AdminWarehouse>("/admin/warehouses", { method: "POST", body: payload });
}

export async function updateWarehouse(
  id: string,
  payload: Partial<WarehousePayload>
): Promise<AdminWarehouse> {
  return apiData<AdminWarehouse>(`/admin/warehouses/${id}`, { method: "PUT", body: payload });
}

export async function toggleWarehouseStatus(
  id: string,
  status: "active" | "inactive"
): Promise<AdminWarehouse> {
  return apiData<AdminWarehouse>(`/admin/warehouses/${id}/status`, { method: "PATCH", body: { status } });
}

// ----- Product Warehouse Stock ----------------------------------------------

export interface WarehouseStockEntry {
  warehouseId: string;
  code?: string;
  name?: string;
  stock: number;
}

export async function updateProductWarehouseStock(
  productId: string,
  warehouseStock: { warehouseId: string; stock: number }[]
): Promise<{ id: string; productId: string; stock: number; warehouseStock: WarehouseStockEntry[] }> {
  return apiData<{ id: string; productId: string; stock: number; warehouseStock: WarehouseStockEntry[] }>(
    `/admin/products/${productId}/warehouse-stock`,
    { method: "PUT", body: { warehouseStock } }
  );
}

// ----- Order Warehouse Assignment ------------------------------------------

export interface WarehouseItemAvailability {
  productId: string;
  name: string;
  required: number;
  available: number;
  sufficient: boolean;
}

export interface WarehouseOptionAvailability {
  id: string;
  code: string;
  name: string;
  shiprocketPickupNickname?: string;
  ekartPickupAlias?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault: boolean;
  canFulfill: boolean;
  itemsAvailability: WarehouseItemAvailability[];
}

export interface OrderWarehouseAvailability {
  orderId: string;
  awaitingWarehouseAssignment: boolean;
  assignedWarehouseId: string | null;
  warehouses: WarehouseOptionAvailability[];
}

export async function getOrderWarehouseAvailability(
  orderId: string,
  signal?: AbortSignal
): Promise<OrderWarehouseAvailability> {
  return apiData<OrderWarehouseAvailability>(`/admin/orders/${orderId}/warehouse-availability`, { signal });
}

export async function assignOrderWarehouse(
  orderId: string,
  warehouseId: string,
  shippingProvider?: "shiprocket" | "ekart"
): Promise<AdminOrder> {
  return apiData<AdminOrder>(`/admin/orders/${orderId}/assign-warehouse`, {
    method: "PUT",
    body: {
      warehouseId,
      ...(shippingProvider ? { shippingProvider } : {}),
    },
  });
}


