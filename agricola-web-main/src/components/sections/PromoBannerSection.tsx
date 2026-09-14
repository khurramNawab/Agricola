import React, { useState } from "react";

interface PromoBannerSectionProps {
  promoCode?: string;
  discountText?: string;
}

const PromoBannerSection: React.FC<PromoBannerSectionProps> = ({
  promoCode = "AGRIPURE",
  discountText = "10%",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(promoCode);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  return (
    <section className="w-full py-6 mb-10">
      <div className="relative overflow-hidden rounded-3xl bg-white/80 backdrop-blur-xl p-6 sm:p-8 lg:p-12 shadow-[0_16px_36px_-10px_rgba(30,58,31,0.08)] border border-[#84b817]/20 flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-[#c9ecc4]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#84b817]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex-1 max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-[#c9ecc4] text-[#1e3a1f] text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider mb-3 shadow-xs">
            <span className="material-symbols-outlined text-sm font-bold">redeem</span>
            <span>Special Welcome Invitation</span>
          </div>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl text-[#1b1c1a] font-black tracking-tight leading-tight">
            Save {discountText} on Your First Pure Farm Order
          </h3>
          <p className="text-sm sm:text-base text-[#434936] mt-2.5 leading-relaxed">
            Use promotional code{" "}
            <strong className="text-[#486800] font-extrabold tracking-wider bg-[#c9ecc4]/40 px-1.5 py-0.5 rounded">
              {promoCode}
            </strong>{" "}
            at checkout. No minimum cart value. Includes free doorstep dispatch across India.
          </p>
        </div>

        <div className="relative z-10 w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
          {/* Coupon Code Pill */}
          <div className="bg-[#fbf9f6] border border-[#1e3a1f]/10 px-5 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#434936]">
                Coupon Code
              </span>
              <span className="text-lg sm:text-xl text-[#486800] font-black tracking-widest">
                {promoCode}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="p-2.5 rounded-xl bg-white border border-gray-200/80 hover:bg-[#c9ecc4]/40 text-[#1e3a1f] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Copy code"
              type="button"
            >
              <span className="material-symbols-outlined text-lg">
                {copied ? "check" : "content_copy"}
              </span>
              {copied && (
                <span className="text-xs font-bold text-[#486800]">Copied!</span>
              )}
            </button>
          </div>

          {/* CTA Button */}
          <a
            href="#bestsellers"
            className="bg-[#486800] text-white hover:bg-[#1e3a1f] text-sm sm:text-base px-7 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <span>Shop Fresh Now</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default PromoBannerSection;
