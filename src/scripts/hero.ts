/**
 * Hero Carousel Controller
 * Waits for preloader completion signal before starting auto-advance.
 */

declare global {
  interface Window {
    __preloaderComplete?: boolean;
  }
}

const DEFAULT_DURATION_MS = 3000;
const MAX_FRAME_DELTA_MS = 100;
const PRELOADER_COMPLETE_EVENT = "app:preloader-complete";

interface SlideshowState {
  index: number;
  elapsed: number;
  lastTickAt: number;
  rafId: number | null;
  paused: boolean;
  abortController: AbortController;
}

function initSlideshow(root: HTMLElement): void {
  // Prevent double-init on same element
  if (root.dataset.slideshowInit === "true") return;
  root.dataset.slideshowInit = "true";

  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-slide]"));
  const tracks = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-indicator]"));
  const fills = tracks.map((track) =>
    track.querySelector<HTMLElement>("[data-indicator-fill]")
  );

  const count = slides.length;
  if (count <= 1) return;

  const duration = Number(root.dataset.duration) || DEFAULT_DURATION_MS;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state: SlideshowState = {
    index: 0,
    elapsed: 0,
    lastTickAt: 0,
    rafId: null,
    paused: reducedMotion,
    abortController: new AbortController(),
  };

  const paintSlides = (): void => {
    for (let i = 0; i < count; i += 1) {
      const isActive = i === state.index;
      slides[i].dataset.active = String(isActive);
      slides[i].setAttribute("aria-hidden", String(!isActive));
    }
  };

  const paintTracks = (progress: number): void => {
    for (let i = 0; i < tracks.length; i += 1) {
      const isActive = i === state.index;
      tracks[i].dataset.active = String(isActive);
      tracks[i].setAttribute("aria-current", String(isActive));

      const fill = fills[i];
      if (!fill) continue;
      const scale = i < state.index ? 1 : isActive ? progress : 0;
      fill.style.transform = `scaleX(${scale})`;
    }
  };

  const stop = (): void => {
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };

  const tick = (now: number): void => {
    if (state.lastTickAt === 0) state.lastTickAt = now;
    state.elapsed += Math.min(now - state.lastTickAt, MAX_FRAME_DELTA_MS);
    state.lastTickAt = now;

    const progress = Math.min(state.elapsed / duration, 1);
    const fill = fills[state.index];
    if (fill) fill.style.transform = `scaleX(${progress})`;

    if (progress >= 1) {
      goTo(state.index + 1);
      return;
    }
    state.rafId = requestAnimationFrame(tick);
  };

  const start = (): void => {
    stop();
    state.lastTickAt = 0;
    if (state.paused) return;
    state.rafId = requestAnimationFrame(tick);
  };

  const goTo = (next: number): void => {
    state.index = ((next % count) + count) % count;
    state.elapsed = 0;
    paintSlides();
    paintTracks(0);
    start();
  };

  // --- Event Binding with Cleanup ---
  const { signal } = state.abortController;

  tracks.forEach((track, i) => {
    track.addEventListener("click", () => goTo(i), { signal });
  });

  root.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(state.index + (event.key === "ArrowRight" ? 1 : -1));
        tracks[state.index]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
        tracks[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(count - 1);
        tracks[count - 1]?.focus();
      }
    },
    { signal }
  );

  // --- Synchronization with Preloader ---
  const beginCarousel = (): void => {
    // Only start if not already running and not paused (reduced motion)
    if (state.rafId === null && !state.paused) {
      start();
    }
  };

  if (window.__preloaderComplete) {
    beginCarousel();
  } else {
    window.addEventListener(PRELOADER_COMPLETE_EVENT, beginCarousel, {
      once: true,
      signal,
    });
  }

  // Cleanup on Astro view transition unload
  document.addEventListener(
    "astro:before-swap",
    () => {
      state.abortController.abort();
      stop();
    },
    { once: true }
  );

  // Initial paint (static SSR-like state)
  paintSlides();
  paintTracks(0);
}

function initAll(): void {
  document
    .querySelectorAll<HTMLElement>("[data-slideshow]")
    .forEach(initSlideshow);
}

// Handle both initial load and Astro view transitions
document.addEventListener("astro:page-load", initAll);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}