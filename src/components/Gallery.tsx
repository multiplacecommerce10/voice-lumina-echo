import { useEffect, useRef, useState, useCallback } from "react";
import luxSonoraEscadariaAsset from "../../public/gallery/lux-sonora-escadaria.jpg.asset.json";
import luxSonoraFormalAsset from "../../public/gallery/orquestra-lux-sonora.webp.asset.json";
import rehearsalOrchestraAsset from "../../public/gallery/rehearsal-orchestra.jpg.asset.json";
import studentsPerformanceAsset from "../../public/gallery/students-performance.jpg.asset.json";
import cucaRockerAsset from "../../public/gallery/cuca-rocker.png.asset.json";
import prizedConcertAsset from "../../public/gallery/prized-concert.jpg.asset.json";


type MediaItem =
  | { type: "photo"; src: string; alt: string; caption: string }
  | { type: "video"; src: string; poster: string; alt: string; caption: string };

const items: MediaItem[] = [
  { type: "photo", src: "/gallery/photo-3.jpg", alt: "Choir conducted by Cuca Medina", caption: "Choral conducting · live performance" },
  { type: "photo", src: rehearsalOrchestraAsset.url, alt: "Cuca rehearsing with Orquestra Lux Sonora", caption: "Rehearsal with orchestra" },
  { type: "photo", src: "/gallery/photo-4.jpg", alt: "Soloist student", caption: "Soloist student" },
  { type: "photo", src: studentsPerformanceAsset.url, alt: "Students performance", caption: "Students · performance" },
  { type: "photo", src: cucaRockerAsset.url, alt: "Cuca Medina — rocker vocal study", caption: "Studio · vocal study" },
  { type: "photo", src: "/gallery/photo-1.jpg", alt: "Crianças Cantoras do IPDAE", caption: "Crianças Cantoras do IPDAE" },
  { type: "photo", src: "/gallery/photo-2.jpg", alt: "Coro jovem Vox Habilis", caption: "Vox Habilis" },
  { type: "photo", src: prizedConcertAsset.url, alt: "Cuca Medina on stage — prized concert", caption: "Prized concert" },
  { type: "photo", src: luxSonoraEscadariaAsset.url, alt: "Orquestra Lux Sonora", caption: "Orquestra Lux Sonora" },
  { type: "photo", src: luxSonoraFormalAsset.url, alt: "Orquestra Lux Sonora", caption: "Orquestra Lux Sonora" },
];


function MediaCard({ item, onOpen, index }: { item: MediaItem; onOpen: () => void; index: number }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-reveal
      data-reveal-delay={String((index % 5) + 1)}
      className="group relative block w-full mb-3 md:mb-4 break-inside-avoid rounded-2xl overflow-hidden glass-card ring-1 ring-border/50 hover:ring-primary/60 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary aura-hover"
      aria-label={`Open ${item.caption}`}
    >
      <img
        src={item.type === "photo" ? item.src : item.poster}
        alt={item.alt}
        loading="lazy"
        className="block w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />

      {/* graphic overlay: index number */}
      <div className="pointer-events-none absolute top-3 left-4 font-display text-[2.75rem] leading-none text-primary-foreground/80 mix-blend-overlay tracking-tighter">
        {String(index + 1).padStart(2, "0")}
      </div>
      {/* graphic overlay: corner rule */}
      <div className="pointer-events-none absolute top-3 right-3 w-8 h-8 border-t border-r border-primary/70" />
      <div className="pointer-events-none absolute bottom-3 left-3 w-8 h-8 border-b border-l border-primary/70" />

      {item.type === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/10 group-hover:bg-background/0 transition-colors">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[oklch(0.65_0.20_45)] flex items-center justify-center shadow-glow-gold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-primary-foreground ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background/95 via-background/60 to-transparent">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-primary/50" />
          <p className="text-xs uppercase tracking-[0.22em] text-foreground/90 font-light">{item.caption}</p>
        </div>
      </div>
    </button>
  );
}


function Lightbox({
  index,
  onClose,
  onPrev,
  onNext,
}: {
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[index];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.caption}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-5 w-11 h-11 rounded-full glass-card ring-1 ring-border/60 hover:ring-primary/60 flex items-center justify-center text-foreground/90 hover:text-primary transition-colors z-10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* Prev */}
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous"
        className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-card ring-1 ring-border/60 hover:ring-primary/60 flex items-center justify-center text-foreground/90 hover:text-primary transition-colors z-10"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Next */}
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next"
        className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-card ring-1 ring-border/60 hover:ring-primary/60 flex items-center justify-center text-foreground/90 hover:text-primary transition-colors z-10"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      <div
        className="relative max-w-[92vw] max-h-[88vh] flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {item.type === "photo" ? (
          <img
            src={item.src}
            alt={item.alt}
            className="max-w-[92vw] max-h-[78vh] object-contain rounded-xl ring-1 ring-border/50 shadow-elegant"
          />
        ) : (
          <video
            ref={videoRef}
            key={item.src}
            src={item.src}
            poster={item.poster}
            controls
            autoPlay
            playsInline
            className="max-w-[92vw] max-h-[78vh] rounded-xl ring-1 ring-border/50 shadow-elegant bg-black"
          />
        )}
        <p className="text-sm text-foreground/85 font-light text-center max-w-2xl">
          {item.caption}
          <span className="text-muted-foreground/70 ml-2">· {index + 1} / {items.length}</span>
        </p>
      </div>
    </div>
  );
}

export function Gallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [],
  );
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % items.length)),
    [],
  );

  return (
    <section id="gallery" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-14" data-reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Gallery</p>
        <h2 className="font-display text-4xl lg:text-5xl">Moments of vocal power</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mt-5 leading-relaxed">
          A glimpse into the practice — vocal technique, embodied breath, and the
          living voices of students Cuca has guided through the years.
        </p>
      </div>
      <div className="columns-1 sm:columns-2 md:columns-3 gap-3 md:gap-4 [column-fill:_balance]">
        {/* items render as MediaCard buttons; mb-* on cards creates vertical gap in columns */}
        {items.map((item, i) => (
          <MediaCard key={i} item={item} index={i} onOpen={() => setOpenIndex(i)} />
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox index={openIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </section>
  );
}
