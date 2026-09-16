import React, { useEffect, useRef, useState } from "react";
import { Settings, LogOut, Menu, X, Heart, BookOpen } from "lucide-react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import SearchOverlay from "./SearchOverlay";
import { useStorefront } from "../../storefront/StorefrontContext";
import { AgriWordmark } from "../../assets/icons";

const navItems: Array<{ to: string; label: string; end?: boolean; badge?: string; badgeColor?: string }> = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Catalog / All Products" },
  { to: "/products?category=makhana", label: "Makhana & Snacks" },
  { to: "/blog", label: "Harvest Journal & Blogs" },
  { to: "/coming-soon/utensils", label: "Heritage Cookware", badge: "Coming Soon", badgeColor: "amber" },
  { to: "/coming-soon/gardening", label: "Organic Gardening", badge: "Coming Soon", badgeColor: "emerald" },
  { to: "/contact", label: "About Us" },
  { to: "/track", label: "Track Your Order" },
];

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    isLoggedIn,
    cartCount,
    wishlistCount,
    deliveryLocation,
    openLocationModal,
    openAuth,
    logout,
  } = useStorefront();

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

  const displayLocation = deliveryLocation
    ? `${deliveryLocation.pincode}, ${deliveryLocation.city || "India"}`
    : "Select Delivery Pincode";

  return (
    <header className="sticky top-0 left-0 w-full z-50 shadow-[0_2px_14px_rgba(0,0,0,0.06)] bg-white/95 backdrop-blur-xl transition-all">
      {/* Tier 1: Top Announcement Ribbon */}
      <div className="bg-[#1e3a1f] text-[#faf8f5] px-4 lg:px-8 py-2 text-xs font-medium border-b border-[#84b817]/20">
        <div className="max-w-[1540px] 2xl:max-w-[1600px] w-full mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="material-symbols-outlined text-sm text-[#84b817]">eco</span>
            <p className="text-[11.5px] sm:text-xs tracking-wide font-medium">
              100% Farm-Direct Certified Organic • Free shipping across India on orders above ₹799 • Direct farmer provenance
            </p>
          </div>
          {/* Top Right: Track Your Order CTA */}
          <Link
            to="/track"
            className="flex items-center gap-1.5 text-[#c9ecc4] hover:text-white transition-colors text-[11.5px] sm:text-xs font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm text-[#84b817]">local_shipping</span>
            <span>Track Your Order</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </Link>
        </div>
      </div>

      {/* Tier 2: Main Brand & Search Tier (Spacious & Premium) */}
      <div className="max-w-[1540px] 2xl:max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-3.5 sm:py-4 flex flex-col justify-center gap-2">
        <div className="flex items-center justify-between gap-4 lg:gap-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              className="md:hidden text-gray-700 hover:text-[#486800] p-1 cursor-pointer"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <NavLink to="/" aria-label="Go to home" className="flex items-center gap-3 group py-1">
              <AgriWordmark title="AgriCola" className="h-9 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105" />
            </NavLink>
          </div>

          {/* Center Search Bar */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-2 lg:mx-6">
            <div
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center bg-[#f5f3f0] hover:bg-[#eceae5] rounded-full px-5 py-2.5 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-200/60 hover:border-[#84b817]/50 transition-all group"
            >
              <div className="flex items-center gap-1 border-r border-gray-300/80 pr-3 mr-3 text-xs sm:text-sm font-bold text-[#434936]">
                <span>All Organic</span>
                <span className="material-symbols-outlined text-sm text-gray-500">arrow_drop_down</span>
              </div>
              <span className="flex-1 text-xs sm:text-sm text-gray-400 group-hover:text-gray-600 transition-colors truncate">
                Search Mithila GI makhana, whole leaf green tea, herbal tea...
              </span>
              <span className="material-symbols-outlined text-[#486800] text-xl font-bold ml-2">search</span>
            </div>
          </div>

          {/* Right Actions: Deliver-to, Wishlist, Cart, Account */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Interactive Location Pill (Navbar) */}
            <button
              type="button"
              onClick={openLocationModal}
              className="hidden xl:flex items-center gap-2.5 text-left hover:bg-gray-50 p-2 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-200"
              title="Change Delivery Location"
            >
              <span className="material-symbols-outlined text-[#486800] text-2xl">location_on</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#434936] font-semibold leading-tight">Deliver to:</span>
                <span className="text-xs text-[#1b1c1a] font-bold leading-tight truncate max-w-[140px]">
                  {displayLocation}
                </span>
              </div>
            </button>

            {/* Mobile Search Icon */}
            <button
              className="md:hidden p-2 hover:text-[#486800] transition-colors cursor-pointer"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <span className="material-symbols-outlined text-2xl text-gray-700">search</span>
            </button>

            {/* Wishlist Button with Dynamic Counter */}
            <button
              aria-label="Wishlist"
              onClick={() => navigate("/wishlist")}
              className="relative p-2.5 rounded-full hover:bg-gray-100 transition-colors text-[#434936] hover:text-[#e11d48] cursor-pointer"
              title="Organic Wishlist"
            >
              <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
              {wishlistCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-[#e11d48] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ring-2 ring-white animate-pulse">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Pill */}
            <button
              aria-label="Cart"
              onClick={() => navigate("/cart")}
              className="flex items-center gap-2.5 bg-[#c9ecc4] hover:bg-[#84b817] text-[#1e3a1f] hover:text-white px-4 sm:px-5 py-2.5 rounded-full font-extrabold text-xs sm:text-sm shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">local_mall</span>
              <span>Cart ({cartCount})</span>
            </button>

            {/* Account Profile / Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                className="w-10 h-10 rounded-full bg-[#1e3a1f] text-white flex items-center justify-center hover:bg-[#486800] transition-colors shadow-xs cursor-pointer"
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
                <span className="material-symbols-outlined text-xl">person</span>
              </button>

              {isLoggedIn && menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-3 w-52 rounded-2xl border border-gray-100 bg-white p-2.5 shadow-2xl z-50 animate-fadeIn"
                >
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#f5f3f0] hover:text-[#486800] transition-colors cursor-pointer"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/profile");
                    }}
                  >
                    <Settings className="w-4 h-4" />
                    My Account & Orders
                  </button>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#f5f3f0] hover:text-[#486800] transition-colors cursor-pointer"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/wishlist");
                    }}
                  >
                    <Heart className="w-4 h-4 text-[#e11d48]" />
                    Wishlist ({wishlistCount})
                  </button>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-[#f5f3f0] hover:text-[#486800] transition-colors cursor-pointer"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/track");
                    }}
                  >
                    <span>📦</span>
                    Track Order Live
                  </button>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setMenuOpen(false);
                      setLogoutOpen(true);
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tier 3: Subcategory Navigation Bar (Enlarged, Spacious, Blogs Added) */}
        <nav className="hidden md:flex items-center justify-center gap-7 lg:gap-9 overflow-x-auto py-3 border-t border-gray-100 text-sm font-bold text-[#434936]">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `whitespace-nowrap transition-all duration-200 py-1 ${
                isActive
                  ? "text-[#486800] font-black border-b-2 border-[#486800]"
                  : "hover:text-[#486800]"
              }`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) =>
              `whitespace-nowrap transition-all duration-200 py-1 ${
                isActive
                  ? "text-[#486800] font-black border-b-2 border-[#486800]"
                  : "hover:text-[#486800]"
              }`
            }
          >
            All Products &amp; Harvest
          </NavLink>

          <NavLink
            to="/products?category=makhana"
            className="whitespace-nowrap hover:text-[#486800] transition-all duration-200 py-1"
          >
            Makhana &amp; Snacks
          </NavLink>

          {/* Blogs & Harvest Journal - Added to Nav */}
          <NavLink
            to="/blog"
            className={({ isActive }) =>
              `whitespace-nowrap inline-flex items-center gap-1.5 transition-all duration-200 py-1 ${
                isActive
                  ? "text-[#486800] font-black border-b-2 border-[#486800]"
                  : "hover:text-[#486800]"
              }`
            }
          >
            <BookOpen size={16} className="text-[#84b817]" />
            <span>Harvest Blogs &amp; Guides</span>
          </NavLink>

          {/* Heritage Cookware with Coming Soon Badge */}
          <NavLink
            to="/coming-soon/utensils"
            className={({ isActive }) =>
              `whitespace-nowrap inline-flex items-center gap-2 transition-all duration-200 py-1 ${
                isActive
                  ? "text-[#486800] font-black border-b-2 border-[#486800]"
                  : "hover:text-[#486800]"
              }`
            }
          >
            <span>Heritage Cookware</span>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
              Coming Soon
            </span>
          </NavLink>

          {/* Organic Gardening with Coming Soon Badge */}
          <NavLink
            to="/coming-soon/gardening"
            className={({ isActive }) =>
              `whitespace-nowrap inline-flex items-center gap-2 transition-all duration-200 py-1 ${
                isActive
                  ? "text-[#486800] font-black border-b-2 border-[#486800]"
                  : "hover:text-[#486800]"
              }`
            }
          >
            <span>Organic Gardening</span>
            <span className="bg-[#c9ecc4] text-[#1e3a1f] border border-[#84b817]/40 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
              Coming Soon
            </span>
          </NavLink>

          <NavLink
            to="/contact"
            className="whitespace-nowrap hover:text-[#486800] transition-all duration-200 py-1"
          >
            About Us &amp; Contact
          </NavLink>
        </nav>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileNavOpen && (
        <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col space-y-1.5 text-sm font-medium animate-fadeIn">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-xl px-3.5 py-3 transition-colors font-bold ${
                  isActive
                    ? "bg-[#c9ecc4]/70 text-[#1e3a1f]"
                    : "text-gray-800 hover:bg-[#f5f3f0] hover:text-[#486800]"
                }`
              }
              onClick={() => setMobileNavOpen(false)}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    item.badgeColor === "amber"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-[#c9ecc4] text-[#1e3a1f] border-[#84b817]/40"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              openLocationModal();
            }}
            className="flex items-center gap-2 rounded-xl px-3.5 py-3 text-left transition-colors font-bold text-[#486800] hover:bg-[#f5f3f0]"
          >
            <span className="material-symbols-outlined text-base">location_on</span>
            <span>{displayLocation}</span>
          </button>
        </nav>
      )}

      {/* Logout Confirmation Dialog */}
      {logoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setLogoutOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <LogOut className="h-7 w-7 text-red-500" />
            </div>
            <h2
              id="logout-title"
              className="mb-2 text-xl font-bold text-gray-900"
            >
              Are you sure you want to logout?
            </h2>
            <p className="mb-6 text-xs sm:text-sm text-gray-500">
              You'll be signed out of your session on this device.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl bg-gray-200 py-3 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                onClick={() => setLogoutOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-red-500 py-3 text-xs sm:text-sm font-bold text-white hover:bg-red-600 transition-colors cursor-pointer shadow-sm"
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
