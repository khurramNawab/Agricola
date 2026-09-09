import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Fallback shown if a slide image fails to load (known-good asset).
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1547825407-2d060104b7f8?auto=format&fit=crop&w=1600&q=80";

interface HeroSlide {
  image: string;
  title: string;
  description: string;
}

// One entry per slide. Swap the `image` URLs for the brand's own assets when
// available — the copy below matches the approved hero designs.
const slides: HeroSlide[] = [
  {
    image:
      "https://agricola-images.s3.us-east-1.amazonaws.com/well_being_products.png",
    title: "Well-being Products",
    description:
      "Discover wholesome produce, nutritious staples, and wellness essentials crafted to support a healthier, more balanced lifestyle.",
  },
  {
    image:
      "https://agricola-images.s3.us-east-1.amazonaws.com/kitchen_essentials.png",
    title: "Kitchen Essentials",
    description:
      "From quality ingredients to reliable kitchen essentials, find everything you need to make everyday cooking easier and more enjoyable.",
  },
  {
    image:
      "https://agricola-images.s3.us-east-1.amazonaws.com/gardening_essentials.png",
    title: "Gardening Essentials",
    description:
      "Explore gardening essentials designed to help your plants thrive, whether you're nurturing a home garden or creating your own green sanctuary.",
  },
];

const Hero: React.FC = () => {
  const [heroIndex, setHeroIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      setHeroIndex((p) => (p + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const active = slides[heroIndex];

  return (
    <section className="relative h-[420px] sm:h-[480px] lg:h-[560px] flex items-center justify-center overflow-hidden bg-gray-100">
      <div className="absolute inset-0">
        {slides.map((slide, i) => (
          <img
            key={i}
            src={slide.image}
            alt={slide.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ease-out ${
              i === heroIndex ? "opacity-100" : "opacity-0"
            }`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/30" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* key remounts the block on slide change for a gentle fade-in */}
        <div key={heroIndex} className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl mb-4 leading-tight">
            {active.title}
          </h2>
          <p className="text-white/90 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            {active.description}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate("/products")}
              className="bg-white/15 backdrop-blur-sm border border-white/70 text-white px-6 py-2.5 rounded hover:bg-white hover:text-green-700 transition-colors text-sm font-medium"
            >
              Explore Categories
            </button>
            <button
              onClick={() => navigate("/products")}
              className="border border-white/70 text-white px-6 py-2.5 rounded hover:bg-white hover:text-green-700 transition-colors text-sm font-medium"
            >
              Shop Products
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 inset-x-0 z-10 flex justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={i}
            onClick={() => setHeroIndex(i)}
            aria-label={`Go to slide ${i + 1}: ${slide.title}`}
            className={`h-2 rounded-full transition-all ${
              i === heroIndex ? "w-6 bg-white" : "w-2 bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
