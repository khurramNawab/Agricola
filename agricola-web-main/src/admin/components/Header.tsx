import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, LogOut, Menu } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-[#1e3a1f]/10 shadow-[0_1px_8px_rgba(0,0,0,0.03)] px-4 sm:px-8 py-3.5 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-[#434936] hover:text-[#1b1c1a]"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-[#84b817] tracking-wider hidden sm:inline">Operations</span>
            <span className="text-gray-300 hidden sm:inline">•</span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1b1c1a] truncate">
              {title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative hidden sm:block">
            <input
              type="text"
              placeholder="Search store, orders, SKUs..."
              className="pl-4 pr-10 py-2 bg-[#f5f3f0] border-0 rounded-xl text-xs font-medium w-48 md:w-64 focus:outline-none focus:ring-2 focus:ring-[#84b817]/30 text-[#1b1c1a] placeholder:text-gray-400"
            />
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#1e3a1f] text-white p-1 rounded-lg hover:bg-[#84b817] transition-colors">
              <Search size={14} />
            </button>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[#f5f3f0] transition-colors"
            >
              <div className="w-10 h-10 bg-[#84b817] rounded-full flex items-center justify-center text-white font-semibold">
                A
              </div>
              <span className="font-medium text-gray-900 hidden sm:inline">Admin</span>
              <ChevronDown size={20} className="text-gray-500" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-gray-100 bg-white p-2 shadow-lg z-50"
              >
                <button
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
