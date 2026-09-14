import React from "react";

interface TestimonialItem {
  name: string;
  location: string;
  badge: string;
  rating: number;
  daysAgo: string;
  initials: string;
  avatarBg: string;
  text: string;
  favoriteItem: string;
}

const testimonials: TestimonialItem[] = [
  {
    name: "Sunita, Bengaluru",
    location: "Indiranagar, Bengaluru",
    badge: "Mother & Nutritionist",
    rating: 5,
    daysAgo: "3 days ago",
    initials: "SB",
    avatarBg: "bg-[#dcfce7] text-[#166534]",
    text: "The crunch on this Mithila Makhana is noticeably superior to grocery store brands. There is virtually zero bitter residue or unpopped black seed husks. You can literally smell the clean sun-drying process.",
    favoriteItem: "Mithila 6A Jumbo Makhana",
  },
  {
    name: "Rajesh, Gurugram",
    location: "Golf Course Rd, Gurugram",
    badge: "Heritage Kitchen Cook",
    rating: 5,
    daysAgo: "1 week ago",
    initials: "RG",
    avatarBg: "bg-[#fef3c7] text-[#92400e]",
    text: "The Lakadong Turmeric is breathtakingly fragrant. Even half a teaspoon colors our golden milk with that deep ochre shade you only see in heritage crops. The lab test QR code on the pouch was fully transparent.",
    favoriteItem: "Pure Lakadong Turmeric (7.8% Curcumin)",
  },
  {
    name: "Pooja, Mumbai",
    location: "Bandra West, Mumbai",
    badge: "Marathon Runner",
    rating: 5,
    daysAgo: "2 weeks ago",
    initials: "PM",
    avatarBg: "bg-[#e0f2fe] text-[#075985]",
    text: "As an endurance runner, seed purity matters a lot. AgriCola chia seeds expand with immense gelatinous density within 15 minutes, showing zero dust or broken gravel. Seamless dispatch within 48h to Mumbai!",
    favoriteItem: "Organic Raw Chia Seeds",
  },
];

const TestimonialsSection: React.FC = () => (
  <section className="py-16 bg-[#f5f3f0]/50 border-t border-[#1e3a1f]/05">
    <div className="container mx-auto px-4 max-w-[1540px] 2xl:max-w-[1600px] w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-[#486800] text-xs font-bold uppercase tracking-wider">
            Customer Stories • What People Love About Clean Living
          </span>
          <h2 className="text-3xl sm:text-4xl text-[#1b1c1a] font-extrabold mt-1 tracking-tight">
            Voices From Our Community
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex text-[#d97706]">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
            ))}
          </div>
          <span className="text-base font-bold text-[#1b1c1a]">4.92 Rating</span>
          <span className="text-sm text-[#434936]">(Loved by patrons across India)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1540px] 2xl:max-w-[1600px] w-full mx-auto">
        {testimonials.map((row) => (
          <div
            key={row.name}
            className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-white/80 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)] hover:shadow-[0_20px_40px_-12px_rgba(30,58,31,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex text-[#d97706]">
                  {Array.from({ length: row.rating }).map((_, i) => (
                    <span
                      key={i}
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-[#434936]">{row.daysAgo}</span>
              </div>
              <p className="text-[#434936] text-sm leading-relaxed italic mb-4">
                &ldquo;{row.text}&rdquo;
              </p>
              {row.favoriteItem && (
                <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#c9ecc4]/40 text-[#1e3a1f] text-[11px] font-medium border border-[#486800]/10">
                  <span className="material-symbols-outlined text-xs text-[#486800]">favorite</span>
                  <span>Harvest Favorite: <strong>{row.favoriteItem}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm tracking-wider shadow-inner shrink-0 ${row.avatarBg} ring-2 ring-[#84b817]/30`}
              >
                {row.initials}
              </div>
              <div>
                <h4 className="font-bold text-[#1b1c1a] text-sm flex items-center gap-1.5">
                  <span>{row.name}</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                    {row.badge}
                  </span>
                </h4>
                <span className="text-[11px] text-[#434936] flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-xs text-[#486800]">location_on</span>
                  <span>{row.location}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
