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
import LocationModal from "../components/layout/LocationModal";
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
import {
  type DeliveryLocation,
  getSavedLocation,
  saveLocation,
} from "../lib/pincode";
import { SESSION_EXPIRED_EVENT } from "../lib/api";

const WISHLIST_KEY = "agricola.wishlist";

interface StorefrontContextValue {
  user: CustomerUser | null;
  isLoggedIn: boolean;
  cart: CartData;
  cartCount: number;
  wishlist: string[];
  wishlistCount: number;
  isInWishlist: (id: string) => boolean;
  toggleWishlist: (id: string) => void;
  deliveryLocation: DeliveryLocation | null;
  setDeliveryLocation: (loc: DeliveryLocation) => void;
  openLocationModal: () => void;
  login: (session: CustomerSession) => void;
  logout: () => void;
  updateUser: (patch: Partial<CustomerUser>) => void;
  openAuth: (onSuccess?: () => void) => void;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, weight: string | null, qty?: number, meta?: Partial<import("../lib/cart").CartItem>) => Promise<void>;
  updateItem: (id: string, qty: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

const GUEST_CART_KEY = "agricola.guest_cart";

const getSavedGuestCart = (): CartData => {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      const items: any[] = parsed.items;
      const subtotal = items.reduce((acc, i) => acc + (Number(i.lineTotal) || (Number(i.price || 0) * Number(i.qty || 1))), 0);
      const itemCount = items.reduce((acc, i) => acc + Number(i.qty || 1), 0);
      return { items, subtotal, itemCount };
    }
    return EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
};

const saveGuestCart = (cart: CartData) => {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  } catch {
    // Non-fatal
  }
};

export const StorefrontProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<CustomerUser | null>(() => getCustomerUser());
  const [cart, setCart] = useState<CartData>(() => getSavedGuestCart());
  const [authOpen, setAuthOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const onAuthSuccessRef = useRef<(() => void) | null>(null);

  // Wishlist state
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Location state
  const [deliveryLocation, setDeliveryLocationState] = useState<DeliveryLocation | null>(() =>
    getSavedLocation()
  );

  const isLoggedIn = !!user;

  const setDeliveryLocation = useCallback((loc: DeliveryLocation) => {
    setDeliveryLocationState(loc);
    saveLocation(loc);
  }, []);

  const openLocationModal = useCallback(() => {
    setLocationOpen(true);
  }, []);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((cur) => {
      const exists = cur.includes(id);
      if (!exists && cur.length >= 50) {
        return cur;
      }
      const next = exists ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      } catch {
        // Non-fatal
      }
      return next;
    });
  }, []);

  const isInWishlist = useCallback(
    (id: string) => wishlist.includes(id),
    [wishlist]
  );

  const refreshCart = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setCart(getSavedGuestCart());
      return;
    }

    try {
      // Sync guest cart to backend if items exist
      const guest = getSavedGuestCart();
      if (guest.items.length > 0) {
        for (const item of guest.items) {
          try {
            await addToCart(item.productId, item.weight, item.qty);
          } catch {
            // Ignore individual sync errors
          }
        }
        localStorage.removeItem(GUEST_CART_KEY);
      }

      const serverCart = await getCart();
      setCart(serverCart);
    } catch {
      setCart(getSavedGuestCart());
    }
  }, []);

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
    localStorage.removeItem(GUEST_CART_KEY);
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

  const handleAuthenticated = useCallback(() => {
    const cb = onAuthSuccessRef.current;
    onAuthSuccessRef.current = null;
    refreshCart();
    cb?.();
  }, [refreshCart]);

  const addItem = useCallback(
    async (
      productId: string,
      weight: string | null,
      qty = 1,
      meta?: Partial<import("../lib/cart").CartItem>
    ) => {
      const token = getCustomerToken();

      if (token) {
        try {
          const updated = await addToCart(productId, weight, qty);
          setCart(updated);
          return;
        } catch (err) {
          console.warn("Backend addToCart error, falling back to local cart:", err);
        }
      }

      // Guest / Local Cart logic
      setCart((currentCart) => {
        const items = [...currentCart.items];
        const matchIdx = items.findIndex(
          (i) =>
            (i.productId === productId || i.id === productId) &&
            (i.weight || null) === (weight || null)
        );

        const unitPrice = Number(meta?.price || 0);

        if (matchIdx > -1) {
          const existing = items[matchIdx];
          const newQty = existing.qty + qty;
          items[matchIdx] = {
            ...existing,
            qty: newQty,
            lineTotal: existing.price * newQty,
            image: meta?.image || existing.image,
            title: meta?.title || existing.title,
          };
        } else {
          items.push({
            id: "guest_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            productId: meta?.productId || productId,
            title: meta?.title || "Organic Harvest Item",
            weight: weight || "Standard",
            price: unitPrice,
            qty,
            image: meta?.image || null,
            inStock: meta?.inStock !== false,
            lineTotal: unitPrice * qty,
          });
        }

        const subtotal = items.reduce((acc, i) => acc + i.lineTotal, 0);
        const itemCount = items.reduce((acc, i) => acc + i.qty, 0);
        const newCart: CartData = { items, subtotal, itemCount };

        saveGuestCart(newCart);
        return newCart;
      });
    },
    []
  );

  const updateItem = useCallback(async (id: string, qty: number) => {
    const token = getCustomerToken();
    if (token && !id.startsWith("guest_")) {
      try {
        setCart(await updateCartItem(id, qty));
        return;
      } catch (err) {
        console.warn("Backend updateCartItem failed:", err);
      }
    }

    setCart((currentCart) => {
      let items = [...currentCart.items];
      if (qty < 1) {
        items = items.filter((i) => i.id !== id);
      } else {
        const idx = items.findIndex((i) => i.id === id);
        if (idx > -1) {
          items[idx] = {
            ...items[idx],
            qty,
            lineTotal: items[idx].price * qty,
          };
        }
      }

      const subtotal = items.reduce((acc, i) => acc + i.lineTotal, 0);
      const itemCount = items.reduce((acc, i) => acc + i.qty, 0);
      const newCart: CartData = { items, subtotal, itemCount };

      saveGuestCart(newCart);
      return newCart;
    });
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const token = getCustomerToken();
    if (token && !id.startsWith("guest_")) {
      try {
        setCart(await removeCartItem(id));
        return;
      } catch (err) {
        console.warn("Backend removeCartItem failed:", err);
      }
    }

    setCart((currentCart) => {
      const items = currentCart.items.filter((i) => i.id !== id);
      const subtotal = items.reduce((acc, i) => acc + i.lineTotal, 0);
      const itemCount = items.reduce((acc, i) => acc + i.qty, 0);
      const newCart: CartData = { items, subtotal, itemCount };

      saveGuestCart(newCart);
      return newCart;
    });
  }, []);

  const value = useMemo<StorefrontContextValue>(
    () => ({
      user,
      isLoggedIn,
      cart,
      cartCount: cart.itemCount,
      wishlist,
      wishlistCount: wishlist.length,
      isInWishlist,
      toggleWishlist,
      deliveryLocation,
      setDeliveryLocation,
      openLocationModal,
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
      wishlist,
      isInWishlist,
      toggleWishlist,
      deliveryLocation,
      setDeliveryLocation,
      openLocationModal,
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
      <LocationModal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onLocationSelected={(loc) => setDeliveryLocation(loc)}
      />
    </StorefrontContext.Provider>
  );
};

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) {
    throw new Error("useStorefront must be used within a StorefrontProvider");
  }
  return ctx;
}
