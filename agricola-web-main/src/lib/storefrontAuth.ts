// Storefront (customer) auth — Firebase phone OTP login/signup.
//
// Keeps a customer session (JWT + profile) in localStorage, separate from the
// admin session (`admin_token`). The client runs Firebase phone sign-in (see
// lib/firebase.ts) and posts the resulting ID token to /auth/firebase, which
// find-or-creates the account on first login — so a successful OTP doubles as
// signup.

import { apiData } from "./api";

const TOKEN_KEY = "agri_customer_token";
const USER_KEY = "agri_customer";

export interface CustomerUser {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string | null;
}

export interface CustomerSession {
  token: string;
  user: CustomerUser;
}

export function getCustomerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCustomerUser(): CustomerUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerUser;
  } catch {
    return null;
  }
}

export function setCustomerSession(session: CustomerSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearCustomerSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface FirebaseLoginResponse {
  token: string;
  refreshToken: string;
  user: CustomerUser;
}

export interface OtpRequestResponse {
  phone: string;
  expiresAt: string;
  devOtp?: string;
}

export interface OtpVerifyResponse {
  token: string;
  refreshToken: string;
  user: CustomerUser;
}

/**
 * Request an OTP from backend SMS service (Fast2SMS / DEV sandbox).
 */
export async function requestBackendOtp(
  phone: string,
  acceptedTerms = true
): Promise<OtpRequestResponse> {
  const local = phone.replace(/\D/g, "").slice(-10);
  return apiData<OtpRequestResponse>("/auth/otp/request", {
    method: "POST",
    auth: false,
    body: { phone: local, acceptedTerms },
  });
}

/**
 * Verify OTP directly with backend and return session.
 */
export async function verifyBackendOtp(
  phone: string,
  otp: string,
  name?: string
): Promise<CustomerSession> {
  const local = phone.replace(/\D/g, "").slice(-10);
  const data = await apiData<OtpVerifyResponse>("/auth/otp/verify", {
    method: "POST",
    auth: false,
    body: { phone: local, otp, ...(name ? { name } : {}) },
  });
  return { token: data.token, user: data.user };
}

/**
 * Exchange a Firebase phone-auth ID token (from confirmPhoneOtp) for a
 * storefront session. Creates the account on first login. Returns a session.
 */
export async function firebaseLogin(
  idToken: string,
  name?: string
): Promise<CustomerSession> {
  const data = await apiData<FirebaseLoginResponse>("/auth/firebase", {
    method: "POST",
    auth: false,
    body: { idToken, ...(name ? { name } : {}) },
  });
  return { token: data.token, user: data.user };
}
