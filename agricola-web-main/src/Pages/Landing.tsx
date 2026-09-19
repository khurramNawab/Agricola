import Footer from "../components/layout/Footer";
import Hero from "../components/sections/Hero";
import CategoriesSection from "../components/sections/CategoriesSection";
import BestSellersSection from "../components/sections/BestSellersSection";
import WhyChooseUsSection from "../components/sections/WhyChooseUsSection";
import TestimonialsSection from "../components/sections/TestimonialsSection";
import FAQSection from "../components/sections/FAQSection";
import PromoBannerSection from "../components/sections/PromoBannerSection";

export const Landing = () => {
  return (
    <div id="webcrumbs" className="bg-[#fbf9f6] min-h-screen flex flex-col">
      {/* Top Harvest Announcement Pill */}
      <div className="w-full flex items-center justify-center pt-3 pb-1 px-3 sm:px-4">
        <div className="inline-flex items-center justify-center text-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-full bg-[#c9ecc4]/80 backdrop-blur-md text-[#2f4f2f] shadow-2xs text-[11px] sm:text-xs font-semibold border border-[#84b817]/25 max-w-full">
          <span className="w-2 h-2 rounded-full bg-[#84b817] animate-pulse shrink-0"></span>
          <span className="truncate sm:overflow-visible">
            Fresh Harvest: Mithila Jumbo Makhana &amp; Lakadong Turmeric
          </span>
          <a
            href="#bestsellers"
            className="text-[#1e3a1f] font-bold underline hover:text-[#84b817] transition-colors whitespace-nowrap shrink-0 ml-1"
          >
            Shop Batches →
          </a>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1540px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <Hero />

        {/* Live Farm Origin & Freshness Metric Bar */}
        <section className="w-full py-5 my-3 bg-white/60 border-y border-[#1e3a1f]/05">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-center">
            <div className="flex items-center gap-3.5 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-xl shrink-0">
                🌾
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[#1b1c1a] block leading-tight">
                  2,480+
                </span>
                <span className="text-xs text-[#434936] font-medium">
                  Empowered Agrarians
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3.5 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-xl shrink-0">
                🏷️
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[#1b1c1a] block leading-tight">
                  100%
                </span>
                <span className="text-xs text-[#434936] font-medium">
                  Mithila GI Heritage
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3.5 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-xl shrink-0">
                🧪
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[#1b1c1a] block leading-tight">
                  0%
                </span>
                <span className="text-xs text-[#434936] font-medium">
                  Chemical Adulteration
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3.5 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#c9ecc4] flex items-center justify-center text-xl shrink-0">
                ⚡
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[#1b1c1a] block leading-tight">
                  &lt;24h
                </span>
                <span className="text-xs text-[#434936] font-medium">
                  Moisture Sealed Dispatch
                </span>
              </div>
            </div>
          </div>
        </section>

        <CategoriesSection />
        <BestSellersSection />
        <WhyChooseUsSection />
        <TestimonialsSection />
        <FAQSection />

        <PromoBannerSection />
      </main>
      <Footer />
    </div>
  );
};
