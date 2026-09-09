import { useNavigate } from "react-router-dom";
import { Newspaper } from "lucide-react";
import Footer from "../components/layout/Footer";

export default function Blog() {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-xl">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 text-[#6d9913]">
            <Newspaper className="h-10 w-10" />
          </div>

          <span className="mb-6 inline-block rounded-full bg-green-100 px-4 py-1 text-sm font-medium text-[#6d9913]">
            Coming Soon
          </span>

          <h1 className="font-serif text-4xl sm:text-5xl text-gray-900 mb-4">
            Our Blog is Growing
          </h1>

          <p className="mb-10 text-base sm:text-lg text-gray-500">
            We're crafting stories, farming tips, and wellness insights to share
            with you. Check back soon for fresh reads.
          </p>

          <button
            onClick={() => navigate("/products")}
            className="rounded-lg bg-[#84b817] px-8 py-3 font-medium text-white transition-colors hover:bg-[#6d9913]"
          >
            Browse Products
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
