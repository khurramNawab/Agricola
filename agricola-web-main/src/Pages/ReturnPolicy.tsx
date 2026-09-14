import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";

export default function ReturnPolicy() {
  return (
    <div id="webcrumbs" className="min-h-screen bg-[#fbf9f6] flex flex-col font-sans">
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 lg:px-8 pt-6 pb-16">
        {/* Top Breadcrumb */}
        <section className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-[#434936]">
            <Link to="/products" className="hover:text-[#486800] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span>Marketplace</span>
            </Link>
            <span className="material-symbols-outlined text-xs text-gray-300">chevron_right</span>
            <span className="text-[#486800] font-bold">Return &amp; Refund Policy</span>
          </nav>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#1e3a1f]/10 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-[#486800]">verified_user</span>
            <span className="text-xs font-bold text-[#434936]">
              100% Purity &amp; Freshness Guarantee
            </span>
          </div>
        </section>

        {/* Policy Content Card */}
        <article className="bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-gray-100 flex flex-col gap-6 text-xs sm:text-sm text-[#434936] leading-relaxed">
          <header className="border-b border-gray-100 pb-5">
            <span className="text-[10px] uppercase font-bold text-[#486800] tracking-wider bg-[#c9ecc4]/60 px-3 py-1 rounded-full">
              Customer Assurance
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1e3a1f] tracking-tight mt-2 mb-1">
              Return, Replacement &amp; Refund Policy
            </h1>
            <p className="text-xs text-gray-400 font-medium">
              Effective Date: August 2026 • Valid across all direct online orders
            </p>
          </header>

          <p>
            At <strong>AgriCola</strong>, every batch of Mithila Makhana, cold-pressed mustard oil, turmeric, and organic seeds undergoes stringent lab testing and nitrogen-flushed eco packaging. If your shipment ever fails to meet our uncompromising purity standards, our zero-friction policy ensures you are promptly refunded or sent a fresh replacement.
          </p>

          {/* Reporting Windows */}
          <section className="bg-[#f5f3f0] rounded-2xl p-5 sm:p-6 border border-gray-200/60">
            <h2 className="text-sm sm:text-base font-black text-[#1e3a1f] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#486800]">schedule</span>
              <span>Reporting Windows by Category</span>
            </h2>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-[#486800] mt-0.5">check_circle</span>
                <span>
                  <strong>Perishable &amp; Fresh Superfoods</strong> (Fresh fruits, seasonal harvests, cold-pressed oils): Report any issue within <strong>48 hours</strong> of delivery receipt.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-[#486800] mt-0.5">check_circle</span>
                <span>
                  <strong>Pantry &amp; Dry Sealed Lots</strong> (Mithila Makhana, whole spices, chia/flax seeds, grains): Report within <strong>7 days</strong> of delivery in unopened original vacuum pouches.
                </span>
              </li>
            </ul>
          </section>

          {/* Eligibility Criteria */}
          <section>
            <h2 className="text-sm sm:text-base font-black text-[#1e3a1f] mb-3">
              Qualifying Conditions for Full Replacement / Refund
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#c9ecc4]/30 border border-[#84b817]/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-lg text-[#486800] shrink-0">verified</span>
                <div>
                  <strong className="text-xs text-[#1e3a1f] block mb-0.5">Quality / Crunch Compromise</strong>
                  <span className="text-xs text-[#434936]">If product lacks crunch, freshness, or natural aroma upon first unsealing.</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#c9ecc4]/30 border border-[#84b817]/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-lg text-[#486800] shrink-0">inventory_2</span>
                <div>
                  <strong className="text-xs text-[#1e3a1f] block mb-0.5">Transit Damage or Seal Tamper</strong>
                  <span className="text-xs text-[#434936]">Package arrived torn, crushed, or vacuum barrier compromised by courier.</span>
                </div>
              </div>
            </div>
          </section>

          {/* How to initiate */}
          <section className="border-t border-gray-100 pt-5">
            <h2 className="text-sm sm:text-base font-black text-[#1e3a1f] mb-2">
              How to Initiate a Claim
            </h2>
            <p className="mb-3">
              Simply message our support coordinators with your <strong>Order Reference ID</strong> and a brief photo of the package:
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#1e3a1f]">
              <a
                href="tel:+919012659000"
                className="px-4 py-2 rounded-full bg-[#f5f3f0] hover:bg-[#eae5dc] flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-[#486800]">phone</span>
                <span>+91 9012659000</span>
              </a>
              <a
                href="mailto:support@agricola.co.in"
                className="px-4 py-2 rounded-full bg-[#f5f3f0] hover:bg-[#eae5dc] flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-[#486800]">mail</span>
                <span>support@agricola.co.in</span>
              </a>
            </div>
          </section>

          {/* Refund Timeline */}
          <section className="border-t border-gray-100 pt-5">
            <h2 className="text-sm sm:text-base font-black text-[#1e3a1f] mb-2">
              Refund Disbursement Timelines
            </h2>
            <p>
              Once your claim is validated, refunds are credited back to your original source (UPI, Credit/Debit Card, Netbanking) within <strong>5–7 banking business days</strong>. For Cash on Delivery orders, funds are deposited directly to your provided UPI ID or bank account.
            </p>
          </section>

          <footer className="border-t border-gray-100 pt-5 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-gray-400">
              Need assistance? Our team is available Mon–Sat (10 AM to 7 PM).
            </span>
            <Link
              to="/contact"
              className="text-xs font-bold text-[#486800] hover:text-[#1e3a1f] underline"
            >
              Contact Support &rarr;
            </Link>
          </footer>
        </article>
      </main>
      <Footer />
    </div>
  );
}
