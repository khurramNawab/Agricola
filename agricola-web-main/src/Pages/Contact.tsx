import { useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSubmitted(true);
  };

  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Contact &amp; Farmer Support</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#486800]" />
            <span className="text-xs font-bold text-[#434936]">
              Direct Harvest Help Desk Active
            </span>
          </div>
        </section>

        {/* Hero Headline & 2-Col Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Contact Info & Support Channels (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col gap-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#486800] tracking-wider bg-[#c9ecc4]/60 px-3 py-1 rounded-full">
                  We're Here For You
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] tracking-tight mt-2 mb-3">
                  Get in Touch with Our Harvest Team
                </h1>
                <p className="text-xs sm:text-sm text-[#434936] leading-relaxed">
                  Have questions regarding soil-tested single-origin batches, delivery tracking, or wholesale farmer partnerships? Reach out directly.
                </p>
              </div>

              <div className="flex flex-col gap-4 border-t border-gray-100 pt-5 text-xs text-[#434936]">
                {/* Phone Contact */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#c9ecc4] text-[#486800] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">call</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Customer Care Hotline</span>
                    <a
                      href="tel:+919012659000"
                      className="text-base font-extrabold text-[#1e3a1f] hover:text-[#486800] transition-colors"
                    >
                      +91 9012659000
                    </a>
                    <span className="text-[11px] text-gray-500 block mt-0.5">
                      Monday to Saturday, 10:00 AM – 7:00 PM IST
                    </span>
                  </div>
                </div>

                {/* Email Contact */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#c9ecc4] text-[#486800] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">mail</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Official Inquiries &amp; Invoices</span>
                    <a
                      href="mailto:support@agricola.co.in"
                      className="text-sm sm:text-base font-extrabold text-[#1e3a1f] hover:text-[#486800] transition-colors"
                    >
                      support@agricola.co.in
                    </a>
                    <span className="text-[11px] text-gray-500 block mt-0.5">
                      Typical response within 2–4 business hours
                    </span>
                  </div>
                </div>

                {/* Cooperative HQ */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#c9ecc4] text-[#486800] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">storefront</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Packaging & Quality Lab</span>
                    <p className="text-xs font-bold text-[#1e3a1f] leading-snug">
                      AgriCola Natural Foods Ltd.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Interactive Message Form (7 Cols) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col gap-6">
              <div className="pb-3 border-b border-gray-100">
                <h2 className="text-lg font-black text-[#1e3a1f]">Send an Inquiry</h2>
                <p className="text-xs text-[#434936]">
                  Fill out the details below and our customer experience team will respond shortly.
                </p>
              </div>

              {submitted ? (
                <div className="bg-[#c9ecc4]/40 rounded-3xl p-8 text-center border border-[#84b817]/30 my-4">
                  <div className="w-14 h-14 rounded-full bg-[#486800] text-white flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm">
                    <span className="material-symbols-outlined text-2xl">check</span>
                  </div>
                  <h3 className="text-lg font-black text-[#1e3a1f] mb-1">Message Received!</h3>
                  <p className="text-xs text-[#434936] max-w-md mx-auto leading-relaxed">
                    Thank you, <strong>{form.name}</strong>. Your inquiry has been forwarded to our support coordinators. We will reach out to <strong>{form.email}</strong> shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setForm({ name: "", email: "", message: "" });
                    }}
                    className="mt-5 px-6 py-2.5 rounded-full bg-[#1e3a1f] hover:bg-[#486800] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="e.g. Priyanshu Sharma"
                        className="w-full bg-[#f5f3f0] rounded-2xl px-4 py-3 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="e.g. priyanshu@example.com"
                        className="w-full bg-[#f5f3f0] rounded-2xl px-4 py-3 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="text-xs font-bold text-[#1e3a1f] block mb-1.5">
                      How Can We Help You? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      required
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Please describe your question or issue in detail…"
                      className="w-full bg-[#f5f3f0] rounded-2xl p-4 text-xs font-bold text-[#1e3a1f] placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#84b817] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#486800] hover:bg-[#1e3a1f] text-white text-sm font-extrabold py-3.5 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <span>Send Message to Support</span>
                    <span className="material-symbols-outlined text-base">send</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
