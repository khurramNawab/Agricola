import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    q: "How fresh are your products?",
    a: "Every batch is sourced directly from partner farms and packed in small lots, so your order reaches you soon after harvest — never sitting in a warehouse for months.",
  },
  {
    q: "How should I store my produce?",
    a: "Store in a cool, dry place away from direct light and moisture; refrigerate perishables. Stored well, our products stay fresh for as long as possible.",
  },
  {
    q: "Do you ship across India?",
    a: "Yes. We deliver pan-India, with most orders arriving in 3–6 business days. You'll get a tracking link as soon as your order ships.",
  },
  {
    q: "Are your products organic and certified?",
    a: "Many of our products are organic-certified, and all are sourced from farms that grow with care for the soil and community. Look for the certification badge on each product.",
  },
  {
    q: "What is your return policy?",
    a: "If a product arrives damaged or you're not satisfied, reach out within 7 days of delivery and we'll arrange a replacement or refund.",
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
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="py-16 container mx-auto px-4">
      <h3 className="font-serif text-3xl text-center text-green-600 mb-10">
        Frequently Asked Questions
      </h3>
      <div className="max-w-3xl mx-auto">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className={`border-b border-gray-200 ${
                isOpen ? "bg-gray-50" : ""
              } rounded-lg`}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                className="w-full flex items-center justify-between text-left px-4 py-4 cursor-pointer"
                aria-expanded={isOpen}
              >
                <span className="font-medium text-gray-900">{faq.q}</span>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm text-gray-600">{faq.a}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FAQSection;
