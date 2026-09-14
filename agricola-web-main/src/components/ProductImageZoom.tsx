import React, { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Heart,
} from "lucide-react";

interface ProductImageZoomProps {
  images: string[];
  activeImageIndex: number;
  onSelectImage: (index: number) => void;
  productTitle: string;
  isOrganic?: boolean;
  isInWishlist?: boolean;
  onToggleWishlist?: () => void;
}

export const ProductImageZoom: React.FC<ProductImageZoomProps> = ({
  images,
  activeImageIndex,
  onSelectImage,
  productTitle,
  isOrganic = true,
  isInWishlist = false,
  onToggleWishlist,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const lightboxImgRef = useRef<HTMLImageElement>(null);

  const currentImage = images[activeImageIndex] || images[0] || "/assets/makhana1.png";

  // Mouse move handler for Amazon-style hover zoom
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setMousePos({ x: 50, y: 50 });
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowRight") {
        onSelectImage((activeImageIndex + 1) % images.length);
        setLightboxZoom(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === "ArrowLeft") {
        onSelectImage((activeImageIndex - 1 + images.length) % images.length);
        setLightboxZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, activeImageIndex, images.length, onSelectImage]);

  // Lightbox zoom controls
  const handleZoomIn = () => {
    setLightboxZoom((prev) => Math.min(3.5, prev + 0.5));
  };

  const handleZoomOut = () => {
    setLightboxZoom((prev) => {
      const next = Math.max(1, prev - 0.5);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setLightboxZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Lightbox Pan drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (lightboxZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleLightboxMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || lightboxZoom <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Toggle zoom on lightbox image click
  const handleImageClick = (_e: React.MouseEvent) => {
    if (isDragging) return;
    if (lightboxZoom === 1) {
      // Zoom in to 2.2x centered on click
      setLightboxZoom(2.2);
    } else {
      handleResetZoom();
    }
  };

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* ── Main Product Image Box with Amazon-Style Hover Zoom ── */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsLightboxOpen(true)}
        className="relative bg-[#f5f3f0] rounded-3xl overflow-hidden shadow-lg aspect-square sm:aspect-[4/3] flex items-center justify-center border border-gray-200/70 cursor-zoom-in group"
        title="Click for full-screen macro inspection"
      >
        {/* The Zoomable Product Image */}
        <img
          src={currentImage}
          alt={productTitle}
          style={{
            transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
            transform: isHovering ? "scale(2.5)" : "scale(1)",
            transition: isHovering ? "transform-origin 0.05s ease-out, transform 0.25s ease-out" : "transform 0.3s ease-out",
          }}
          className="w-full h-full object-cover will-change-transform pointer-events-none"
        />

        {/* Amazon-Style Lens Indicator Tag (Bottom Center) */}
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg pointer-events-none transition-opacity duration-200 z-10 ${
            isHovering ? "opacity-95" : "opacity-75 group-hover:opacity-100"
          }`}
        >
          <ZoomIn className="w-3.5 h-3.5 text-[#84b817]" />
          <span>{isHovering ? "Move mouse to inspect details" : "Roll over image to zoom in"}</span>
        </div>

        {/* Badges Floating Over Image (Top-Left) */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
          {isOrganic !== false ? (
            <div className="bg-white/95 backdrop-blur-md text-[#486800] text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-[#84b817]/20">
              <span className="material-symbols-outlined text-sm text-[#486800]">verified</span>
              <span>100% Certified Organic</span>
            </div>
          ) : (
            <div className="bg-white/95 backdrop-blur-md text-gray-600 text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-gray-200">
              <span className="material-symbols-outlined text-sm text-gray-500">eco</span>
              <span>Naturally Sourced • Non-Organic</span>
            </div>
          )}
          <div className="bg-[#1e3a1f] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#84b817]">nature_people</span>
            <span>Direct from Certified Farm Co-op</span>
          </div>
        </div>

        {/* Badges Floating Top-Right (Full-Screen Zoom Button & Wishlist) */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(true);
            }}
            aria-label="Open Fullscreen Zoom"
            title="Inspect Macro Details (Fullscreen)"
            className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-md text-[#1e3a1f] hover:text-[#486800] flex items-center justify-center shadow-md transition-all hover:scale-110 cursor-pointer"
          >
            <Maximize2 size={18} />
          </button>
          {onToggleWishlist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist();
              }}
              aria-label="Save to wishlist"
              title="Save to Wishlist"
              className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-md text-[#1e3a1f] hover:text-rose-600 flex items-center justify-center shadow-md transition-all hover:scale-110 cursor-pointer"
            >
              <Heart
                size={18}
                className={isInWishlist ? "fill-rose-600 text-rose-600" : "text-gray-700"}
              />
            </button>
          )}
        </div>

        {/* Image Counter Pill Top-Center */}
        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full pointer-events-none z-10">
            {activeImageIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* ── Thumbnails Row: Displays all admin-uploaded product images ── */}
      {images.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectImage(idx)}
              onMouseEnter={() => onSelectImage(idx)}
              className={`relative w-18 h-18 sm:w-20 sm:h-20 shrink-0 rounded-2xl overflow-hidden bg-white shadow-xs transition-all cursor-pointer border-2 ${
                activeImageIndex === idx
                  ? "border-[#486800] ring-2 ring-[#486800]/25 scale-102"
                  : "border-gray-200/80 hover:border-[#84b817] opacity-80 hover:opacity-100"
              }`}
              title={`View image ${idx + 1}`}
            >
              <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 inset-x-1 text-center bg-white/90 backdrop-blur-xs text-[9px] font-bold py-0.5 rounded text-[#1e3a1f]">
                #{idx + 1}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Amazon-Style Macro Inspection Lightbox Modal ── */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 p-2 sm:p-6"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl h-[88vh] bg-[#141813] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Toolbar */}
            <div className="px-6 py-4 bg-black/40 border-b border-white/10 flex items-center justify-between text-white z-20">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-200 truncate max-w-md">
                  {productTitle}
                </span>
                <span className="text-xs bg-[#486800] text-white px-2.5 py-0.5 rounded-full font-semibold">
                  Photo {activeImageIndex + 1} of {images.length}
                </span>
              </div>

              {/* Zoom Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={lightboxZoom <= 1}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono font-bold w-12 text-center text-[#c9ecc4]">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={lightboxZoom >= 3.5}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer ml-1"
                  title="Reset Zoom"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="w-9 h-9 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer ml-3"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Central Canvas with Pan & Zoom */}
            <div
              className={`flex-1 relative overflow-hidden flex items-center justify-center select-none ${
                lightboxZoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleLightboxMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={lightboxImgRef}
                src={currentImage}
                alt={productTitle}
                onClick={handleImageClick}
                style={{
                  transform: `scale(${lightboxZoom}) translate(${panOffset.x / lightboxZoom}px, ${panOffset.y / lightboxZoom}px)`,
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                }}
                className="max-h-[70vh] max-w-[90vw] object-contain transition-transform"
                draggable={false}
              />

              {/* Prev / Next Slide Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectImage((activeImageIndex - 1 + images.length) % images.length);
                      handleResetZoom();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-xl hover:scale-110 cursor-pointer"
                    title="Previous Photo"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectImage((activeImageIndex + 1) % images.length);
                      handleResetZoom();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-xl hover:scale-110 cursor-pointer"
                    title="Next Photo"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              {/* Tip Pill */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-4 py-1.5 rounded-full text-xs text-gray-300 font-medium pointer-events-none flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#84b817]" />
                <span>
                  {lightboxZoom > 1
                    ? "Drag to pan around • Click to reset zoom"
                    : "Click anywhere on image to zoom 2.2x • Use buttons above for 3.5x"}
                </span>
              </div>
            </div>

            {/* Bottom Thumbnails Strip */}
            {images.length > 1 && (
              <div className="px-6 py-3 bg-black/50 border-t border-white/10 flex items-center justify-center gap-3 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectImage(idx);
                      handleResetZoom();
                    }}
                    className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? "border-[#84b817] ring-2 ring-[#84b817]/40 scale-105"
                        : "border-white/20 hover:border-white/50 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImageZoom;
