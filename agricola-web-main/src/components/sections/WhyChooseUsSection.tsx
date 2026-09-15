import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: "local_shipping",
    iconBg: "bg-[#c9ecc4] text-[#4e6c4c]",
    title: "100% Traceable to Farms",
    text: "No generic bulk market pooling. You know the exact district, cooperative leader, and harvest week of every seed packet.",
    link: "Explore Farm Direct",
  },
  {
    icon: "currency_rupee",
    iconBg: "bg-[#84b817]/20 text-[#486800]",
    title: "Direct Source Pricing",
    text: "Eliminating multi-tiered mandi brokers allows us to offer 15–30% lower prices while guaranteeing premium payment to smallholders.",
    link: "Fair Trade Audits",
  },
  {
    icon: "warehouse",
    iconBg: "bg-[#ffdcc3] text-[#904d00]",
    title: "Direct Farm Fulfillment",
    text: "Same-day dispatches directly from our temperature-controlled certified organic facilities.",
    link: "2–4 Day Delivery Pan-India",
  },
  {
    icon: "biotech",
    iconBg: "bg-[#c9ecc4]/70 text-[#486647]",
    title: "Triple Lab Tested",
    text: "Screened by independent certified testing laboratories for lead, cadmium, pesticide residues, aflatoxins, and microbial safety prior to packing.",
    link: "View COA Lab Reports",
  },
];

