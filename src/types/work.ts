import type { ImageMetadata } from "astro";

/** Canonical project categories. Extend as the studio grows. */
export type WorkCategory =
  "Residential" | "Commercial" | "Cultural" | "Interior";

/**
 * Raw, stored shape of a work. Images are stored as strings (paths)
 * so this shape is serializable and CMS-compatible.
 *
 * Prefer consuming `ResolvedWork` from `@/lib/works` in pages.
 */
export interface Work {
  slug: string;
  title: string;
  year: number;
  category: WorkCategory;
  description: string;

  /** Path relative to project root (e.g. "/src/images/..."). */
  coverImage: string;
  /** Ordered list of image paths. */
  images: string[];

  featured?: boolean;
}

/**
 * Runtime shape consumed by pages. Images are resolved to
 * `ImageMetadata` so they can be passed to `<Image />` directly.
 */
export interface ResolvedWork extends Omit<Work, "coverImage" | "images"> {
  coverImage: ImageMetadata;
  images: ImageMetadata[];
}
