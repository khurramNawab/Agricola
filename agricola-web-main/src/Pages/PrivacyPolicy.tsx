import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-[#434936] mb-6">
          <Link to="/" className="hover:text-[#486800]">Home</Link>
          <span>/</span>
          <span className="text-[#1b1c1a]">Privacy Policy</span>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xs border border-gray-100 flex flex-col gap-6 leading-relaxed">
          <div className="border-b border-gray-100 pb-6">
            <span className="text-xs font-extrabold text-[#84b817] uppercase tracking-wider block">
              AgriCola Legal &amp; Trust
            </span>
            <h1 className="text-3xl font-black text-[#1e3a1f] tracking-tight mt-1">
              Privacy Policy &amp; Data Integrity
            </h1>
            <p className="text-xs text-gray-500 mt-2">
              Last Updated: March 2026 • Compliant with Digital Personal Data Protection (DPDP) Act 2023
            </p>
          </div>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">1. Introduction &amp; Commitment</h2>
            <p>
              AgriCola Organics India Pvt. Ltd. (“AgriCola”, “we”, “our”, or “us”) respects your privacy and is dedicated to protecting your personal information. This Privacy Policy details how we collect, use, disclose, and safeguard customer data when you interact with our storefront website, mobile applications, and cold-chain delivery fulfillment ecosystem.
            </p>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">2. Information We Collect</h2>
            <p>
              When you purchase or browse our products, we collect the following types of information:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contact &amp; Account Data:</strong> Name, 10-digit mobile number, email address, and Firebase authentication credentials.</li>
              <li><strong>Delivery &amp; Geo-location Details:</strong> Shipping address, Indian postal PIN codes, state, and approximate GPS coordinates (used solely to check express delivery serviceability when permitted).</li>
              <li><strong>Order &amp; Transaction History:</strong> Items purchased, pack weights, transaction IDs, invoice logs, and courier AWB routing milestones.</li>
              <li><strong>Payment Integrity:</strong> Payment processing is handled via PCI-DSS compliant gateways (Razorpay / UPI). AgriCola never stores raw credit card numbers, CVVs, or net banking passwords.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">3. How We Use Your Data</h2>
            <p>
              We process your data exclusively for operational fulfillment:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Generating GST invoices and courier labels (Shiprocket &amp; Ekart logistics integration).</li>
              <li>Sending SMS / WhatsApp dispatch alerts, tracking numbers, and delivery milestone notifications.</li>
              <li>Detecting fraudulent orders or unauthorized chargeback attempts.</li>
              <li>Improving farm batch sourcing.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">4. Third-Party Sharing</h2>
            <p>
              We do not sell, rent, or monetize shopper data. Data is shared strictly with essential logistical and financial partners:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Logistics Partners:</strong> Shiprocket, Ekart Logistics, Bluedart, Xpressbees, and Delhivery for physical delivery.</li>
              <li><strong>Payment Gateway:</strong> Razorpay Software Ltd.</li>
              <li><strong>Cloud Infrastructure:</strong> Secure enterprise cloud servers with 256-bit TLS encryption.</li>
            </ul>
          </section>

          <section className="space-y-3 text-xs sm:text-sm text-[#434936]">
            <h2 className="text-base font-bold text-[#1e3a1f]">5. Grievance Officer &amp; Inquiries</h2>
            <p>
              If you wish to review, update, or request deletion of your personal data, contact our designated Grievance Officer:
            </p>
            <div className="bg-[#f5f3f0] p-4 rounded-2xl text-xs space-y-1">
              <p><strong>Grievance Officer:</strong> AgriCola Legal &amp; Data Protection Desk</p>
              <p><strong>Email:</strong> <a href="mailto:privacy@agricola.co.in" className="text-[#486800] underline">privacy@agricola.co.in</a></p>
              <p><strong>Address:</strong> AgriCola Central Facility, Purnia, Bihar - 854301</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
