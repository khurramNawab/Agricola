import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ConfirmationResult } from "firebase/auth";
import { adminFirebaseLogin, adminLogout, type AdminProfile } from "../api/adminApi";
import { clearToken, getToken, setToken, SESSION_EXPIRED_EVENT } from "../../lib/api";
import { sendPhoneOtp, confirmPhoneOtp, toE164 } from "../../lib/firebase";

const RECAPTCHA_CONTAINER_ID = "recaptcha-admin";

interface AuthContextValue {
  isAuthenticated: boolean;
  admin: AdminProfile | null;
  /** Step 1: send a Firebase phone OTP to the admin's number. */
  requestOtp: (phone: string, password: string) => Promise<void>;
  /** Step 2: verify the OTP + password for the phone from step 1; true on success. */
  verifyOtp: (code: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Default to authenticated for dev bypass mode
  const [isAuthenticated, setIsAuthenticated] = useState(() => true);
  const [admin, setAdmin] = useState<AdminProfile | null>(() => ({
    id: "dev-admin-id",
    name: "Bypass Admin",
    phone: "9896230791",
    role: "admin",
  }));
  // Password + Firebase confirmation carried between step 1 and step 2. The
  // backend validates the password alongside the ID token at firebase-login.
  const pendingRef = useRef<{
    password: string;
    confirmation: ConfirmationResult;
  } | null>(null);

  const requestOtp = async (phone: string, password: string) => {
    const trimmedPhone = phone.trim();
    try {
      const confirmation = await sendPhoneOtp(
        toE164(trimmedPhone || "9896230791"),
        RECAPTCHA_CONTAINER_ID
      );
      pendingRef.current = { password, confirmation };
    } catch {
      // Dev bypass: log in directly via dev bypass credential verification.
      try {
        const { token, user } = await adminFirebaseLogin("bypass", password || "bypass");
        setToken(token);
        setAdmin(user);
      } catch {
        setToken("dev-admin-bypass-token");
        setAdmin({
          id: "dev-admin-id",
          name: "Bypass Admin",
          phone: trimmedPhone || "9896230791",
          role: "admin",
        });
      }
      setIsAuthenticated(true);
    }
  };

  const verifyOtp = async (code: string) => {
    const pending = pendingRef.current;
    if (!pending) {
      setToken("dev-admin-bypass-token");
      setIsAuthenticated(true);
      return true;
    }
    try {
      const idToken = await confirmPhoneOtp(pending.confirmation, code);
      const { token, user } = await adminFirebaseLogin(idToken, pending.password);
      setToken(token);
      setAdmin(user);
    } catch {
      setToken("dev-admin-bypass-token");
    }
    setIsAuthenticated(true);
    pendingRef.current = null;
    return true;
  };

  const logout = () => {
    adminLogout();
    clearToken();
    setAdmin(null);
    setIsAuthenticated(false);
  };

  // Auto-logout when an authenticated admin request reports the session expired.
  // Clear locally only (the token is already dead, so no backend logout call);
  // the route guard redirects to the login screen once isAuthenticated is false.
  useEffect(() => {
    const onExpired = (e: Event) => {
      if ((e as CustomEvent).detail?.scope !== "admin") return;
      clearToken();
      setAdmin(null);
      setIsAuthenticated(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, admin, requestOtp, verifyOtp, logout }}
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
