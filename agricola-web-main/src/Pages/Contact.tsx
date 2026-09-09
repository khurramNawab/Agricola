import { useState } from "react";
import Footer from "../components/layout/Footer";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Wire up to a real endpoint when the backend is ready.
    console.log("Contact form submitted:", form);
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto items-start">
            {/* Left: contact info */}
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-gray-900 leading-tight mb-8">
                Get in touch with us
              </h1>
              <p className="text-gray-600 max-w-md mb-10">
                We'd love to hear from you! Whether you have a query, need help
                with your order, or just want to share feedback, our team is
                here for you.
              </p>

              <div className="mb-8">
                <p className="text-sm text-gray-500 mb-1">Email</p>
                <a
                  href="mailto:support@agricola.co.in"
                  className="text-xl break-all text-gray-900 hover:text-green-600 transition-colors sm:text-2xl md:text-3xl"
                >
                  support@agricola.co.in
                </a>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Phone</p>
                <a
                  href="tel:+919012659000"
                  className="text-xl text-gray-900 hover:text-green-600 transition-colors sm:text-2xl md:text-3xl"
                >
                  +91 90126 59000
                </a>
                <p className="text-sm text-gray-500 mt-3">
                  Available Monday to Saturday, 10 AM – 7 PM IST
                </p>
              </div>
            </div>

            {/* Right: form card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-bold text-gray-900 mb-2"
                  >
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className="w-full rounded-full border border-gray-200 px-5 py-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-bold text-gray-900 mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email address"
                    className="w-full rounded-full border border-gray-200 px-5 py-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-bold text-gray-900 mb-2"
                  >
                    How can we help you
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Enter your message"
                    className="w-full rounded-2xl border border-gray-200 px-5 py-3 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-[#84b817] py-3 text-white font-medium hover:bg-[#6d9913] transition-colors cursor-pointer"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
