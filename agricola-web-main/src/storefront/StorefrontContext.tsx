import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AuthModal from "../components/layout/AuthModal";
import {
  type CustomerSession,
  type CustomerUser,
  clearCustomerSession,
  getCustomerToken,
  getCustomerUser,
  setCustomerSession,
} from "../lib/storefrontAuth";
import {
  type CartData,
  EMPTY_CART,
  addToCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../lib/cart";
import { SESSION_EXPIRED_EVENT } from "../lib/api";

interface StorefrontContextValue {
  user: CustomerUser | null;
  isLoggedIn: boolean;
  cart: CartData;
  cartCount: number;
  /** Persist a session after a successful OTP verify. */
  login: (session: CustomerSession) => void;
  logout: () => void;
  /** Merge updated profile fields into the stored user (e.g. after editing). */
  updateUser: (patch: Partial<CustomerUser>) => void;
  /** Open the login/signup modal. `onSuccess` runs once after authentication. */
  openAuth: (onSuccess?: () => void) => void;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, weight: string | null, qty?: number) => Promise<void>;
  updateItem: (id: string, qty: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export const StorefrontProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<CustomerUser | null>(() => getCustomerUser());
  const [cart, setCart] = useState<CartData>(EMPTY_CART);
  const [authOpen, setAuthOpen] = useState(false);
  const onAuthSuccessRef = useRef<(() => void) | null>(null);

  const isLoggedIn = !!user;

  const refreshCart = useCallback(async () => {
    if (!getCustomerToken()) {
      setCart(EMPTY_CART);
      return;
    }
    try {
      setCart(await getCart());
    } catch {
      // Leave the cart as-is on transient errors (e.g. network blip).
    }
  }, []);

  // Load the cart on mount and whenever the signed-in user changes.
  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  const login = useCallback((session: CustomerSession) => {
    setCustomerSession(session);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => {
    clearCustomerSession();
    setUser(null);
    setCart(EMPTY_CART);
  }, []);

  const updateUser = useCallback((patch: Partial<CustomerUser>) => {
    setUser((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      const token = getCustomerToken();
      if (token) setCustomerSession({ token, user: next });
      return next;
    });
  }, []);

  // Auto-logout when an authenticated request reports the customer session
  // expired/invalid (a 401 from the backend). See SESSION_EXPIRED_EVENT.
  useEffect(() => {
    const onExpired = (e: Event) => {
      if ((e as CustomEvent).detail?.scope === "customer") logout();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  const openAuth = useCallback((onSuccess?: () => void) => {
    onAuthSuccessRef.current = onSuccess ?? null;
    setAuthOpen(true);
  }, []);

  // Runs after the modal's success animation. The session is already stored
  // (the modal calls `login` on verify), so the cart token is available here.
  const handleAuthenticated = useCallback(() => {
    const cb = onAuthSuccessRef.current;
    onAuthSuccessRef.current = null;
    refreshCart();
    cb?.();
  }, [refreshCart]);

  const addItem = useCallback(
    async (productId: string, weight: string | null, qty = 1) => {
      setCart(await addToCart(productId, weight, qty));
    },
    []
  );

  const updateItem = useCallback(async (id: string, qty: number) => {
    setCart(await updateCartItem(id, qty));
  }, []);

  const removeItem = useCallback(async (id: string) => {
    setCart(await removeCartItem(id));
  }, []);

  const value = useMemo<StorefrontContextValue>(
    () => ({
      user,
      isLoggedIn,
      cart,
      cartCount: cart.itemCount,
      login,
      logout,
      updateUser,
      openAuth,
      refreshCart,
      addItem,
      updateItem,
      removeItem,
    }),
    [
      user,
      isLoggedIn,
      cart,
      login,
      logout,
      updateUser,
      openAuth,
      refreshCart,
      addItem,
      updateItem,
      removeItem,
    ]
  );

  return (
    <StorefrontContext.Provider value={value}>
      {children}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={login}
        onAuthenticated={handleAuthenticated}
      />
    </StorefrontContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) {
    throw new Error("useStorefront must be used within a StorefrontProvider");
  }
  return ctx;
}
