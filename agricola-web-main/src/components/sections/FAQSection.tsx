import React, { useState } from "react";

const faqs = [
  {
    q: "How do you independently verify organic claims?",
    a: "AgriCola works exclusively with certified organic farms and agrarian cooperatives. Furthermore, every batch brought to our certified fulfillment facilities undergoes rigorous laboratory testing for purity, pesticide residues, and heavy metals before packaging.",
  },
  {
    q: "Where are your fulfillment warehouses located?",
    a: "We operate state-of-the-art climate-monitored facilities handling Mithila Phool Makhana, cold-pressed mustard oil, organic seeds, and northern grains. This allows immediate dispatch without intermediary warehousing.",
  },
  {
    q: "What is the shelf life and packaging standard?",
    a: "Our packaging utilizes multi-layer kraft barrier pouches and nitrogen-flushed food-grade canisters. This preserves natural volatile oils and shields against ambient Indian humidity. Shelf life is 9 to 12 months from packing date, with no artificial preservatives or sulfur additives used.",
  },
  {
    q: "How fresh are your products?",
    a: "Every batch is sourced directly from partner farms and packed in small lots, so your order reaches you soon after harvest — never sitting in a warehouse for months.",
  },
  {
    q: "Do you ship across India?",
    a: "Yes. We deliver pan-India, with most orders arriving in 3–6 business days. You'll get a tracking link as soon as your order ships.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards, UPI, net banking, and popular wallets — processed securely through our Razorpay checkout. Your payment details never touch our servers.",
  },
  {
    q: "Do you offer gift packs or bulk orders?",
    a: "Absolutely. Many of our products make wonderful gifts, and we offer special pricing on bulk and corporate orders. Reach out via our Contact page and we'll help you put together the perfect order.",
  },
];

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-16 container mx-auto px-4 max-w-[1540px] 2xl:max-w-[1600px] w-full">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-[#486800] text-xs font-bold uppercase tracking-wider bg-[#c9ecc4]/50 px-3 py-1 rounded-full">
            Clarity &amp; Assurance
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1e3a1f] mt-3 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-[#434936] text-sm max-w-lg mx-auto mt-2">
            Everything you need to know about our harvest origins, testing standards, and logistics.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`rounded-2xl overflow-hidden transition-all duration-200 shadow-sm ${
                  isOpen
                    ? "bg-white/95 backdrop-blur-xl border border-[#84b817]/40 shadow-[0_12px_24px_-8px_rgba(30,58,31,0.08)]"
                    : "bg-white/70 backdrop-blur-md border border-gray-200/80 hover:bg-white"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between text-left px-6 py-4 cursor-pointer gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-[#1b1c1a] text-sm sm:text-base">{faq.q}</span>
                  <span
                    className={`material-symbols-outlined text-[#486800] transition-transform duration-300 shrink-0 ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-[#434936] text-xs sm:text-sm leading-relaxed border-t border-gray-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
