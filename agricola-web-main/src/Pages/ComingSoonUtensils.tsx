import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Footer from "../components/layout/Footer";
import { LaunchNotifyModal } from "../components/common/LaunchNotifyModal";

const UTENSILS_IMAGE = "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=85";

const previewItems = [
  {
    title: "Handmade Pure Kansa Bronze Dinnerware",
    desc: "Bell metal alloy (78% Copper, 22% Tin) that alkalizes food and enhances digestion naturally.",
    icon: "dinner_dining",
  },
  {
    title: "Seasoned Heavy Cast Iron Cookware",
    desc: "Pre-seasoned with pure cold-pressed gingelly oil for natural non-stick cooking without toxic PTFE.",
    icon: "skillet",
  },
  {
    title: "Single-Piece Neem Wood Ladles",
    desc: "Antibacterial, naturally heat resistant, and crafted without synthetic lacquers or varnishes.",
    icon: "restaurant",
  },
  {
    title: "Natural Soapstone & Clay Kadhais",
    desc: "Slow-heat retention cookware that locks in 90% more micronutrients during traditional cooking.",
    icon: "soup_kitchen",
  },
];

export default function ComingSoonUtensils() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[#434936] mb-6">
          <Link to="/" className="hover:text-[#486800]">Home</Link>
          <span>/</span>
          <span className="text-[#1b1c1a]">AgriCola Heritage Cookware</span>
        </div>

        {/* Hero Section (Stitch Design) */}
        <section className="relative overflow-hidden rounded-3xl bg-[#1e3a1f] text-white p-8 sm:p-12 lg:p-16 shadow-[0_16px_36px_-10px_rgba(30,58,31,0.2)] mb-12">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#ffdcc3]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ffdcc3]/20 border border-[#f78e27]/40 text-[#ffdcc3] text-xs font-bold backdrop-blur-md self-start">
                <Sparkles className="w-3.5 h-3.5 text-[#f78e27]" />
                <span>Launching Spring 2026 • Heirloom Cookware</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
                Cook in Harmony with Nature. <br />
                <span className="text-[#f78e27]">Zero Toxins. Pure Kansa &amp; Iron.</span>
              </h1>

              <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl">
                Rediscover ancient Ayurvedic wellness in modern kitchens. Hand-forged bronze Kansa thalis, pre-seasoned cast iron skillets, and hand-carved medicinal neem wood ladles crafted by hereditary Indian artisans.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="px-8 py-4 rounded-full bg-[#f78e27] hover:bg-[#ffb77d] text-[#1e3a1f] text-sm sm:text-base font-black shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">notifications_active</span>
                  <span>Notify Me on Launch (15% VIP Off)</span>
                </button>
              </div>
            </div>

            {/* Hero Image */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/20">
                <img
                  src={UTENSILS_IMAGE}
                  alt="Artisanal Bronze & Cast Iron Utensils"
                  className="w-full h-80 lg:h-96 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl text-[#1e3a1f] text-xs font-bold flex items-center justify-between">
                  <span>100% Lab Tested Lead-Free Kansa</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#ffdcc3] text-[#904d00] text-[10px]">
                    Artisan Made
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Collection Pillars Grid */}
        <section className="mb-12">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold text-[#f78e27] uppercase tracking-wider block">
              Heirloom Craftsmanship
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] mt-1">
              Nontoxic Heritage Cookware Collection
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {previewItems.map((it, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#ffdcc3] text-[#904d00] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">{it.icon}</span>
                </div>
                <h3 className="text-sm font-bold text-[#1e3a1f]">{it.title}</h3>
                <p className="text-xs text-[#434936] leading-relaxed">{it.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
      <LaunchNotifyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultCategory="utensils"
        itemInterestTitle="AgriCola Heritage Cookware"
      />
    </div>
  );
}
