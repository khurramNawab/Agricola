import { Link, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="min-h-[80vh] bg-[#fbf9f6] flex items-center justify-center px-4 py-16 sm:py-24">
      <div className="max-w-xl w-full text-center flex flex-col items-center">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c9ecc4]/60 border border-[#84b817]/30 text-[#1e3a1f] text-xs font-bold uppercase tracking-wider mb-6 animate-pulse">
          <Compass size={14} className="text-[#486800]" />
          <span>404 • Lost in the Fields</span>
        </div>

        {/* Large Decorative 404 Number */}
        <div className="relative mb-6 select-none">
          <span className="text-8xl sm:text-9xl font-black text-[#1e3a1f]/10 tracking-tighter">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#1e3a1f]">
              Harvest Not Found
            </span>
          </div>
        </div>

        {/* Descriptive Text */}
        <p className="text-sm sm:text-base text-[#434936] leading-relaxed max-w-md mb-8">
          The page or crop you are looking for has been moved, reaped, or doesn't exist in our fields. Let's get you back on track to pure, organic living.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-10">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer active:scale-98"
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>

          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#1e3a1f] hover:bg-[#2d522e] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            <Home size={16} />
            <span>Back to Home</span>
          </Link>

          <Link
            to="/products"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#84b817] hover:bg-[#6d9913] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            <ShoppingBag size={16} />
            <span>Shop Products</span>
          </Link>
        </div>

        {/* Helpful Popular Destinations */}
        <div className="w-full pt-8 border-t border-gray-200/70">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
            Popular Farm Destinations
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <Link
              to="/products"
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-[#1e3a1f] font-semibold hover:border-[#84b817] transition-colors"
            >
              Phool Makhana
            </Link>
            <Link
              to="/products"
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-[#1e3a1f] font-semibold hover:border-[#84b817] transition-colors"
            >
              Organic Teas
            </Link>
            <Link
              to="/track"
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-[#1e3a1f] font-semibold hover:border-[#84b817] transition-colors"
            >
              Track Order
            </Link>
            <Link
              to="/contact"
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-[#1e3a1f] font-semibold hover:border-[#84b817] transition-colors"
            >
              Need Help? Contact Us
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
