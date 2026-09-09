import React, { useEffect, useRef, useState } from "react";
import {
  SearchIcon,
  UserIcon,
  CartIcon,
  AgriWordmark,
} from "../../assets/icons";
import { Settings, LogOut, Menu, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import SearchOverlay from "./SearchOverlay";
import { useStorefront } from "../../storefront/StorefrontContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `transition-colors ${
    isActive ? "text-green-600" : "text-gray-800 hover:text-green-600"
  }`;

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Products" },
  { to: "/contact", label: "Contact" },
  { to: "/blog", label: "Blog" },
  { to: "/track", label: "Track Your Order" },
];

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isLoggedIn, cartCount, openAuth, logout } = useStorefront();

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!logoutOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLogoutOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [logoutOpen]);

  const handleConfirmLogout = () => {
    setLogoutOpen(false);
    logout();
  };

  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <NavLink to="/" aria-label="Go to home">
            <AgriWordmark title="AgriCola" className="h-8 w-auto" />
          </NavLink>
        </div>
        <nav className="hidden md:flex space-x-8 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navLinkClass}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center space-x-4 text-gray-700">
          <button
            className="hover:text-green-600 transition-colors"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon className="w-5 h-5" />
          </button>
          <button
            className="relative hover:text-green-600 transition-colors"
            aria-label="Cart"
            onClick={() => navigate("/cart")}
          >
            <CartIcon className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#84b817] px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="flex items-center hover:text-green-600 transition-colors"
              aria-label="Account"
              aria-haspopup={isLoggedIn ? "menu" : undefined}
              aria-expanded={isLoggedIn ? menuOpen : undefined}
              onClick={() => {
                if (isLoggedIn) {
                  setMenuOpen((open) => !open);
                } else {
                  openAuth();
                }
              }}
            >
              <UserIcon className="w-5 h-5" />
            </button>

            {isLoggedIn && menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-3 w-44 rounded-xl border border-gray-100 bg-white p-2 shadow-lg z-50"
              >
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profile");
                  }}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  role="menuitem"
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors"
                  onClick={() => {
                    setMenuOpen(false);
                    setLogoutOpen(true);
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
          <button
            className="md:hidden hover:text-green-600 transition-colors"
            aria-label="Menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col space-y-1 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-600"
                    : "text-gray-800 hover:bg-gray-50 hover:text-green-600"
                }`
              }
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      {logoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setLogoutOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
              <LogOut className="h-6 w-6 text-red-500" />
            </div>
            <h2
              id="logout-title"
              className="mb-2 text-lg font-bold text-gray-900"
            >
              Are you sure you want to logout?
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              You'll be signed out of your account. Make sure you've saved any
              changes before logging out.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                onClick={() => setLogoutOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors cursor-pointer"
                onClick={handleConfirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};

export default Header;
