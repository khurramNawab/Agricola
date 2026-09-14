import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";

export default function TermsConditions() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[#434936] mb-6">
          <Link to="/" className="hover:text-[#486800]">Home</Link>
          <span>/</span>
          <span className="text-[#1b1c1a]">Terms &amp; Conditions</span>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xs border border-gray-100 flex flex-col gap-6 leading-relaxed">
          <div className="border-b border-gray-100 pb-6">
            <span className="text-xs font-extrabold text-[#84b817] uppercase tracking-wider block">
              AgriCola Legal Terms
            </span>
            <h1 className="text-3xl font-black text-[#1e3a1f] tracking-tight mt-1">
              Terms &amp; Conditions
            </h1>
            <p className="text-xs text-gray-500 mt-2">
              Last Updated: March 2026 • AgriCola Organics India Pvt Ltd
            </p>
          </div>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">1. Agreement to Terms</h2>
            <p>
              By accessing or using the AgriCola platform (agricola.co.in) and purchasing farm-direct organic goods, you agree to be bound by these Terms &amp; Conditions. If you do not agree, please do not use our website.
            </p>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">2. Organic Quality &amp; Batch Traceability</h2>
            <p>
              All products sold on AgriCola are 100% farm-sourced from partner agrarian cooperatives in Bihar, Haryana, and Uttarakhand. Every batch is tested for moisture, pesticide residue, and purity before eco-vacuum sealing. Batch certificates (COAs) can be reviewed using the batch code printed on your pouch.
            </p>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">3. Pricing, GST &amp; Payment</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>All prices listed on the storefront are in Indian Rupees (₹) and include applicable GST taxes.</li>
              <li>Free shipping is automatically granted on all orders exceeding ₹799.</li>
              <li>Prepaid payments via Razorpay (UPI, Debit/Credit Card, Net Banking) and Cash on Delivery (COD) are supported.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">4. Delivery &amp; Dispatch Timeline</h2>
            <p>
              Orders are dispatched within 24 business hours from our certified central fulfillment facilities. Standard delivery transit is 2 to 4 business days across metro cities and 3 to 6 days for remote regions. Real-time AWB courier tracking is provided via SMS and on the <Link to="/track" className="text-[#486800] underline font-bold">Track Order page</Link>.
            </p>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">5. Returns &amp; Freshness Guarantee</h2>
            <p>
              We stand behind every grain and harvest. If you receive a damaged pouch, broken seal, or quality issue, please refer to our <Link to="/return-policy" className="text-[#486800] underline font-bold">Return &amp; Refund Policy</Link> within 48 hours of delivery for a hassle-free replacement or refund.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
