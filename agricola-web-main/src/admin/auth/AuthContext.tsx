import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ConfirmationResult } from "firebase/auth";
import { adminFirebaseLogin, adminBypassLogin, adminLogout, type AdminProfile } from "../api/adminApi";
import { clearToken, setToken, getToken, SESSION_EXPIRED_EVENT } from "../../lib/api";
import { sendPhoneOtp, confirmPhoneOtp, toE164 } from "../../lib/firebase";

const RECAPTCHA_CONTAINER_ID = "recaptcha-admin";
const ADMIN_PROFILE_KEY = "admin_profile";

function getAdminProfile(): AdminProfile | null {
  try {
    const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAdminProfile(profile: AdminProfile): void {
  localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(profile));
}

function clearAdminProfile(): void {
  localStorage.removeItem(ADMIN_PROFILE_KEY);
}

interface AuthContextValue {
  isAuthenticated: boolean;
  admin: AdminProfile | null;
  requestOtp: (phone: string, password: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<boolean>;
  bypassLogin: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = getToken();
    return Boolean(token);
  });
  const [admin, setAdmin] = useState<AdminProfile | null>(() => getAdminProfile());

  const pendingRef = useRef<{
    password: string;
    confirmation: ConfirmationResult;
  } | null>(null);

  const requestOtp = async (phone: string, password: string) => {
    const trimmedPhone = phone.trim();
    const confirmation = await sendPhoneOtp(
      toE164(trimmedPhone),
      RECAPTCHA_CONTAINER_ID
    );
    pendingRef.current = { password, confirmation };
  };

  const verifyOtp = async (code: string) => {
    const pending = pendingRef.current;
    if (!pending) {
      throw new Error("No pending OTP request found. Please request a new OTP.");
    }
    const idToken = await confirmPhoneOtp(pending.confirmation, code);
    const { token, user } = await adminFirebaseLogin(idToken, pending.password);
    setToken(token);
    setAdminProfile(user);
    setAdmin(user);
    setIsAuthenticated(true);
    pendingRef.current = null;
    return true;
  };

  const bypassLogin = async () => {
    try {
      const { token, user } = await adminBypassLogin();
      setToken(token);
      setAdminProfile(user);
      setAdmin(user);
      setIsAuthenticated(true);
    } catch {
      // Fallback if network drops: use local bypass token directly
      const devUser: AdminProfile = {
        id: "admin-bypass-id",
        name: "Admin Demo",
        phone: "+919999999999",
        email: "admin@agricola.com",
        role: "admin",
      };
      setToken("dev-admin-bypass-token");
      setAdminProfile(devUser);
      setAdmin(devUser);
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    adminLogout();
    clearToken();
    clearAdminProfile();
    setAdmin(null);
    setIsAuthenticated(false);
  };

  // Auto-logout when an authenticated admin request reports the session expired.
  useEffect(() => {
    const onExpired = (e: Event) => {
      if ((e as CustomEvent).detail?.scope !== "admin") return;
      clearToken();
      clearAdminProfile();
      setAdmin(null);
      setIsAuthenticated(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, admin, requestOtp, verifyOtp, bypassLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
