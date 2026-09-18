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
  variantStocks?: { size: string; stock: number; price?: number }[];
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

/**
 * Instant credential bypass for admin access (demo / testing).
 */
export async function adminBypassLogin(): Promise<{ token: string; user: AdminProfile }> {
  return apiData<{ token: string; user: AdminProfile }>(
    "/admin/auth/bypass-login",
    { method: "POST", auth: false }
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
  video?: { url: string; publicId?: string | null } | null;
  videoUrl?: string | null;
  featured: boolean;
  /** Whether this product is organic — defaults to true for existing products */
  isOrganic: boolean;
  shortDescription: string;
  about: string;
  usageInstructions: string;
  whyChoose: string;
  createdAt: string;
  variantStocks?: {
    size: string;
    stock: number;
    price?: number;
  }[];
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
  variantStocks?: { size: string; stock: number; price?: number }[];
  shortDescription?: string;
  about?: string;
  usageInstructions?: string;
  whyChoose?: string;
  // Strings (new uploads as plain URLs) or full objects (to preserve the S3 key).
  images?: (string | ProductImage)[];
  video?: { url: string; publicId?: string } | string;
  videoUrl?: string;
  stock?: number;
  featured?: boolean;
  /** Whether the product is organic. Omitting falls back to schema default (true). */
  isOrganic?: boolean;
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
  pricing: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    shippingWaived?: boolean;
    originalShipping?: number;
  } | null;
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

/** Download a sample preview GST tax invoice PDF. */
export async function downloadSampleInvoice(size?: "4x6"): Promise<void> {
  const q = size === "4x6" ? "?size=4x6" : "";
  await downloadPdf(`/admin/orders/sample-invoice${q}`, `sample-tax-invoice${size === "4x6" ? "-4x6" : ""}.pdf`);
}

/** Email a sample preview GST tax invoice PDF to specified address. */
export async function emailSampleInvoice(email: string): Promise<{ success: boolean; message: string }> {
  return apiData<{ success: boolean; message: string }>("/admin/orders/sample-invoice/email", {
    method: "POST",
    body: { email },
  });
}

/** Email official GST tax invoice PDF to customer. */
export async function emailAdminOrderInvoice(id: string, email?: string): Promise<{ success: boolean; message: string }> {
  return apiData<{ success: boolean; message: string }>(`/admin/orders/${id}/email-invoice`, {
    method: "POST",
    body: email ? { email } : undefined,
  });
}

/** Toggle or set delivery charge waiver on an order. */
export async function toggleOrderShippingWaiver(id: string, waive?: boolean): Promise<{ orderId: string; pricing: any }> {
  return apiData<{ orderId: string; pricing: any }>(`/admin/orders/${id}/shipping-waiver`, {
    method: "PATCH",
    body: waive !== undefined ? { waive } : {},
  });
}

// Fetch the 4×6 thermal shipping/address label PDF.
export async function downloadLabel(id: string, orderId: string): Promise<void> {
  await downloadPdf(`/admin/orders/${id}/label`, `label-${orderId}.pdf`);
}

/** Clone/duplicate an existing order. */
export async function cloneAdminOrder(id: string, paymentMethod?: string): Promise<AdminOrder> {
  return apiData<AdminOrder>(`/admin/orders/${id}/clone`, {
    method: "POST",
    body: paymentMethod ? { paymentMethod } : undefined,
  });
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
  climateControl?: string;
  sameDayCutoff?: string;
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
  climateControl?: string;
  sameDayCutoff?: string;
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

export interface WarehouseConnectivityDiagnostic {
  warehouseId: string;
  code: string;
  name: string;
  pincode?: string;
  shiprocket: {
    status: 'ready' | 'error' | 'unconfigured' | 'pending';
    configured: boolean;
    latencyMs: number;
    nickname?: string;
    message: string;
  };
  ekart: {
    status: 'ready' | 'error' | 'unconfigured' | 'pending';
    configured: boolean;
    latencyMs: number;
    message: string;
  };
  reach: {
    status: string;
    label: string;
    coverage: string;
  };
  testedAt: string;
}

export async function testWarehouseConnectivity(
  id: string,
  signal?: AbortSignal
): Promise<WarehouseConnectivityDiagnostic> {
  return apiData<WarehouseConnectivityDiagnostic>(
    `/admin/warehouses/${id}/test-connectivity`,
    { signal }
  );
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

// ----- Coupons -------------------------------------------------------------

export interface CouponRedemption {
  id: string;
  user: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  orderId?: string;
  discountAmount: number;
  redeemedAt: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "flat" | "fixed";
  discountValue: number;
  minOrderValue: number;
  maxDiscountCap: number | null;
  validFrom: string;
  validTo: string;
  totalUsageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  isActive: boolean;
  firstOrderOnly: boolean;
  isFestivalOffer?: boolean;
  status: "active" | "expired" | "exhausted" | "inactive" | "upcoming";
  redemptionsCount?: number;
  redemptions?: CouponRedemption[];
  createdAt: string;
  updatedAt: string;
}

export interface CouponsPage {
  coupons: AdminCoupon[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export interface CouponPayload {
  code: string;
  description?: string;
  discountType: "percentage" | "flat" | "fixed";
  discountValue: number;
  minOrderValue?: number;
  maxDiscountCap?: number | null;
  validFrom?: string;
  validTo: string;
  totalUsageLimit?: number | null;
  perUserLimit?: number;
  isActive?: boolean;
  firstOrderOnly?: boolean;
  isFestivalOffer?: boolean;
}

export async function getAdminCoupons(
  params?: { page?: number; limit?: number; search?: string; status?: string },
  signal?: AbortSignal
): Promise<CouponsPage> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);

  const qs = q.toString();
  return apiData<CouponsPage>(`/admin/coupons${qs ? `?${qs}` : ""}`, { signal });
}

export async function getAdminCoupon(id: string, signal?: AbortSignal): Promise<AdminCoupon> {
  return apiData<AdminCoupon>(`/admin/coupons/${id}`, { signal });
}

export async function createAdminCoupon(payload: CouponPayload): Promise<AdminCoupon> {
  return apiData<AdminCoupon>("/admin/coupons", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminCoupon(id: string, payload: Partial<CouponPayload>): Promise<AdminCoupon> {
  return apiData<AdminCoupon>(`/admin/coupons/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export interface DeleteCouponResponse {
  success: boolean;
  deactivated?: boolean;
  deleted?: boolean;
  message: string;
  data?: any;
}

export async function deleteAdminCoupon(id: string): Promise<DeleteCouponResponse> {
  const env = await apiFetch<any>(`/admin/coupons/${id}`, {
    method: "DELETE",
  });
  return (env.data || env) as DeleteCouponResponse;
}

export async function toggleAdminCoupon(id: string): Promise<{ id: string; isActive: boolean }> {
  return apiData<{ id: string; isActive: boolean }>(`/admin/coupons/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function suggestCouponCode(): Promise<{ code: string }> {
  return apiData<{ code: string }>("/admin/coupons/suggest-code");
}

// ----- Abandoned Carts -----------------------------------------------------

export interface AbandonedCartItem {
  id: string;
  productId: string;
  name: string;
  weight?: string | null;
  price: number;
  qty: number;
  subtotal: number;
  image: string;
}

export interface AbandonedCartUser {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  userId?: string;
}

export interface AbandonedCart {
  id: string;
  user: AbandonedCartUser;
  items: AbandonedCartItem[];
  itemCount: number;
  cartTotal: number;
  updatedAt: string;
  hoursInactive: number;
  lastReminderSentAt?: string | null;
  reminderCount: number;
}

export interface AbandonedCartsPage {
  carts: AbandonedCart[];
  summary: {
    totalAbandoned: number;
    totalValue: number;
    hoursThreshold: number;
  };
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export interface SendAbandonedMessagePayload {
  cartIds: string[];
  channel: "email" | "sms" | "whatsapp" | "all";
  templateId?: string;
  customMessage?: string;
  couponCode?: string;
  subject?: string;
}

export interface AbandonedCartLogItem {
  _id: string;
  user: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  channel: string;
  subject?: string;
  messageContent: string;
  couponCode?: string;
  cartValue: number;
  itemNames: string[];
  status: string;
  errorDetails?: string;
  sentAt: string;
}

export interface AbandonedLogsPage {
  logs: AbandonedCartLogItem[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export async function getAbandonedCarts(
  params?: { hours?: number; page?: number; limit?: number; search?: string },
  signal?: AbortSignal
): Promise<AbandonedCartsPage> {
  const q = new URLSearchParams();
  if (params?.hours) q.set("hours", String(params.hours));
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);

  const qs = q.toString();
  return apiData<AbandonedCartsPage>(`/admin/abandoned-carts${qs ? `?${qs}` : ""}`, { signal });
}

export async function sendAbandonedCartMessage(
  payload: SendAbandonedMessagePayload
): Promise<{
  total: number;
  sentEmails: number;
  sentSms: number;
  whatsappLinks: Array<{ cartId: string; userName: string; phone: string; link: string; message: string }>;
  failed: number;
}> {
  return apiData("/admin/abandoned-carts/send-message", {
    method: "POST",
    body: payload,
  });
}

export async function getAbandonedCartLogs(
  params?: { page?: number; limit?: number; channel?: string },
  signal?: AbortSignal
): Promise<AbandonedLogsPage> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.channel && params.channel !== "all") q.set("channel", params.channel);

  const qs = q.toString();
  return apiData<AbandonedLogsPage>(`/admin/abandoned-carts/logs${qs ? `?${qs}` : ""}`, { signal });
}

// ----- Festival Hero Campaigns & Video Module ------------------------------

export interface HeroSlide {
  id?: string;
  image: string;
  title: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  order: number;
}

export interface VideoModuleConfig {
  isEnabled: boolean;
  title?: string;
  subtitle?: string;
  videoType: "upload" | "url" | "youtube";
  videoUrl?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  position?: "hero_banner" | "standalone_section";
}

export interface AdminHeroCampaign {
  id: string;
  name: string;
  festivalType: string;
  slidesCount: number;
  slides: HeroSlide[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  priority: number;
  status: "active" | "upcoming" | "ended" | "inactive";
  couponCode?: string;
  videoModule?: VideoModuleConfig;
  hasOverlap?: boolean;
  overlappingCampaigns?: Array<{ id: string; name: string; festivalType: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface HeroCampaignsPage {
  campaigns: AdminHeroCampaign[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export interface HeroCampaignPayload {
  name: string;
  festivalType?: string;
  startDate: string;
  endDate: string;
  slides: HeroSlide[];
  isActive?: boolean;
  priority?: number;
  videoModule?: VideoModuleConfig;
}

export async function getAdminCampaigns(
  params?: { page?: number; limit?: number; search?: string; status?: string },
  signal?: AbortSignal
): Promise<HeroCampaignsPage> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);

  const qs = q.toString();
  return apiData<HeroCampaignsPage>(`/admin/campaigns${qs ? `?${qs}` : ""}`, { signal });
}

export async function getAdminCampaign(id: string, signal?: AbortSignal): Promise<AdminHeroCampaign> {
  return apiData<AdminHeroCampaign>(`/admin/campaigns/${id}`, { signal });
}

export async function createAdminCampaign(
  payload: HeroCampaignPayload
): Promise<{ campaign: AdminHeroCampaign; warning?: string }> {
  return apiData("/admin/campaigns", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminCampaign(
  id: string,
  payload: Partial<HeroCampaignPayload>
): Promise<AdminHeroCampaign> {
  return apiData<AdminHeroCampaign>(`/admin/campaigns/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function toggleAdminCampaign(
  id: string
): Promise<{ id: string; isActive: boolean }> {
  return apiData<{ id: string; isActive: boolean }>(`/admin/campaigns/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function deleteAdminCampaign(id: string): Promise<void> {
  await apiData<{ success: boolean }>(`/admin/campaigns/${id}`, {
    method: "DELETE",
  });
}

// ----- Support & Customer Inquiries -----------------------------------------

export interface AdminFeedback {
  _id: string;
  user?: { _id: string; name: string; email: string; phone: string } | null;
  name: string;
  email: string;
  rating?: number;
  message: string;
  page?: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
}

export interface FeedbacksPage {
  feedbacks: AdminFeedback[];
  stats: {
    total: number;
    open: number;
    resolved: number;
  };
  pagination: ApiPagination;
}

export async function getAdminFeedbacks(
  params?: { page?: number; limit?: number; search?: string; status?: string; rating?: string },
  signal?: AbortSignal
): Promise<FeedbacksPage> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.rating && params.rating !== "all") q.set("rating", params.rating);

  const qs = q.toString();
  return apiData<FeedbacksPage>(`/admin/support/feedbacks${qs ? `?${qs}` : ""}`, { signal });
}

export async function toggleFeedbackStatus(id: string, status?: string): Promise<AdminFeedback> {
  return apiData<AdminFeedback>(`/admin/support/feedbacks/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function replyToFeedback(id: string, message: string): Promise<AdminFeedback> {
  return apiData<AdminFeedback>(`/admin/support/feedbacks/${id}/reply`, {
    method: "POST",
    body: { message },
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  await apiData<{ success: boolean }>(`/admin/support/feedbacks/${id}`, {
    method: "DELETE",
  });
}

export interface LaunchSubscriberItem {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  category: 'utensils' | 'gardening' | 'both';
  preferredChannel: 'email' | 'whatsapp' | 'sms';
  interestTags: string[];
  source?: string;
  createdAt: string;
}

export interface LaunchSubscribersPage {
  subscribers: LaunchSubscriberItem[];
  stats: {
    total: number;
    utensilsCount: number;
    gardeningCount: number;
    bothCount: number;
  };
  pagination: ApiPagination;
}

export async function getAdminSubscribers(
  params?: { page?: number; limit?: number; search?: string; category?: string },
  signal?: AbortSignal
): Promise<LaunchSubscribersPage> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.search) q.set("search", params.search);
  if (params?.category && params.category !== "all") q.set("category", params.category);

  const qs = q.toString();
  return apiData<LaunchSubscribersPage>(`/admin/subscribers${qs ? `?${qs}` : ""}`, { signal });
}

export async function deleteAdminSubscriber(id: string): Promise<void> {
  await apiData<{ success: boolean }>(`/admin/subscribers/${id}`, {
    method: "DELETE",
  });
}

// ----- Store Settings -------------------------------------------------------

export interface AdminStoreSettings {
  _id?: string;
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsApp: string;
  businessHours: string;
  storeAddress: string;
  enableMultiWarehouse: boolean;
  defaultCarrier: 'both' | 'ekart' | 'shiprocket';
  freeShippingThreshold: number;
  standardDeliveryCharge: number;
  enableWhatsAppNotifications: boolean;
  enableEmailNotifications: boolean;
  enableCod: boolean;
  maxCodAmount: number;
  allowCouponStacking?: boolean;
  maxStackedCoupons?: number;
}

export async function getAdminSettings(signal?: AbortSignal): Promise<AdminStoreSettings> {
  return apiData<AdminStoreSettings>("/admin/settings", { signal });
}

export async function updateAdminSettings(payload: Partial<AdminStoreSettings>): Promise<AdminStoreSettings> {
  return apiData<AdminStoreSettings>("/admin/settings", {
    method: "PUT",
    body: payload,
  });
}

// ----- Media & File Storage (Images & Videos) --------------------------------
export interface UploadedMedia {
  url: string;
  key: string;
  isLocal?: boolean;
}

export async function uploadMedia(
  file: File,
  folder = "media"
): Promise<UploadedMedia> {
  const env = await apiUpload<UploadedMedia>("/admin/upload", [file], {
    query: { folder },
  });
  if (!env.data) throw new Error("Upload did not return media data");
  return env.data;
}

export async function deleteMedia(keyOrUrl: string): Promise<void> {
  await apiFetch("/admin/upload", {
    method: "DELETE",
    body: { key: keyOrUrl },
  });
}


// ----- Inventory Management -------------------------------------------------

export interface InventoryAllocation {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  stock: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  images: { url: string; alt?: string }[];
  isActive: boolean;
  allocations: InventoryAllocation[];
  totalWarehouseStock: number;
}

export async function getAdminInventory(signal?: AbortSignal): Promise<InventoryItem[]> {
  return apiData<InventoryItem[]>("/admin/inventory", { signal });
}

export async function updateAdminInventoryStock(
  productId: string,
  stock: number,
  warehouseId?: string
): Promise<{ id: string; name: string; stock: number; isLowStock: boolean; isOutOfStock: boolean }> {
  return apiData<{ id: string; name: string; stock: number; isLowStock: boolean; isOutOfStock: boolean }>(
    `/admin/inventory/${productId}`,
    { method: "PATCH", body: { stock, warehouseId } }
  );
}

// ==========================================
// BLOG TYPES & API
// ==========================================

export interface AdminBlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  author: {
    name: string;
    avatar?: string;
    role?: string;
  };
  category: string;
  tags: string[];
  status: "draft" | "published";
  readTime?: string;
  viewCount: number;
  featured: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    canonicalUrl?: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
}

export interface AdminBlogStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
}

export interface AdminBlogListResponse {
  blogs: AdminBlogPost[];
  stats: AdminBlogStats;
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export async function getAdminBlogs(
  params?: { status?: string; category?: string; search?: string; page?: number; limit?: number },
  signal?: AbortSignal
): Promise<AdminBlogListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const url = `/admin/blogs${qs ? `?${qs}` : ""}`;
  const res = await apiFetch<AdminBlogPost[]>(url, { signal });
  const rawStats = (res as any).stats as AdminBlogStats | undefined;
  const rawPagination = (res as any).pagination;

  return {
    blogs: res.data || [],
    stats: rawStats || { totalPosts: 0, publishedPosts: 0, draftPosts: 0, totalViews: 0 },
    pagination: {
      total: rawPagination?.total || 0,
      page: rawPagination?.page || 1,
      pages: rawPagination?.pages || 1,
      limit: rawPagination?.limit || 20,
    },
  };
}

export async function getAdminBlog(id: string, signal?: AbortSignal): Promise<AdminBlogPost> {
  return apiData<AdminBlogPost>(`/admin/blogs/${id}`, { signal });
}

export async function createAdminBlog(payload: Partial<AdminBlogPost>): Promise<AdminBlogPost> {
  return apiData<AdminBlogPost>("/admin/blogs", {
    method: "POST",
    body: payload
  });
}

export async function updateAdminBlog(id: string, payload: Partial<AdminBlogPost>): Promise<AdminBlogPost> {
  return apiData<AdminBlogPost>(`/admin/blogs/${id}`, {
    method: "PUT",
    body: payload
  });
}

export async function deleteAdminBlog(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch<unknown>(`/admin/blogs/${id}`, {
    method: "DELETE"
  });
  return {
    success: res.success,
    message: res.message || "Blog deleted successfully"
  };
}

export async function toggleAdminBlogPublish(
  id: string
): Promise<{ id: string; status: "draft" | "published"; publishedAt?: string }> {
  return apiData<{ id: string; status: "draft" | "published"; publishedAt?: string }>(
    `/admin/blogs/${id}/publish`,
    { method: "PATCH" }
  );
}

export async function toggleAdminBlogFeatured(id: string): Promise<{ id: string; featured: boolean }> {
  return apiData<{ id: string; featured: boolean }>(`/admin/blogs/${id}/featured`, {
    method: "PATCH"
  });
}