const WhyChooseUsSection: React.FC = () => {
  const navigate = useNavigate();
  const [orderInput, setOrderInput] = useState("");

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const query = orderInput.trim().toUpperCase();
    if (!query) {
      navigate("/track");
      return;
    }
    navigate(`/track?orderId=${encodeURIComponent(query)}`);
  };

  const steps = [
    { title: "Confirmed", desc: "Packed & Sealed" },
    { title: "Dispatched", desc: "From Certified Facility" },
    { title: "In Transit", desc: "On Route" },
    { title: "Out for Delivery", desc: "Local Courier" },
    { title: "Delivered", desc: "At Kitchen" },
  ];

  return (
    <section id="why-choose-us" className="relative pt-16 pb-24 overflow-hidden bg-[#fbf9f6]">
      <div className="container mx-auto px-4 max-w-[1540px] 2xl:max-w-[1600px] w-full relative z-10 flex flex-col gap-16">

        {/* ── Redesigned Track Your Order Hero Banner ── */}
        <div
          id="track-order-section"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d1d0e] via-[#152e16] to-[#09150a] text-[#faf8f5] p-8 lg:p-12 shadow-[0_24px_50px_-12px_rgba(15,35,16,0.5)] border border-emerald-500/25"
        >
          {/* Ambient Lighting Accents */}
          <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#84b817]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Interactive Tracking Inputs & Real-Time Stepper */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-[#c9ecc4] text-xs font-bold w-fit shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#bcf455] animate-pulse" />
                <span className="material-symbols-outlined text-sm text-[#bcf455]">local_shipping</span>
                <span>LIVE DISPATCH TRACKING • PAN-INDIA EXPRESS</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-white">
                Track Your Pure Harvest • Live Order Status
              </h2>

              <p className="text-xs sm:text-sm text-[#c3dac0] max-w-xl leading-relaxed">
                Enter your Order ID (e.g. <span className="text-[#bcf455] font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded">ORD-2026-9041</span>) to inspect live dispatch milestones, fulfillment facility, and real-time transit status.
              </p>

              {/* Order ID Input Form */}
              <form onSubmit={handleTrack} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-lg mt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    value={orderInput}
                    onChange={(e) => setOrderInput(e.target.value)}
                    placeholder="Enter Order ID (e.g. ORD-2026-9041)"
                    className="w-full bg-white text-[#1b1c1a] pl-10 pr-4 py-3.5 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-[#84b817]/40 shadow-md border border-gray-100"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#84b817] to-[#719f12] hover:from-[#719f12] hover:to-[#5e840d] text-white text-xs sm:text-sm font-extrabold px-6 py-3.5 rounded-2xl transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(132,184,23,0.4)] active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">local_shipping</span>
                  <span>Track Order</span>
                </button>
              </form>

              {/* Live Tracking Information Card */}
              <div className="mt-2 p-5 sm:p-6 rounded-2xl bg-black/35 backdrop-blur-xl border border-white/15 text-[#faf8f5] space-y-4 shadow-xl">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#bcf455] animate-pulse" />
                    <span className="font-bold text-sm text-[#bcf455]">
                      Direct Farm Dispatch &amp; Cold-Chain Tracking
                    </span>
                  </div>
                  <span className="text-xs text-[#c9ecc4] font-medium hidden sm:inline">
                    Pan-India Verified Logistics
                  </span>
                </div>

                {/* 5-Step Visual Stepper */}
                <div className="relative pt-2 pb-1">
                  <div className="absolute top-[22px] left-[10%] right-[10%] h-1 bg-white/15 rounded-full -z-0">
                    <div className="h-full bg-gradient-to-r from-[#84b817] to-[#bcf455] rounded-full w-2/5" />
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-center relative z-10">
                    {steps.map((st, idx) => (
                      <div key={st.title} className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mb-1.5 transition-all duration-300 ${
                            idx === 0
                              ? "bg-[#84b817] text-white"
                              : idx === 1
                              ? "bg-[#bcf455] text-[#122713] ring-4 ring-[#84b817]/50 shadow-[0_0_12px_rgba(188,244,85,0.6)]"
                              : "bg-[#182e1a] text-white/40 border border-white/10"
                          }`}
                        >
                          {idx === 0 ? "✓" : idx + 1}
                        </div>
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold truncate max-w-full ${
                            idx <= 1 ? "text-white" : "text-white/40"
                          }`}
                        >
                          {st.title}
                        </span>
                        <span className="text-[9px] text-[#aecfaa] hidden sm:block truncate max-w-full opacity-80">
                          {st.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-[#c3dac0] flex-wrap gap-2">
                  <span>Enter your order reference above to view live GPS status and courier dispatch.</span>
                  <button
                    type="button"
                    onClick={() => navigate("/track")}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#bcf455] hover:text-white transition-colors cursor-pointer group"
                  >
                    <span>Go to Tracking Portal</span>
                    <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Express Direct Fulfillment Highlight Card */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm gap-4">
              <div className="w-20 h-20 rounded-full bg-[#84b817]/20 border-2 border-[#84b817] flex items-center justify-center text-white text-3xl font-bold shadow-inner">
                <span className="material-symbols-outlined text-4xl text-[#bcf455]">
                  local_shipping
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-lg text-white">Express Direct Fulfillment</h4>
                <p className="text-xs text-[#aecfaa] max-w-xs leading-relaxed">
                  Dispatched directly from state-of-the-art certified temperature-controlled facilities.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full max-w-xs text-left">
                <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] text-[#bcf455] font-bold uppercase block">Delivery SLA</span>
                  <span className="text-xs font-extrabold text-white">2–4 Days Pan-India</span>
                </div>
                <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] text-[#bcf455] font-bold uppercase block">Cold Packaging</span>
                  <span className="text-xs font-extrabold text-white">Optimal 18°C Sealed</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#c9ecc4] bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                <span className="material-symbols-outlined text-sm text-[#bcf455]">check_circle</span>
                <span>Direct Courier Sync: Shiprocket &amp; Ekart</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4 Feature Pillars (Uncompromised Integrity) ── */}
        <div className="flex flex-col gap-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-[#486800] text-xs font-bold uppercase tracking-wider bg-[#c9ecc4]/50 px-3 py-1 rounded-full">
              The Purity Guarantee
            </span>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-[#1b1c1a] mt-3 tracking-tight">
              Why AgriCola Stands Apart
            </h3>
            <p className="text-sm text-[#434936] mt-2 leading-relaxed">
              We bridge the gap between conscientious organic farmers and conscious Indian households with uncompromised integrity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-white p-7 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_32px_-8px_rgba(30,58,31,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-xs ${feature.iconBg}`}>
                    <span className="material-symbols-outlined text-2xl">{feature.icon}</span>
                  </div>
                  <h4 className="font-extrabold text-base text-[#1b1c1a] mb-2 group-hover:text-[#486800] transition-colors">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-[#434936] leading-relaxed">
                    {feature.text}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center gap-1 text-xs font-bold text-[#486800] group-hover:gap-2 transition-all">
                  <span>{feature.link}</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default WhyChooseUsSection;
