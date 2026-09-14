import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Bell, Flame, Leaf, Shield, HeartHandshake } from "lucide-react";
import { LaunchNotifyModal } from "../common/LaunchNotifyModal";

export const ComingSoonShowcase: React.FC = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"utensils" | "gardening" | "both">("both");
  const [interestTitle, setInterestTitle] = useState<string | undefined>(undefined);

  const handleOpenNotify = (cat: "utensils" | "gardening" | "both", title?: string) => {
    setSelectedCategory(cat);
    setInterestTitle(title);
    setModalOpen(true);
  };

  return (
    <section className="py-20 bg-linear-to-b from-stone-50 via-amber-50/30 to-white relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300/60 text-amber-900 text-xs sm:text-sm font-semibold mb-4 shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>Upcoming Heritage Collections</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-gray-900 font-bold mb-4 tracking-tight">
            Crafted for Pure Living & Timeless Living
          </h2>
          <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
            Expanding the Agricola philosophy beyond pure food — handcrafted traditional kitchen cookware and pure organic home gardening essentials arriving this season.
          </p>
        </div>

        {/* Grand Two-Column Feature Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 max-w-6xl mx-auto mb-16">
          {/* Card 1: Traditional Utensils */}
          <div className="group relative bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col justify-between">
            <div>
              {/* Image banner */}
              <div className="relative h-64 sm:h-72 overflow-hidden bg-stone-900">
                <img
                  src="https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1000&q=80"
                  alt="Heritage Indian Cookware & Utensils"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
                
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="bg-amber-500/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> Hand-Forged
                  </span>
                  <span className="bg-black/60 backdrop-blur-xs text-amber-200 text-xs font-medium px-3 py-1 rounded-full">
                    Ayurvedic Grade
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-xs uppercase tracking-wider text-amber-300 font-bold block mb-1">
                    Kitchen & Dining Heritage
                  </span>
                  <h3 className="text-2xl font-serif font-bold text-white">
                    Traditional Indian Cookware
                  </h3>
                </div>
              </div>

              {/* Body details */}
              <div className="p-6 sm:p-8">
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  Experience healthy cooking the way our ancestors did. 100% lead-free, non-toxic pure Brass (Pittal), Kansa (Bronze) Dinner Sets, pre-seasoned Cast Iron Kadhais, and hand-molded Terracotta Clay Pots.
                </p>

                {/* Feature highlight tags */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800">
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Pure Kansa (78:22 Bell Metal)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800">
                    <Flame className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Heavy Pre-Seasoned Cast Iron</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800">
                    <HeartHandshake className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Moradabad Artisan Crafted</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800">
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Zero Synthetic / Teflon Coating</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100">
              <button
                onClick={() => handleOpenNotify("utensils", "Heritage Indian Cookware")}
                className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Notify Me for Early Access</span>
              </button>

              <button
                onClick={() => navigate("/coming-soon/utensils")}
                className="inline-flex items-center gap-1.5 text-stone-700 hover:text-amber-800 text-xs sm:text-sm font-semibold transition-colors group/btn cursor-pointer"
              >
                <span>Explore Preview</span>
                <ArrowRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 2: Organic Gardening Essentials */}
          <div className="group relative bg-white rounded-3xl overflow-hidden border border-emerald-100 shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col justify-between">
            <div>
              {/* Image banner */}
              <div className="relative h-64 sm:h-72 overflow-hidden bg-emerald-950">
                <img
                  src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1000&q=80"
                  alt="Organic Gardening Essentials"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
                
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="bg-green-600/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                    <Leaf className="w-3.5 h-3.5" /> 100% Organic
                  </span>
                  <span className="bg-black/60 backdrop-blur-xs text-emerald-200 text-xs font-medium px-3 py-1 rounded-full">
                    Heirloom Desi Seeds
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold block mb-1">
                    Green Sanctuary
                  </span>
                  <h3 className="text-2xl font-serif font-bold text-white">
                    Organic Gardening Essentials
                  </h3>
                </div>
              </div>

              {/* Body details */}
              <div className="p-6 sm:p-8">
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  Grow your own nutrient-rich kitchen garden with ease. Handcrafted Terracotta Planters, non-hybrid Heirloom Desi Seeds, Fortified Vermicompost, Neem Khali bio-fertilizers, and pure Brass mist sprayers.
                </p>

                {/* Feature highlight tags */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900">
                    <Leaf className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Non-GMO Native Desi Seeds</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900">
                    <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Porous Breathable Terracotta</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900">
                    <Leaf className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Nutrient-Dense Bio-Compost</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900">
                    <HeartHandshake className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Complete Starter Grow Kits</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100/60">
              <button
                onClick={() => handleOpenNotify("gardening", "Organic Gardening Essentials")}
                className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Notify Me for Early Access</span>
              </button>

              <button
                onClick={() => navigate("/coming-soon/gardening")}
                className="inline-flex items-center gap-1.5 text-emerald-800 hover:text-green-900 text-xs sm:text-sm font-semibold transition-colors group/btn cursor-pointer"
              >
                <span>Explore Preview</span>
                <ArrowRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* VIP Launch Privilege Banner */}
        <div className="max-w-4xl mx-auto bg-linear-to-r from-gray-900 via-stone-900 to-green-950 rounded-3xl p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Early Reservation Privilege
              </span>
              <h4 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">
                Get an Exclusive 15% Launch Discount
              </h4>
              <p className="text-stone-300 text-xs sm:text-sm max-w-xl leading-relaxed">
                Join our private VIP launch register. You will receive first notification 48 hours prior to public release with a single-use 15% privilege coupon.
              </p>
            </div>

            <button
              onClick={() => handleOpenNotify("both", "All Upcoming Collections")}
              className="shrink-0 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-950 font-bold px-7 py-3.5 rounded-2xl shadow-xl hover:shadow-amber-500/20 transition-all text-sm transform active:scale-95 cursor-pointer"
            >
              Join VIP Launch List
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <LaunchNotifyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultCategory={selectedCategory}
        itemInterestTitle={interestTitle}
        source="home_showcase"
      />
    </section>
  );
};

export default ComingSoonShowcase;
