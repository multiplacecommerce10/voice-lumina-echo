import { useEffect } from "react";

/**
 * Global scroll-reveal: any element with [data-reveal] fades and rises
 * gently into view once when it enters the viewport. Respects
 * prefers-reduced-motion.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const reveal = (el: Element) => el.classList.add("is-revealed");

    const nodes = () => document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)");

    if (prefersReduced || !("IntersectionObserver" in window)) {
      nodes().forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    const observe = () => nodes().forEach((n) => io.observe(n));
    observe();

    // Re-scan on DOM changes (route updates, lazy content).
    const mo = new MutationObserver(() => observe());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}
