import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, X, Sparkles, Film, ChevronLeft, ChevronRight } from "lucide-react";
import { BASE_URL } from "../../lib/api";

export interface HeroSlide {
  image: string;
  title: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  order?: number;
}

export interface DynamicCoupon {
  code: string;
  discountType: "percentage" | "flat" | "fixed";
  discountValue: number;
  description?: string;
  minOrderValue?: number;
}

export interface VideoModuleConfig {
  isEnabled: boolean;
  title?: string;
  subtitle?: string;
  videoType?: "upload" | "url" | "youtube";
  videoUrl?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  position?: "hero_banner" | "standalone_section";
}

interface ActiveCampaignData {
  isCustomCampaign: boolean;
  campaignName: string;
  festivalType?: string;
  slides: HeroSlide[];
  videoModule?: VideoModuleConfig;
  activeCoupon?: DynamicCoupon | null;
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    image: "/assets/makhana1.png",
    title: "Jumbo Phool Makhana (Raw Sun-Dried 6A)",
    description:
      "Hand-picked organic lotus seeds, naturally sun-dried in Mithila wetlands. Grade 6A jumbo size, zero chemical bleaching, bursting with pure crunch and plant protein.",
    ctaText: "Explore Raw Makhana",
    ctaLink: "/products?category=makhana",
    order: 0,
  },
  {
    image: "/assets/makhana_roasted.jpg",
    title: "Artisanal Slow-Roasted Crispy Makhana",
    description:
      "Slow-roasted in traditional cast iron with Vedic A2 Gir Cow Ghee, Himalayan rock salt, and stone-ground turmeric. An irresistible, guilt-free superfood crunch.",
    ctaText: "Shop Roasted Crunch",
    ctaLink: "/products?category=makhana",
    order: 1,
  },
  {
    image: "/assets/makhana2.png",
    title: "Mithila Heritage Wetland Organic Pops",
    description:
      "Pure, single-origin popped lotus seeds harvested directly from indigenous Mallah grower cooperatives. Zero synthetic polish, 100% pure farm-direct harvest.",
    ctaText: "Discover Heritage Makhana",
    ctaLink: "/products?category=makhana",
    order: 2,
  },
  {
    image: "/assets/black tea.jpeg",
    title: "Single-Estate Himalayan High-Altitude Kangra Tea",
    description:
      "Hand-plucked whole leaf black tea from misty Himachal mountain gardens. Naturally rich in brisk polyphenols, unblended and pure from soil to cup.",
    ctaText: "Explore Pure Teas",
    ctaLink: "/products",
    order: 3,
  },
  {
    image: "/assets/herbal tea.jpeg",
    title: "Handcrafted Herbal Ayurvedic Wellness Infusions",
    description:
      "Traditionally balanced botanical wellness blends with organic chamomile flowers, mulethi root, and wild mint for holistic mind-body rejuvenation.",
    ctaText: "Shop Wellness Blends",
    ctaLink: "/products",
    order: 4,
  },
];

