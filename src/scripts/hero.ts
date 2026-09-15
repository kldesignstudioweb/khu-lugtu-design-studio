const DEFAULT_DURATION_MS = 3000;
/** Cap per-frame delta so a backgrounded tab / device sleep cannot fast-forward slides. */
const MAX_FRAME_DELTA_MS = 100;

function initSlideshow(root: HTMLElement): void {
  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-slide]"));
  const tracks = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-indicator]"));
  const fills = tracks.map((track) =>
    track.querySelector<HTMLElement>("[data-indicator-fill]"),
  );

  const count = slides.length;

  // Edge case: nothing to cycle.
  if (count <= 1) return;

  const duration = Number(root.dataset.duration) || DEFAULT_DURATION_MS;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let index = 0;
  let elapsed = 0;
  let lastTickAt = 0;
  let rafId: number | null = null;
  // Reduced-motion users opt out of auto-advance but keep manual controls.
  let paused = reducedMotion;

  const paintSlides = () => {
    for (let i = 0; i < count; i += 1) {
      const isActive = i === index;
      slides[i].dataset.active = isActive ? "true" : "false";
      slides[i].setAttribute("aria-hidden", isActive ? "false" : "true");
    }
  };

  const paintTracks = (progress: number) => {
    for (let i = 0; i < tracks.length; i += 1) {
      const isActive = i === index;
      tracks[i].dataset.active = isActive ? "true" : "false";
      tracks[i].setAttribute("aria-current", isActive ? "true" : "false");

      const fill = fills[i];
      if (!fill) continue;
      const scale = i < index ? 1 : isActive ? progress : 0;
      fill.style.transform = `scaleX(${scale})`;
    }
  };

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const start = () => {
    stop();
    lastTickAt = 0;
    if (paused) return;
    rafId = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    // First frame after (re)start establishes the baseline without advancing time.
    if (lastTickAt === 0) lastTickAt = now;
    elapsed += Math.min(now - lastTickAt, MAX_FRAME_DELTA_MS);
    lastTickAt = now;

    const progress = Math.min(elapsed / duration, 1);
    const fill = fills[index];
    if (fill) fill.style.transform = `scaleX(${progress})`;

    if (progress >= 1) {
      goTo(index + 1);
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  const goTo = (next: number) => {
    // Wrap-around for positive and negative deltas.
    index = ((next % count) + count) % count;
    elapsed = 0;
    paintSlides();
    paintTracks(0);
    start();
  };

  // --- Events ----------------------------------------------------------

  tracks.forEach((track, i) => {
    track.addEventListener("click", () => goTo(i));
  });

  root.addEventListener("keydown", (event) => {
    const { key } = event as KeyboardEvent;
    if (key === "ArrowRight" || key === "ArrowLeft") {
      event.preventDefault();
      goTo(index + (key === "ArrowRight" ? 1 : -1));
      tracks[index]?.focus();
    } else if (key === "Home") {
      event.preventDefault();
      goTo(0);
      tracks[0]?.focus();
    } else if (key === "End") {
      event.preventDefault();
      goTo(count - 1);
      tracks[count - 1]?.focus();
    }
  });

  // No `visibilitychange` listener: `requestAnimationFrame` already halts on
  // hidden tabs, and `MAX_FRAME_DELTA_MS` prevents any post-resume jump.

  // --- Init ------------------------------------------------------------
  paintSlides();
  paintTracks(0);
  start();
}

// Idempotent init — safe across Astro view transitions and DOMContentLoaded.
function initAll() {
  document
    .querySelectorAll<HTMLElement>("[data-slideshow]")
    .forEach((root) => {
      if (root.dataset.slideshowInit === "true") return;
      root.dataset.slideshowInit = "true";
      initSlideshow(root);
    });
}

document.addEventListener("astro:page-load", initAll);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}