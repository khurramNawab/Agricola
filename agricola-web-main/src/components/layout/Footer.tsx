import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaLinkedinIn, FaInstagram, FaFacebookF, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const shopLinks = [
  { label: "Grains & Pulses", to: "/products?category=grains-pulses" },
  { label: "All Products", to: "/products" },
];

const companyLinks = [
  { label: "About Us", to: "/contact" },
  { label: "Contact", to: "/contact" },
  { label: "Blog", to: "/blog" },
  { label: "Track Your Order", to: "/track" },
  { label: "Feedback", to: "/feedback" },
];

const socials = [
  { label: "Instagram", Icon: FaInstagram, href: "https://www.instagram.com/agricola_the_taste_of_nature/" },
  { label: "YouTube", Icon: FaYoutube, href: "https://www.youtube.com/channel/UCgEPj0SQajITm46P0SPLkNw" },
  { label: "X", Icon: FaXTwitter, href: "#" },
  { label: "LinkedIn", Icon: FaLinkedinIn, href: "#" },
  { label: "Facebook", Icon: FaFacebookF, href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy", to: "#" },
  { label: "Terms & Conditions", to: "#" },
  { label: "Return Policy", to: "/return-policy" },
];

const Footer: React.FC = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Visual-only for now — there's no newsletter endpoint on the backend yet.
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="bg-gray-50 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-4 text-4xl font-bold">
              <span className="text-[#84b817]">Agri</span>
              <span className="text-gray-600">Cola</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-gray-500">
              Premium agricultural products, sourced sustainably from trusted
              farms and delivered fresh to your door.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {socials.map(({ label, Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  {...(href !== "#" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#84b817] text-white transition-colors hover:bg-[#6d9913]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-800">
              Shop
            </h4>
            <ul className="space-y-3 text-sm">
              {shopLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-gray-500 transition-colors hover:text-[#84b817]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-800">
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-gray-500 transition-colors hover:text-[#84b817]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-800">
              Stay in the loop
            </h4>
            <p className="mb-4 text-sm text-gray-500">
              Join our newsletter for seasonal picks, new arrivals, and
              members-only offers.
            </p>
            {subscribed ? (
              <p className="text-sm font-medium text-[#84b817]">
                Thanks for subscribing! 🌾
              </p>
            ) : (
              <form
                onSubmit={handleSubscribe}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#84b817]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#84b817] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6d9913]"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        <hr className="my-8 border-gray-200" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm sm:flex-row">
          <p className="text-gray-500">
            Copyright © 2025 AgriCola. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {legalLinks.map((l) =>
              l.to.startsWith("/") ? (
                <Link
                  key={l.label}
                  to={l.to}
                  className="text-gray-500 transition-colors hover:text-[#84b817]"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.to}
                  className="text-gray-500 transition-colors hover:text-[#84b817]"
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
