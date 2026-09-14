import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Footer from "../components/layout/Footer";
import { LaunchNotifyModal } from "../components/common/LaunchNotifyModal";

const GARDENING_IMAGE = "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1600&q=85";

const previewItems = [
  {
    title: "Indigenous Non-Hybrid Heirloom Seeds",
    desc: "100% open-pollinated Indian heritage seed varieties with zero synthetic seed dressing.",
    icon: "psychology_alt",
  },
  {
    title: "Living Microbe Vermicompost",
    desc: "Enriched with cow dung bio-culture and neem cake for active root microbiome health.",
    icon: "eco",
  },
  {
    title: "Breathable Porous Terracotta Planters",
    desc: "Handcrafted clay pots from local potters ensuring optimal root aeration and natural cooling.",
    icon: "potted_plant",
  },
  {
    title: "Cold-Pressed Neem Pest Tonic",
    desc: "Pure Azadirachtin organic bio-spray for chemical-free bug and aphid protection.",
    icon: "sanitizer",
  },
];

export default function ComingSoonGardening() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[#434936] mb-6">
          <Link to="/" className="hover:text-[#486800]">Home</Link>
          <span>/</span>
          <span className="text-[#1b1c1a]">AgriCola Garden Sanctuary</span>
        </div>

        {/* Hero Section (Stitch Design) */}
        <section className="relative overflow-hidden rounded-3xl bg-[#1e3a1f] text-white p-8 sm:p-12 lg:p-16 shadow-[0_16px_36px_-10px_rgba(30,58,31,0.2)] mb-12">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#84b817]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#c9ecc4]/20 border border-[#84b817]/40 text-[#c9ecc4] text-xs font-bold backdrop-blur-md self-start">
                <Sparkles className="w-3.5 h-3.5 text-[#84b817]" />
                <span>Launching Spring 2026 • Harvest Sanctuary</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
                Grow Your Own Food. <br />
                <span className="text-[#84b817]">Pure. Organic. Chemical-Free.</span>
              </h1>

              <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl">
                Transform your balcony, terrace, or backyard into a thriving organic haven with non-hybrid native heirloom seeds, living soil composts, porous terracotta planters, and heirloom brass tools.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="px-8 py-4 rounded-full bg-[#84b817] hover:bg-[#a1d73a] text-[#1e3a1f] text-sm sm:text-base font-black shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
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
                  src={GARDENING_IMAGE}
                  alt="Organic Balcony Garden"
                  className="w-full h-80 lg:h-96 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl text-[#1e3a1f] text-xs font-bold flex items-center justify-between">
                  <span>100% Indigenous Native Strains</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#c9ecc4] text-[#486800] text-[10px]">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Collection Pillars Grid */}
        <section className="mb-12">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold text-[#84b817] uppercase tracking-wider block">
              What We Are Cultivating
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] mt-1">
              The Complete Farm-To-Balcony Ecosystem
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {previewItems.map((it, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#c9ecc4] text-[#486800] flex items-center justify-center">
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
        defaultCategory="gardening"
        itemInterestTitle="AgriCola Garden Sanctuary"
      />
    </div>
  );
}
