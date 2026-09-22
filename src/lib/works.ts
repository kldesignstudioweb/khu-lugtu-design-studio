import { getCollection } from "astro:content";

import { getImage, getImages } from "@/data/images";
import type { ResolvedWork, Work } from "@/types/work";

/**
 * Resolves raw image paths on a work into ImageMetadata.
 * @internal — use the exported selectors below in pages.
 */
async function resolveWork(work: Work): Promise<ResolvedWork> {
  const [coverImage, images] = await Promise.all([
    getImage(work.coverImage),
    getImages(work.images),
  ]);

  return {
    ...work,
    coverImage,
    images,
  };
}

/**
 * Retrieves all works from the Astro collection,
 * resolves their images, and sorts newest first.
 */
export async function getAllWorks(): Promise<ResolvedWork[]> {
  const entries = await getCollection("works");

  const works: Work[] = entries.map((entry) => ({
    ...entry.data,
  }));

  const resolved = await Promise.all(works.map(resolveWork));

  return resolved.sort((a, b) => b.year - a.year);
}

/**
 * Returns only works flagged as featured.
 */
export async function getFeaturedWorks(): Promise<ResolvedWork[]> {
  const works = await getAllWorks();

  return works.filter((work) => work.featured);
}

/**
 * Returns a single work by slug, or undefined if not found.
 */
export async function getWorkBySlug(
  slug: string,
): Promise<ResolvedWork | undefined> {
  const entries = await getCollection("works");

  const entry = entries.find((entry) => entry.data.slug === slug);

  if (!entry) return undefined;

  return resolveWork(entry.data);
}