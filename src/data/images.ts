import type { ImageMetadata } from "astro";

/**
 * Lazy map of every image under `src/images`.
 * Keys are project-root-relative paths, e.g. "/src/images/pocket-house/pocket-house-1.webp".
 */
const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/images/**/*.{webp,avif,jpg,jpeg,png}",
);

/**
 * Resolves a single image path to its `ImageMetadata`.
 * Throws at build time if the path is missing — fail fast.
 */
export async function getImage(path: string): Promise<ImageMetadata> {
  const loader = images[path];
  if (!loader) throw new Error(`Image not found: ${path}`);
  return (await loader()).default;
}

/** Resolves multiple image paths in parallel, preserving order. */
export async function getImages(paths: string[]): Promise<ImageMetadata[]> {
  return Promise.all(paths.map(getImage));
}
