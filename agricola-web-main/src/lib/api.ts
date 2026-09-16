// Core API client for the agri-backend.
//
// Wraps fetch with: base URL from env, Bearer-token auth, JSON encoding, and the
// backend's standard `{ success, data?, error?, pagination? }` envelope. All
// failures (network, non-2xx, envelope errors) surface as a typed `ApiError`.

export const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"
).replace(/\/$/, "");

const TOKEN_KEY = "admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Broadcast when an *authenticated* request (one that carried a token) comes back
// 401 — i.e. the session is expired/invalid — so the app can log the user out.
// `detail.scope` is "admin" or "customer". Requests with no token don't fire this.
export const SESSION_EXPIRED_EVENT = "agri:session-expired";

function notifySessionExpired(scope: "admin" | "customer"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { scope } })
  );
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// Some endpoints (e.g. admin products) return extra top-level keys like `stats`.
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: ApiPagination;
  error?: { code: string; message: string; details?: unknown };
  [key: string]: unknown;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  retryAfter?: number;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: unknown,
    retryAfter?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Send the auth token (default true). Set false for public endpoints. */
  auth?: boolean;
  /**
   * Override the bearer token (e.g. the storefront customer token). When set,
   * this token is used instead of the stored admin token, and a 401 will NOT
   * clear the admin session. Pass `null` for "authed request, no token yet".
   */
  token?: string | null;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(
  path: string,
  query?: RequestOptions["query"]
): string {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Make a request and return the full envelope (so callers can read `pagination`
 * or other top-level keys). Throws `ApiError` on any failure. On 401 the token
 * is cleared so guards can redirect to login.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiEnvelope<T>> {
  const { method = "GET", body, auth = true, query, signal, token } = options;

  // When the caller passes an explicit `token`, this is a non-admin request
  // (e.g. storefront customer) — use that token and don't touch the admin one.
  const usingOverrideToken = token !== undefined;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let bearer: string | null = null;
  if (auth) {
    bearer = usingOverrideToken ? token ?? null : getToken();
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      "NETWORK_ERROR",
      0
    );
  }

  // A request that carried a token but got 401 means that session is dead
  // (expired/invalid) — notify the app to log the right user out.
  if (res.status === 401 && bearer) {
    notifySessionExpired(usingOverrideToken ? "customer" : "admin");
  }

  return parseEnvelope<T>(res, !usingOverrideToken);
}

// Shared envelope parsing + error mapping for both JSON and multipart requests.
// `clearAdminOn401` clears the stored admin token on a 401 (default). Storefront
// requests pass false so a customer 401 doesn't sign the admin out.
async function parseEnvelope<T>(
  res: Response,
  clearAdminOn401 = true
): Promise<ApiEnvelope<T>> {
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. proxy error page).
  }

  if (res.status === 401 && clearAdminOn401) {
    clearToken();
  }

  if (!res.ok || !payload || payload.success === false) {
    const error = payload?.error;
    const fallbackMessage =
      res.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : `Request failed (${res.status})`;
    throw new ApiError(
      error?.message || fallbackMessage,
      error?.code || (res.status === 429 ? "TOO_MANY_REQUESTS" : "REQUEST_FAILED"),
      res.status,
      error?.details,
      typeof payload?.retryAfter === "number" ? payload.retryAfter : undefined
    );
  }

  return payload;
}

/**
 * Upload files as multipart/form-data. The browser sets the Content-Type
 * boundary, so we never set it manually. Always sends the auth token.
 */
export async function apiUpload<T>(
  path: string,
  files: File[],
  options: { field?: string; query?: RequestOptions["query"]; signal?: AbortSignal } = {}
): Promise<ApiEnvelope<T>> {
  const { field = "files", query, signal } = options;

  const form = new FormData();
  for (const file of files) form.append(field, file);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method: "POST",
      headers,
      body: form,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      "NETWORK_ERROR",
      0
    );
  }

  if (res.status === 401 && token) notifySessionExpired("admin");

  return parseEnvelope<T>(res);
}

/** Convenience wrapper that returns just `data` (most callers want this). */
export async function apiData<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const envelope = await apiFetch<T>(path, options);
  return envelope.data as T;
}
