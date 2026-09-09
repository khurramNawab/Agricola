import React from "react";

const features = [
  {
    image: "/sustainable_sourced.gif",
    title: "Sustainably Sourced",
    text: "We partner with trusted farms to bring you produce that's grown with care for the environment and the community.",
  },
  {
    image: "/freshandpure.gif",
    title: "Fresh & Pure",
    text: "Our products are carefully selected and handled to retain their natural goodness, so everything reaches you fresh and full of flavour.",
  },
  {
    image: "/loveandwellness.gif",
    title: "Health & Wellness in Every Bite",
    text: "From everyday nutrition to wholesome living, our products are chosen to nourish your body and home with nature's finest.",
  },
];

const WhyChooseUsSection: React.FC = () => (
  <section className="relative pt-16 pb-28 overflow-hidden">
    <div className="container mx-auto px-4 relative z-10">
      <h3 className="font-serif text-3xl text-center text-gray-900 mb-12">
        Why Choose Us
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {features.map(({ image, title, text }) => (
          <div key={title} className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center justify-center mb-5 overflow-hidden">
              <img
                src={image}
                alt={title}
                loading="lazy"
                className="w-full h-full object-contain p-2"
              />
            </div>
            <h4 className="text-green-600 font-semibold text-lg mb-2">
              {title}
            </h4>
            <p className="text-gray-500 text-sm max-w-xs">{text}</p>
          </div>
        ))}
      </div>
    </div>

    <span
      aria-hidden="true"
      className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 bottom-0 font-serif font-bold text-gray-100 leading-none whitespace-nowrap text-[26vw] md:text-[20vw]"
    >
      AgriCola
    </span>
  </section>
);

export default WhyChooseUsSection;
