import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import "./index.css";
import Contact from "./Pages/Contact";
import Blog from "./Pages/Blog";
import { Landing } from "./Pages/Landing";
import { Products } from "./Pages/Products";
import ProductDetail from "./Pages/ProductDetail";
import Cart from "./Pages/Cart";
import Checkout from "./Pages/Checkout";
import OrderDetails from "./Pages/OrderDetails";
import OrderTracking from "./Pages/OrderTracking";
import ReturnPolicy from "./Pages/ReturnPolicy";
import Profile from "./Pages/Profile";
import Feedback from "./Pages/Feedback";
import { AuthProvider } from "./admin/auth/AuthContext";
import ProtectedRoute from "./admin/auth/ProtectedRoute";
import { StorefrontProvider } from "./storefront/StorefrontContext";

// Admin is code-split so its bundle isn't shipped to storefront visitors.
const Admin = React.lazy(() => import("./admin/admin"));
const AdminLogin = React.lazy(() => import("./admin/pages/Login"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <StorefrontProvider>
              <App />
            </StorefrontProvider>
          }
        >
          <Route path="/" element={<Landing />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderDetails />} />
          <Route path="/track" element={<OrderTracking />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/return-policy" element={<ReturnPolicy />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/feedback" element={<Feedback />} />
        </Route>
        <Route
          path="/admin/*"
          element={
            <AuthProvider>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center text-gray-500">
                    Loading…
                  </div>
                }
              >
                <Routes>
                  <Route path="login" element={<AdminLogin />} />
                  <Route
                    path="*"
                    element={
                      <ProtectedRoute>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