const FESTIVAL_LABELS: Record<string, string> = {
  diwali: "🪔 Diwali Dhamaka",
  durga_puja: "🌸 Durga Puja Celebrations",
  chhath: "🌅 Chhath Puja Specials",
  eid: "🌙 Eid Mubarak Specials",
  christmas: "🎄 Christmas & New Year Offers",
  republic_day: "🇮🇳 Republic Day Sale",
  independence_day: "🇮🇳 Independence Day Sale",
  holi: "🎨 Holi Festival Offers",
  seasonal: "🌾 Seasonal Harvest Fest",
  other: "✨ Special Campaign",
};

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  let videoId = "";

  // Format: https://www.youtube.com/watch?v=VIDEO_ID
  const matchWatch = url.match(/[?&]v=([^&#]+)/);
  if (matchWatch && matchWatch[1]) {
    videoId = matchWatch[1];
  } else {
    // Format: https://youtu.be/VIDEO_ID or youtube.com/embed/VIDEO_ID or shorts/VIDEO_ID
    const matchShort = url.match(/(?:youtu\.be\/|embed\/|shorts\/)([^?&#]+)/);
    if (matchShort && matchShort[1]) {
      videoId = matchShort[1];
    }
  }

  if (!videoId) return null;
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: videoId,
    controls: "0",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    showinfo: "0",
    fs: "0",
    disablekb: "1",
    playsinline: "1",
    enablejsapi: "1",
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

const Hero: React.FC = () => {
  const [heroIndex, setHeroIndex] = useState(0);
  const [campaignData, setCampaignData] = useState<ActiveCampaignData>({
    isCustomCampaign: false,
    campaignName: "Default Hero",
    slides: DEFAULT_SLIDES,
    videoModule: { isEnabled: false },
  });
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    fetch(`${BASE_URL}/campaigns/active`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && json.data) {
          const fetchedSlides =
            json.data.slides && json.data.slides.length > 0
              ? json.data.slides
              : DEFAULT_SLIDES;
          setCampaignData({
            isCustomCampaign: !!json.data.isCustomCampaign,
            campaignName: json.data.campaignName || "Default Hero",
            festivalType: json.data.festivalType,
            slides: fetchedSlides,
            videoModule: json.data.videoModule || { isEnabled: false },
            activeCoupon: json.data.activeCoupon || null,
          });
        }
      })
      .catch((err) => {
        console.warn(
          "Failed to load active campaign, using default hero slides",
          err,
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const slides =
    campaignData.slides.length > 0 ? campaignData.slides : DEFAULT_SLIDES;

  const videoModule = campaignData.videoModule;
  const hasVideo = Boolean(videoModule?.isEnabled && videoModule?.videoUrl);

  // When video is active, disable carousel timer and keep fixed on slide 0
  useEffect(() => {
    if (hasVideo || slides.length < 2) {
      setHeroIndex(0);
      return;
    }
    const id = setInterval(() => {
      setHeroIndex((p) => (p + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length, hasVideo]);

  const active = (hasVideo ? slides[0] : slides[heroIndex]) || DEFAULT_SLIDES[0];
  const embedUrl = hasVideo ? getYouTubeEmbedUrl(videoModule?.videoUrl || "") : null;

  const handleCopyCoupon = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  const handleCtaClick = (ctaLink?: string) => {
    const target = ctaLink || "/products";
    if (target.startsWith("http://") || target.startsWith("https://")) {
      window.open(target, "_blank");
    } else {
      navigate(target);
    }
  };

  return (
    <>
      {/* ── Hero Section ── */}
      <section className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#f5f3f0] via-[#fbf9f6] to-[#fbf9f6] px-4 sm:px-6 lg:px-12 py-7 sm:py-10 lg:py-14 my-3 sm:my-4 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)]">
        {/* Ambient organic green blur spots */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#486800]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 bg-[#84b817]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* ── Left Column: Text & CTAs (Clean brand presentation) ── */}
          <div className="relative flex flex-col items-start gap-6 transition-all lg:col-span-7 p-2 sm:p-4">
            <div className="relative z-10 flex flex-col items-start gap-6 w-full">
              {/* Festival or Provenance Badge with Dynamic Coupon Code Pill Beside It */}
              <div className="flex flex-wrap items-center gap-2.5">
                {campaignData.isCustomCampaign && campaignData.festivalType ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-900 text-xs sm:text-sm font-semibold backdrop-blur-md shadow-xs animate-pulse">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>
                      {FESTIVAL_LABELS[campaignData.festivalType] ||
                        campaignData.campaignName}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm">
                    <span
                      className="material-symbols-outlined text-[#486800] text-base"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                    <span className="text-xs font-bold text-[#1b1c1a] tracking-wider uppercase">
                      Direct From Soil to Soul • Pure Living & Farm Direct
                    </span>
                  </div>
                )}

                {/* Dynamic Coupon Code Pill - Only renders when active coupon is created by admin in Coupons & Deals */}
                {campaignData.activeCoupon && (
                  <button
                    type="button"
                    onClick={() => handleCopyCoupon(campaignData.activeCoupon!.code)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1e3a1f] hover:bg-[#486800] text-white border border-[#84b817]/60 text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 group animate-fadeIn"
                    title={`Click to copy coupon code ${campaignData.activeCoupon.code}`}
                  >
                    <span className="material-symbols-outlined text-sm text-[#84b817]">confirmation_number</span>
                    <span>Coupon:</span>
                    <span className="bg-[#84b817] text-white px-2 py-0.5 rounded-full font-black tracking-wider text-[11px] shadow-xs">
                      {campaignData.activeCoupon.code}
                    </span>
                    <span className="text-[10px] text-[#c9ecc4] font-semibold">
                      {copiedCoupon
                        ? "✓ Copied!"
                        : `(${campaignData.activeCoupon.discountValue}${
                            campaignData.activeCoupon.discountType === "percentage" ? "%" : "₹"
                          } OFF • Click to Copy)`}
                    </span>
                  </button>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[50px] font-extrabold text-[#1b1c1a] tracking-tight leading-[1.12] max-w-2xl">
                Pure, Farm–Harvested Goodness. Delivered From{" "}
                <span className="text-[#486800] italic">Soil to Soul</span>.
              </h1>

              <p
                key={heroIndex}
                className="text-sm sm:text-base lg:text-lg text-[#434936] max-w-xl leading-relaxed min-h-[50px] sm:min-h-[76px] transition-all duration-300 animate-fadeIn"
              >
                {active.description ||
                  "Hand-picked organic seeds, sun-dried Mithila jumbo makhana, and single-origin stone-ground spices directly from verified partner farms. No middlemen, zero synthetic polish."}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full pt-2">
                <button
                  onClick={() => handleCtaClick(active.ctaLink)}
                  className="w-full sm:w-auto bg-[#84b817] text-white text-sm sm:text-base px-7 py-3.5 sm:px-8 sm:py-4 rounded-full font-bold shadow-[0_8px_20px_-4px_rgba(132,184,23,0.35)] hover:bg-[#486800] transition-all duration-200 flex items-center justify-center gap-2 group active:scale-95 cursor-pointer"
                >
                  <span>{active.ctaText || "Explore Fresh Harvest"}</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => navigate("/track")}
                  className="w-full sm:w-auto relative group overflow-hidden bg-gradient-to-r from-[#142314] via-[#1e3a1f] to-[#142314] hover:from-[#1e3a1f] hover:to-[#2d562f] text-white text-sm sm:text-base px-6 py-3.5 sm:px-7 sm:py-4 rounded-full font-bold shadow-[0_8px_25px_-6px_rgba(30,58,31,0.45)] hover:shadow-[0_12px_32px_-4px_rgba(132,184,23,0.35)] transition-all duration-300 flex items-center justify-center gap-2.5 sm:gap-3 border border-[#84b817]/40 hover:border-[#84b817] active:scale-95 cursor-pointer"
                >
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84b817] opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#84b817]"></span>
                  </span>
                  <span className="material-symbols-outlined text-[#84b817] text-xl group-hover:scale-110 transition-transform">
                    local_shipping
                  </span>
                  <span className="tracking-wide">Track Your Order</span>
                  <span className="bg-[#84b817]/20 border border-[#84b817]/40 text-[#a3e635] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ml-0.5">
                    Live
                  </span>
                </button>

                {/* Watch Video Button (only if standalone video section configured; not needed when video is already embedded right beside) */}
                {hasVideo && videoModule?.position === "standalone_section" && (
                  <button
                    onClick={() => setIsVideoModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-[#1e3a1f] hover:bg-[#486800] text-white font-semibold px-5 py-3.5 rounded-full shadow-sm transition-all text-sm cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white text-white" />
                    <span>{videoModule?.title || "Watch Harvest Video"}</span>
                  </button>
                )}
              </div>

              {/* Trust Badges Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full pt-3">
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-xl">
                  <span className="material-symbols-outlined text-[#486800] text-lg">
                    workspace_premium
                  </span>
                  <span className="text-xs font-bold text-[#1b1c1a]">
                    100% Pure &amp; Natural
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-xl">
                  <span className="material-symbols-outlined text-[#486800] text-lg">
                    science
                  </span>
                  <span className="text-xs font-bold text-[#1b1c1a]">
                    Zero Pesticides (Lab Tested)
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-xl">
                  <span className="material-symbols-outlined text-[#486800] text-lg">
                    local_shipping
                  </span>
                  <span className="text-xs font-bold text-[#1b1c1a]">
                    24h Express Dispatch
                  </span>
                </div>
              </div>

              {/* Carousel Slide Indicators (only shown in photo mode when multiple slides exist, never when video is active) */}
              {!hasVideo && slides.length > 1 && (
                <div className="flex items-center gap-2 pt-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHeroIndex(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        i === heroIndex
                          ? "w-7 bg-[#486800]"
                          : "w-2 bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Video (If Festival Video Active) OR Photo (When Disabled / Normal) ── */}
          <div className="lg:col-span-5 relative flex flex-col gap-4 w-full max-w-xl mx-auto">
            {campaignData.isCustomCampaign && hasVideo ? (
              /* Video Spotlight (When Festival Campaign & Video is active) */
              <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-5 shadow-[0_16px_36px_-10px_rgba(30,58,31,0.12)] border border-gray-100/90 transition-all duration-300">
                <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden bg-[#1a2217] shadow-inner mb-3.5">
                  <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-11 bg-gradient-to-b from-black via-black/80 to-transparent z-20 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-black via-black/90 to-transparent z-20 pointer-events-none" />
                    <div className="absolute top-0 bottom-0 left-0 w-20 bg-gradient-to-r from-black to-transparent z-20 pointer-events-none" />
                    <div className="absolute top-0 bottom-0 right-0 w-20 bg-gradient-to-l from-black to-transparent z-20 pointer-events-none" />

                    {embedUrl ? (
                      <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none select-none">
                        <iframe
                          src={embedUrl}
                          title={videoModule?.title || "Spotlight Video"}
                          className="w-[145%] h-[145%] border-0 object-cover pointer-events-none select-none scale-110"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    ) : (
                      <video
                        src={videoModule?.videoUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover pointer-events-none select-none"
                      />
                    )}

                    {/* Transparent overlay preventing clicks or pauses */}
                    <div className="absolute inset-0 z-20 pointer-events-auto cursor-default" />

                    <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2">
                      <span className="bg-[#1e3a1f]/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border border-white/20">
                        <Sparkles className="w-3 h-3 text-[#84b817]" />
                        AgriCola Pure Spotlight
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-[#486800] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      Festive Spotlight
                    </span>
                    <h3 className="text-base font-bold text-[#1b1c1a] leading-snug mt-0.5">
                      {videoModule?.title || "Experience The Craft of Pure Living"}
                    </h3>
                    {videoModule?.subtitle && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {videoModule.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 bg-[#c9ecc4]/80 text-[#1e3a1f] px-3 py-1.5 rounded-full text-xs font-bold shadow-2xs border border-[#84b817]/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#84b817] animate-pulse" />
                    Continuous Ambient Stream
                  </span>
                </div>
              </div>
            ) : (
              /* Photo Showcase (When Admin disables campaign/video -> "photo right side") */
              <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-5 shadow-[0_16px_36px_-10px_rgba(30,58,31,0.12)] border border-gray-100 transition-all duration-300">
                <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-[#1a2217] mb-4 shadow-inner group">
                  <img
                    src={active.image || "/assets/makhana1.png"}
                    alt={active.title}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/assets/makhana1.png";
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-105"
                  />

                  {/* Interactive Carousel Navigation Arrows (when multiple slides exist) */}
                  {slides.length > 1 && (
                    <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeroIndex((prev) => (prev - 1 + slides.length) % slides.length);
                        }}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 text-white flex items-center justify-center pointer-events-auto backdrop-blur-xs transition-all shadow-md active:scale-95 cursor-pointer opacity-70 hover:opacity-100"
                        title="Previous Slide"
                        aria-label="Previous Slide"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeroIndex((prev) => (prev + 1) % slides.length);
                        }}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 text-white flex items-center justify-center pointer-events-auto backdrop-blur-xs transition-all shadow-md active:scale-95 cursor-pointer opacity-70 hover:opacity-100"
                        title="Next Slide"
                        aria-label="Next Slide"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}

                  {/* Top Badge */}
                  <div className="absolute top-3 left-3 bg-[#f78e27] text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm z-20">
                    {heroIndex === 0
                      ? "Mithila GI Tagged 6A"
                      : heroIndex === 1
                      ? "Cast-Iron Roasted Crisp"
                      : heroIndex === 2
                      ? "Wetland Organic Harvest"
                      : heroIndex === 3
                      ? "Kangra Estate Single Origin"
                      : "Artisanal Herbal Blend"}
                  </div>

                  {/* Rating Badge */}
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-[#1e3a1f] flex items-center gap-1 shadow-sm z-20">
                    <span
                      className="material-symbols-outlined text-[#d97706] text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <span>4.9 (1.4k)</span>
                  </div>

                  {/* Slide Indicator Dots on Photo */}
                  {slides.length > 1 && (
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full z-20 flex items-center gap-1.5">
                      {slides.map((_, dotIdx) => (
                        <button
                          key={dotIdx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHeroIndex(dotIdx);
                          }}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            dotIdx === heroIndex ? "bg-[#84b817] w-4" : "bg-white/60 hover:bg-white w-1.5"
                          }`}
                          aria-label={`Go to slide ${dotIdx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-[#434936] font-semibold">
                      {heroIndex === 0
                        ? "Single Origin • Mithila, Bihar"
                        : heroIndex === 1
                        ? "Vedic Roastery • Mithila, Bihar"
                        : heroIndex === 2
                        ? "Native Cooperatives • Bihar"
                        : heroIndex === 3
                        ? "Himalayan Harvest • Himachal"
                        : "Pure Herbal • Partner Estate"}
                    </span>
                    <h3 className="text-lg font-bold text-[#1b1c1a] leading-snug mt-0.5">
                      {active.title || "Jumbo Phool Makhana (Raw Sun-Dried 6A)"}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-extrabold text-[#1b1c1a]">
                      {heroIndex === 0
                        ? "₹380"
                        : heroIndex === 1
                        ? "₹290"
                        : heroIndex === 2
                        ? "₹350"
                        : heroIndex === 3
                        ? "₹320"
                        : "₹290"}
                    </span>
                    <span className="block text-xs text-gray-400 line-through">
                      {heroIndex === 0
                        ? "MRP ₹450"
                        : heroIndex === 1
                        ? "MRP ₹360"
                        : heroIndex === 2
                        ? "MRP ₹420"
                        : heroIndex === 3
                        ? "MRP ₹390"
                        : "MRP ₹350"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <span className="text-xs text-[#4e6c4c] font-bold bg-[#c9ecc4]/60 px-2.5 py-1 rounded-lg">
                    {heroIndex === 0
                      ? "Batch #PN-MK-2025-04"
                      : heroIndex === 1
                      ? "Batch #PN-RST-2025-01"
                      : heroIndex === 2
                      ? "Batch #BH-ORG-2025-03"
                      : heroIndex === 3
                      ? "Batch #HP-TEA-2025-02"
                      : "Batch #HB-BLN-2025-01"}
                  </span>
                  <button
                    onClick={() => handleCtaClick(active.ctaLink)}
                    className="bg-[#486800] text-white hover:bg-[#84b817] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                    <span>{active.ctaText || "View Fresh Harvest"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>        </div>
      </section>

      {/* Standalone Video Spotlight Section if configured */}
      {hasVideo && videoModule?.position === "standalone_section" && (
        <section className="bg-gradient-to-b from-gray-900 to-gray-950 text-white py-12 px-4 border-t border-gray-800">
          <div className="max-w-5xl mx-auto text-center mb-8">
            {videoModule.title && (
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">
                {videoModule.title}
              </h3>
            )}
            {videoModule.subtitle && (
              <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto">
                {videoModule.subtitle}
              </p>
            )}
          </div>
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-black aspect-video relative">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={videoModule.title || "Festival Video Spotlight"}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={videoModule.videoUrl}
                autoPlay={videoModule.autoplay}
                muted={videoModule.muted}
                loop={videoModule.loop}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </section>
      )}

      {/* Hero Banner Video Modal */}
      {isVideoModalOpen && hasVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
            <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-[#84b817]" />
                <h4 className="text-white font-medium text-sm sm:text-base">
                  {videoModule?.title || "Harvest Video Showcase"}
                </h4>
              </div>
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={videoModule?.title || "Video"}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoModule?.videoUrl}
                  autoPlay
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Hero;
