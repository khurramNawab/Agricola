import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/SideBar';
import Payments from './pages/Payment';
import Warehouses from './pages/Warehouses';
import { getDashboardStats } from './api/adminApi';

function getPageFromPath(pathname: string): string {
  const sub = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  if (['products', 'orders', 'payments', 'warehouses', 'support', 'settings'].includes(sub)) {
    return sub;
  }
  return 'dashboard';
}

function Admin() {
  const location = useLocation();
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState(() => getPageFromPath(location.pathname));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [enableMultiWarehouse, setEnableMultiWarehouse] = useState(true);

  // Sync state with URL path whenever URL changes (e.g. browser back/forward or direct link)
  useEffect(() => {
    const pageFromUrl = getPageFromPath(location.pathname);
    if (pageFromUrl !== activePage) {
      setActivePage(pageFromUrl);
    }
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    getDashboardStats()
      .then((stats) => {
        if (mounted && stats.enableMultiWarehouse !== undefined) {
          setEnableMultiWarehouse(stats.enableMultiWarehouse);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handlePageChange = (page: string) => {
    setActivePage(page);
    setSidebarOpen(false);
    const targetPath = page === 'dashboard' ? '/admin' : `/admin/${page}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard':
        return 'Dashboard';
      case 'products':
        return 'Products & Categories';
      case 'orders':
        return 'Orders & Shipment';
      case 'payments':
        return 'Payments';
      case 'warehouses':
        return 'Warehouses';
      case 'support':
        return 'Support';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'orders':
        return <Orders />;
      case 'payments':
        return <Payments />;
      case 'warehouses':
        return <Warehouses />;
      case 'support':
        return (
          <div className="p-8">
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Support</h3>
              <p className="text-gray-600">Support system coming soon</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="p-8">
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Settings</h3>
              <p className="text-gray-600">Settings panel coming soon</p>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activePage={activePage}
        onPageChange={handlePageChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        enableMultiWarehouse={enableMultiWarehouse}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={getPageTitle()} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default Admin;
