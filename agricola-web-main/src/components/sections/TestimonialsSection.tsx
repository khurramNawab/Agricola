import React from "react";
import { StarIcon } from "../../assets/icons";

const testimonials = [
  {
    name: "Aaliyah Bennett",
    rating: 5,
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    text: "The freshest produce I've ordered online — everything arrived crisp and clean, like it came straight from the farm.",
  },
  {
    name: "Rohan Mehta",
    rating: 5,
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    text: "I've switched my weekly groceries to AgriCola and genuinely notice the difference in quality. You can taste it.",
  },
  {
    name: "Priya Nair",
    rating: 4,
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
    text: "Beautiful packaging, fast delivery, and everything was fresh. It's become my go-to for the home pantry.",
  },
  {
    name: "Jordan Smith",
    rating: 5,
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    text: "I'm picky about my spices and these are wonderfully aromatic — clearly fresh and properly sourced.",
  },
  {
    name: "Sneha Kapoor",
    rating: 5,
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    text: "You can tell the produce is handpicked — clean, fresh, and full of flavour. Worth every rupee.",
  },
  {
    name: "Arjun Verma",
    rating: 4,
    avatar:
      "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=200&q=80",
    text: "Ordered a sample basket and ended up subscribing. The grains and pulses are top quality, exactly how I like them.",
  },
  {
    name: "Taylor Nguyen",
    rating: 5,
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    text: "Support helped me pick the right products for my family. Thoughtful brand, lovely quality.",
  },
  {
    name: "Meera Iyer",
    rating: 5,
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
    text: "From farm to table, you can taste the freshness. AgriCola has become part of my daily routine.",
  },
];

const TestimonialsSection: React.FC = () => (
  <section className="py-16 bg-gray-50">
    <div className="container mx-auto px-4">
      <h3 className="font-serif text-3xl text-center text-green-600 mb-12">
        What Our Customers Say
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
        {testimonials.map((row) => (
          <div
            key={row.name}
            className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon
                  key={i}
                  className={`w-4 h-4 ${
                    i < row.rating ? "text-yellow-400" : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center mb-3">
              <div className="w-9 h-9 rounded-full overflow-hidden mr-3 bg-gray-200">
                <img
                  src={row.avatar}
                  alt={row.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  data-keywords="customer, avatar, profile"
                />
              </div>
              <h4 className="font-medium text-green-600 text-sm">{row.name}</h4>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">{row.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
