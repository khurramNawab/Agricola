import Footer from "../components/layout/Footer";
import Hero from "../components/sections/Hero";
import CategoriesSection from "../components/sections/CategoriesSection";
import BestSellersSection from "../components/sections/BestSellersSection";
import WhyChooseUsSection from "../components/sections/WhyChooseUsSection";
import TestimonialsSection from "../components/sections/TestimonialsSection";
import FAQSection from "../components/sections/FAQSection";


export const Landing = () => {
  return (
    <div id="webcrumbs" className="bg-white min-h-screen flex flex-col">
      <main className="flex-1">
        <Hero />
        <CategoriesSection />
        <BestSellersSection />
        <WhyChooseUsSection />
        <TestimonialsSection />
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
};

