import { LayoutDashboard, Package, ShoppingBag, HelpCircle, Settings, Building2, X } from 'lucide-react';
import { AgriWordmark } from '../../assets/icons';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
  enableMultiWarehouse?: boolean;
}

export default function Sidebar({ activePage, onPageChange, isOpen, onClose, enableMultiWarehouse = true }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Product/Category', icon: Package },
    { id: 'payments', label: 'Payments', icon: ShoppingBag },
    { id: 'orders', label: 'Orders/Shipment', icon: ShoppingBag },
    ...(enableMultiWarehouse ? [{ id: 'warehouses', label: 'Warehouses', icon: Building2 }] : []),
    { id: 'support', label: 'Support', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 min-h-screen p-4 transform transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="mb-8 flex items-center justify-between">
        <AgriWordmark title="AgriCola" className="h-8 w-auto" />
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#84b817] text-white'
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
