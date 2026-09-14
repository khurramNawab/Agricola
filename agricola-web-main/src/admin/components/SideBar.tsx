import { LayoutDashboard, Package, Boxes, ShoppingBag, HelpCircle, Settings, Building2, Tag, ShoppingCart, Sparkles, BookOpen, X, LogOut, User as UserIcon } from 'lucide-react';
import { AgriWordmark } from '../../assets/icons';
import { useAuth } from '../auth/AuthContext';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
  enableMultiWarehouse?: boolean;
}

export default function Sidebar({ activePage, onPageChange, isOpen, onClose, enableMultiWarehouse = true }: SidebarProps) {
  const { logout, admin } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Product/Category', icon: Package },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'coupons', label: 'Coupons & Deals', icon: Tag },
    { id: 'campaigns', label: 'Hero & Campaigns', icon: Sparkles },
    { id: 'blogs', label: 'Blog & Articles', icon: BookOpen },
    { id: 'abandoned-carts', label: 'Abandoned Carts', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: ShoppingBag },
    { id: 'orders', label: 'Orders/Shipment', icon: ShoppingBag },
    ...(enableMultiWarehouse ? [{ id: 'warehouses', label: 'Warehouses', icon: Building2 }] : []),
    { id: 'support', label: 'Support & Inquiries', icon: HelpCircle },
    { id: 'settings', label: 'Store Settings', icon: Settings },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-xl border-r border-[#1e3a1f]/10 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.08)] min-h-screen flex flex-col justify-between p-4 transform transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col">
          <div className="mb-6 flex items-center justify-between px-2 pt-2">
            <div className="flex items-center gap-2">
              <AgriWordmark title="AgriCola" className="h-8 w-auto" />
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c9ecc4] text-[#4e6c4c] px-2 py-0.5 rounded-full">
                v2.4 Live
              </span>
            </div>
            <button
              className="lg:hidden text-gray-400 hover:text-gray-600"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  title={item.id === 'campaigns' ? 'Hero Carousel & Festival Campaigns' : item.label}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm text-left ${
                    isActive
                      ? 'bg-[#84b817] text-white font-semibold shadow-[0_4px_14px_-2px_rgba(132,184,23,0.4)]'
                      : 'text-[#434936] hover:bg-[#eae8e5]/60 hover:text-[#1b1c1a]'
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="truncate text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Live Logistics Sync Indicator & Admin Profile */}
        <div className="pt-4 flex flex-col gap-2.5 border-t border-gray-100">
          <div className="p-2.5 rounded-xl bg-[#f5f3f0] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[#434936] tracking-wider">Logistics Mesh</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84b817] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#84b817]"></span>
              </span>
            </div>
            <span className="text-xs font-semibold text-[#1e3a1f]">Shiprocket & Ekart Active</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-[#f5f3f0]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#1e3a1f] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                <UserIcon size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#111827] truncate leading-tight">
                  {admin?.name || 'Super Admin'}
                </span>
                <span className="text-[10px] text-[#6b7280] truncate leading-tight">Operations Lead</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-gray-400 hover:bg-white hover:text-red-600 transition-colors shadow-sm border border-gray-200"
              title="Logout"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
