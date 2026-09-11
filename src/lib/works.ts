import { works } from "@/data/works";
import { getImage, getImages } from "@/data/images";
import type { ResolvedWork, Work } from "@/types/work";

/**
 * Resolves raw image paths on a work into `ImageMetadata`.
 * @internal — use the exported selectors below in pages.
 */
async function resolveWork(work: Work): Promise<ResolvedWork> {
  const [coverImage, images] = await Promise.all([
    getImage(work.coverImage),
    getImages(work.images),
  ]);
  return { ...work, coverImage, images };
}

/** Returns every work with images resolved, newest first. */
export async function getAllWorks(): Promise<ResolvedWork[]> {
  const resolved = await Promise.all(works.map(resolveWork));
  return resolved.sort((a, b) => b.year - a.year);
}

/** Returns only works flagged as featured. */
export async function getFeaturedWorks(): Promise<ResolvedWork[]> {
  const resolved = await Promise.all(
    works.filter((w) => w.featured).map(resolveWork),
  );
  return resolved.sort((a, b) => b.year - a.year);
}

/** Returns a single work by slug, or `undefined` if not found. */
export async function getWorkBySlug(
  slug: string,
): Promise<ResolvedWork | undefined> {
  const work = works.find((w) => w.slug === slug);
  return work ? resolveWork(work) : undefined;
}
