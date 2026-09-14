import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaLinkedinIn,
  FaInstagram,
  FaFacebookF,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { apiFetch } from "../../lib/api";
import { AgriWordmark } from "../../assets/icons";

const quickShopLinks = [
  { label: "Grains & Pulses", to: "/products?category=grains-pulses" },
  { label: "Jumbo Phool Makhana", to: "/products" },
  { label: "Cold-Pressed Oils & Seeds", to: "/products" },
  { label: "Heritage Cookware", to: "/coming-soon/utensils", isComingSoon: true, badge: "Coming Soon", badgeColor: "amber" },
  { label: "Organic Gardening Kits", to: "/coming-soon/gardening", isComingSoon: true, badge: "Coming Soon", badgeColor: "emerald" },
];

const careLinks = [
  { label: "Track Order Status", to: "/track" },
  { label: "Lab Test Reports & Feedback", to: "/feedback" },
  { label: "Customer Support", to: "/contact" },
  { label: "Return & Refund Policy", to: "/return-policy" },
  { label: "Harvest Stories & Blog", to: "/blog" },
];

const socials = [
  {
    label: "Instagram",
    Icon: FaInstagram,
    href: "https://www.instagram.com/agricola_the_taste_of_nature/",
  },
  {
    label: "YouTube",
    Icon: FaYoutube,
    href: "https://www.youtube.com/channel/UCgEPj0SQajITm46P0SPLkNw",
  },
  { label: "X", Icon: FaXTwitter, href: "#" },
  { label: "LinkedIn", Icon: FaLinkedinIn, href: "#" },
  { label: "Facebook", Icon: FaFacebookF, href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Return Policy", to: "/return-policy" },
];

const certifications = [
  "Jaivik Bharat",
  "India Organic",
  "USDA Organic",
  "NPOP Certified",
];

const Footer: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setLoading(true);
    try {
      await apiFetch("/subscribers/notify-launch", {
        method: "POST",
        body: {
          email: cleanEmail,
          category: "both",
          source: "newsletter_footer",
        },
        auth: false,
      });
    } catch {
      // Graceful fallback for UI feedback even if offline
    } finally {
      setLoading(false);
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="w-full bg-[#f3f0ea] text-[#1b1c1a] border-t border-[#1e3a1f]/10 shadow-[0_-1px_12px_rgba(0,0,0,0.02)]">
      {/* Top Newsletter Bar (Stitch Design) */}
      <div id="newsletter" className="bg-[#c9ecc4]/35 border-b border-[#1e3a1f]/10 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1540px] 2xl:max-w-[1600px] w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <span className="text-xl sm:text-2xl text-[#1e3a1f] font-black tracking-tight block">
              Pure Harvests To Your Kitchen
            </span>
            <p className="text-xs sm:text-sm text-[#434936] mt-1 leading-relaxed">
              Subscribe for farm harvest updates, certified lab batch alerts, and receive 10% off your first organic order with code{" "}
              <strong className="text-[#486800] font-extrabold tracking-wider bg-[#c9ecc4]/60 px-1.5 py-0.5 rounded">
                HARVEST10
              </strong>
              .
            </p>
          </div>

          <div className="w-full md:w-auto max-w-md">
            {subscribed ? (
              <div className="bg-[#c9ecc4] text-[#1e3a1f] px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs animate-fadeIn">
                <span className="material-symbols-outlined text-base text-[#486800]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span>Welcome to the AgriCola Harvest Circle! 🌾</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex w-full gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full bg-white px-4 py-3 rounded-xl text-xs sm:text-sm text-[#1b1c1a] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#84b817] shadow-xs border border-gray-200"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#486800] hover:bg-[#1e3a1f] text-white text-xs sm:text-sm px-6 py-3 rounded-xl shrink-0 font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main 5-Column Navigation Grid */}
      <div className="max-w-[1540px] 2xl:max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Col (lg:col-span-2) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Link to="/" className="flex items-center gap-2 group mb-1">
              <AgriWordmark title="AgriCola" className="h-9 w-auto object-contain" />
            </Link>
            <p className="text-xs sm:text-sm text-[#434936] leading-relaxed max-w-md">
              Championing smallholder Indian agrarians through direct market access. Every batch of Makhana from Bihar, Turmeric from Lakadong, and Chia Seeds from Madhya Pradesh is 100% soil-tested, non-GMO, and verified for purity.
            </p>

            {/* Certifications Badge Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {certifications.map((cert) => (
                <span
                  key={cert}
                  className="bg-[#c9ecc4]/70 text-[#1e3a1f] text-[11px] font-extrabold px-3 py-1 rounded-full tracking-wide shadow-2xs border border-[#84b817]/20"
                >
                  {cert}
                </span>
              ))}
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-2.5 mt-3">
              {socials.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  {...(href !== "#"
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#486800] transition-all hover:bg-[#84b817] hover:text-white hover:scale-110 shadow-xs border border-gray-200/60"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Shop Col */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#486800]">
              Quick Shop
            </h4>
            <div className="flex flex-col gap-2.5">
              {quickShopLinks.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className={`text-xs sm:text-sm transition-all flex items-center justify-between gap-1.5 font-medium ${
                    l.isComingSoon
                      ? "text-[#1e3a1f] font-bold bg-[#c9ecc4]/40 hover:bg-[#c9ecc4]/70 px-2.5 py-1.5 rounded-xl border border-[#84b817]/30 shadow-2xs"
                      : "text-[#434936] hover:text-[#486800]"
                  }`}
                >
                  <span>{l.label}</span>
                  {l.isComingSoon && (
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full border ${
                      l.badgeColor === "amber"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-white text-[#1e3a1f] border-[#84b817]/30"
                    }`}>
                      {l.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Care & Verification Col */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#486800]">
              Care &amp; Verification
            </h4>
            <div className="flex flex-col gap-2.5">
              {careLinks.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className="text-xs sm:text-sm text-[#434936] hover:text-[#486800] transition-colors font-medium"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Direct Sourcing Col */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#486800]">
              Direct Sourcing
            </h4>
            <p className="text-xs sm:text-sm text-[#434936] leading-relaxed">
              Sourced directly through agrarian cooperatives across Bihar &amp; Haryana. 100% fair compensation ensured at farm gates.
            </p>
            <div className="flex items-center gap-1.5 text-[#486800] font-bold text-xs sm:text-sm mt-1 bg-white/80 border border-[#84b817]/20 px-3 py-2 rounded-xl shadow-2xs">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
              <span>Fair-Trade Certified Sourcing</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-8 border-[#1e3a1f]/10" />

        {/* Bottom Sub-bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#434936]">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} AgriCola Organics India Pvt Ltd. All rights reserved. Sourced sustainably from Bihar &amp; Haryana.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1 font-semibold text-[#1e3a1f]">
              <span className="material-symbols-outlined text-sm text-[#486800]">security</span>
              100% Secure UPI / Razorpay / Netbanking
            </span>
            <span className="hidden sm:inline-block text-gray-300">•</span>
            <span className="font-semibold text-[#1e3a1f]">WCAG 2.1 AAA Compliant</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-4">
            {legalLinks.map((l) =>
              l.to.startsWith("/") ? (
                <Link
                  key={l.label}
                  to={l.to}
                  className="transition-colors hover:text-[#486800]"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.to}
                  className="transition-colors hover:text-[#486800]"
                >
                  {l.label}
                </a>
              )
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
